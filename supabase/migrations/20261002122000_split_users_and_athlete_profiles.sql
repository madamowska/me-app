create table public.users (
    id uuid primary key
        references auth.users(id)
        on delete cascade,
    username text not null
        check (username ~ '^[A-Za-z0-9_.-]{3,30}$'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index users_username_lower_unique
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

alter table public.profiles rename to athlete_profiles;
alter table public.athlete_profiles
    add column user_id uuid unique
        references public.users(id)
        on delete cascade;

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

alter table public.activities
    rename column profile_id to athlete_profile_id;
alter table public.activities
    rename constraint activities_profile_id_fkey to activities_athlete_profile_id_fkey;
alter table public.activities
    rename constraint activities_profile_id_garmin_activity_id_key
    to activities_athlete_profile_id_garmin_activity_id_key;
alter index public.idx_activities_profile_start_time
    rename to idx_activities_athlete_profile_start_time;

alter table public.injuries
    rename column profile_id to athlete_profile_id;
alter table public.injuries
    rename constraint injuries_profile_id_fkey to injuries_athlete_profile_id_fkey;
alter index public.idx_injuries_profile_dates
    rename to idx_injuries_athlete_profile_dates;

alter table public.feedback
    rename column profile_id to athlete_profile_id;
alter table public.feedback
    rename constraint feedback_profile_id_fkey to feedback_athlete_profile_id_fkey;
alter table public.feedback
    rename constraint feedback_profile_id_feedback_date_key
    to feedback_athlete_profile_id_feedback_date_key;
alter index public.idx_feedback_profile_date
    rename to idx_feedback_athlete_profile_date;

alter table public.users enable row level security;
alter table public.athlete_profiles enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.athlete_profiles from anon, authenticated;
grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.athlete_profiles to service_role;

create function public.create_public_user_for_auth_user()
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
    values (new.id, requested_username);

    insert into public.athlete_profiles (user_id, name)
    values (
        new.id,
        nullif(trim(new.raw_user_meta_data ->> 'athlete_name'), '')
    );

    return new;
end;
$$;

create trigger on_auth_user_created_create_public_user
    after insert on auth.users
    for each row
    execute function public.create_public_user_for_auth_user();
