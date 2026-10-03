create table if not exists public.users (
    id uuid primary key
        references auth.users(id)
        on delete cascade,
    username text not null
        check (username ~ '^[A-Za-z0-9_.-]{3,30}$'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists users_username_lower_unique
    on public.users (lower(username));

with candidates as (
    select
        id,
        nullif(trim(raw_user_meta_data ->> 'username'), '') as requested_username
    from auth.users
), ranked as (
    select
        id,
        requested_username,
        row_number() over (
            partition by lower(requested_username)
            order by id
        ) as username_rank
    from candidates
    where requested_username ~ '^[A-Za-z0-9_.-]{3,30}$'
)
insert into public.users (id, username)
select
    candidates.id,
    case
        when ranked.username_rank = 1 then candidates.requested_username
        else 'user_' || left(replace(candidates.id::text, '-', ''), 25)
    end
from candidates
left join ranked on ranked.id = candidates.id
on conflict (id) do nothing;

do $$
begin
    if to_regclass('public.profiles') is not null
       and to_regclass('public.athlete_profiles') is null then
        alter table public.profiles rename to athlete_profiles;
    elsif to_regclass('public.athlete_profiles') is null then
        raise exception 'Neither public.profiles nor public.athlete_profiles exists.';
    end if;
end;
$$;

alter table public.athlete_profiles
    add column if not exists user_id uuid
        references public.users(id)
        on delete cascade;

create unique index if not exists athlete_profiles_user_id_key
    on public.athlete_profiles(user_id);

update public.athlete_profiles
set user_id = id
where user_id is null
  and id in (select id from public.users);

insert into public.athlete_profiles (user_id, name)
select auth_user.id, nullif(trim(auth_user.raw_user_meta_data ->> 'athlete_name'), '')
from auth.users as auth_user
where not exists (
    select 1
    from public.athlete_profiles as athlete
    where athlete.user_id = auth_user.id
);

do $$
declare
    target_table text;
    old_constraint text;
    new_constraint text;
begin
    foreach target_table in array array['activities', 'injuries', 'feedback'] loop
        if exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and information_schema.columns.table_name = target_table
              and column_name = 'profile_id'
        ) and not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and information_schema.columns.table_name = target_table
              and column_name = 'athlete_profile_id'
        ) then
            execute format(
                'alter table public.%I rename column profile_id to athlete_profile_id',
                target_table
            );
        end if;
    end loop;

    foreach target_table in array array['activities', 'injuries', 'feedback'] loop
        old_constraint := target_table || '_profile_id_fkey';
        new_constraint := target_table || '_athlete_profile_id_fkey';
        if exists (
            select 1 from pg_constraint
            where conrelid = format('public.%I', target_table)::regclass
              and conname = old_constraint
        ) and not exists (
            select 1 from pg_constraint
            where conrelid = format('public.%I', target_table)::regclass
              and conname = new_constraint
        ) then
            execute format(
                'alter table public.%I rename constraint %I to %I',
                target_table,
                old_constraint,
                new_constraint
            );
        end if;
    end loop;

    old_constraint := 'activities_profile_id_garmin_activity_id_key';
    new_constraint := 'activities_athlete_profile_id_garmin_activity_id_key';
    if exists (
        select 1 from pg_constraint
        where conrelid = 'public.activities'::regclass and conname = old_constraint
    ) and not exists (
        select 1 from pg_constraint
        where conrelid = 'public.activities'::regclass and conname = new_constraint
    ) then
        alter table public.activities
            rename constraint activities_profile_id_garmin_activity_id_key
            to activities_athlete_profile_id_garmin_activity_id_key;
    end if;

    old_constraint := 'feedback_profile_id_feedback_date_key';
    new_constraint := 'feedback_athlete_profile_id_feedback_date_key';
    if exists (
        select 1 from pg_constraint
        where conrelid = 'public.feedback'::regclass and conname = old_constraint
    ) and not exists (
        select 1 from pg_constraint
        where conrelid = 'public.feedback'::regclass and conname = new_constraint
    ) then
        alter table public.feedback
            rename constraint feedback_profile_id_feedback_date_key
            to feedback_athlete_profile_id_feedback_date_key;
    end if;

    if to_regclass('public.idx_activities_profile_start_time') is not null
       and to_regclass('public.idx_activities_athlete_profile_start_time') is null then
        alter index public.idx_activities_profile_start_time
            rename to idx_activities_athlete_profile_start_time;
    end if;
    if to_regclass('public.idx_injuries_profile_dates') is not null
       and to_regclass('public.idx_injuries_athlete_profile_dates') is null then
        alter index public.idx_injuries_profile_dates
            rename to idx_injuries_athlete_profile_dates;
    end if;
    if to_regclass('public.idx_feedback_profile_date') is not null
       and to_regclass('public.idx_feedback_athlete_profile_date') is null then
        alter index public.idx_feedback_profile_date
            rename to idx_feedback_athlete_profile_date;
    end if;
end;
$$;

alter table public.users enable row level security;
alter table public.athlete_profiles enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.athlete_profiles from anon, authenticated;
grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.athlete_profiles to service_role;

create or replace function public.create_public_user_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_username text;
begin
    requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
    if requested_username is null then
        requested_username := 'user_' || left(replace(new.id::text, '-', ''), 25);
    end if;

    insert into public.users (id, username)
    values (new.id, requested_username)
    on conflict (id) do nothing;

    insert into public.athlete_profiles (user_id, name)
    values (
        new.id,
        nullif(trim(new.raw_user_meta_data ->> 'athlete_name'), '')
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgrelid = 'auth.users'::regclass
          and tgname = 'on_auth_user_created_create_public_user'
          and not tgisinternal
    ) then
        create trigger on_auth_user_created_create_public_user
            after insert on auth.users
            for each row
            execute function public.create_public_user_for_auth_user();
    end if;
end;
$$;
