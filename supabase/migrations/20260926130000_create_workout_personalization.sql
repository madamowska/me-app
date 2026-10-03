do $$
declare
    profile_table text;
begin
    if to_regclass('public.profiles') is not null then
        profile_table := 'profiles';
    elsif to_regclass('public.athlete_profiles') is not null then
        profile_table := 'athlete_profiles';
    else
        raise exception 'Neither public.profiles nor public.athlete_profiles exists.';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = profile_table
          and column_name = 'primary_sport'
    ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = profile_table
          and column_name = 'primary_activity'
    ) then
        execute format(
            'alter table public.%I rename column primary_sport to primary_activity',
            profile_table
        );
    end if;

    execute format(
        'alter table public.%I
            add column if not exists gender text,
            add column if not exists goals text not null default '''',
            add column if not exists activities text[] not null default array[]::text[],
            add column if not exists available_days text[] not null default array[]::text[],
            add column if not exists description text not null default ''''',
        profile_table
    );

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = profile_table
          and column_name = 'goal'
    ) then
        execute format(
            'update public.%I set goals = left(goal, 2000) where goals = '''' and goal is not null',
            profile_table
        );
        execute format('alter table public.%I drop column goal cascade', profile_table);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = profile_table
          and column_name = 'preferred_activities'
    ) then
        execute format(
            'update public.%1$I as athlete
             set activities = coalesce((
                 select array_agg(distinct selected.activity)
                 from unnest(athlete.preferred_activities) as selected(activity)
                 where selected.activity = any(array[
                     ''running'', ''cycling'', ''swimming'', ''strength_training'',
                     ''climbing'', ''hiking'', ''walking''
                 ]::text[])
             ), array[]::text[])
             where cardinality(athlete.activities) = 0',
            profile_table
        );
        execute format(
            'update public.%1$I as athlete
             set description = left(concat_ws(E''\n\n'',
                 nullif(btrim(athlete.description), ''''),
                 case when cardinality(athlete.preferred_activities) > 0
                      then ''Previous preferred activities: '' ||
                           array_to_string(athlete.preferred_activities, '', '')
                 end
             ), 4000)
             where cardinality(athlete.preferred_activities) > 0',
            profile_table
        );
        execute format('alter table public.%I drop column preferred_activities cascade', profile_table);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = profile_table
          and column_name = 'equipment'
    ) then
        execute format(
            'update public.%1$I as athlete
             set description = left(concat_ws(E''\n\n'',
                 nullif(btrim(athlete.description), ''''),
                 case when cardinality(athlete.equipment) > 0
                      then ''Previous equipment: '' || array_to_string(athlete.equipment, '', '')
                 end
             ), 4000)
             where cardinality(athlete.equipment) > 0',
            profile_table
        );
        execute format('alter table public.%I drop column equipment cascade', profile_table);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = profile_table
          and column_name = 'additional_preferences'
    ) then
        execute format(
            'update public.%1$I as athlete
             set description = left(concat_ws(E''\n\n'',
                 nullif(btrim(athlete.description), ''''),
                 case when athlete.additional_preferences <> ''{}''::jsonb
                      then ''Previous additional preferences: '' ||
                           athlete.additional_preferences::text
                 end
             ), 4000)
             where athlete.additional_preferences <> ''{}''::jsonb',
            profile_table
        );
        execute format('alter table public.%I drop column additional_preferences cascade', profile_table);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = profile_table
          and column_name = 'primary_activity'
    ) then
        execute format(
            'update public.%1$I
             set description = left(concat_ws(E''\n\n'',
                     nullif(btrim(description), ''''),
                     ''Previous primary activity: '' || primary_activity
                 ), 4000),
                 primary_activity = null
             where primary_activity is not null
               and lower(trim(primary_activity)) not in (
                   ''running'', ''cycling'', ''swimming'', ''strength_training'',
                   ''strength training'', ''climbing'', ''hiking'', ''walking''
               )',
            profile_table
        );
        execute format(
            'update public.%I
             set primary_activity = ''strength_training''
             where lower(trim(primary_activity)) = ''strength training''',
            profile_table
        );
    end if;

    execute format(
        'update public.%I
         set available_days = array(
             select distinct day
             from unnest(available_days) as selected(day)
         )',
        profile_table
    );

    execute format('alter table public.%I drop constraint if exists profiles_goal_check', profile_table);
    execute format('alter table public.%I drop constraint if exists athlete_profiles_goal_check', profile_table);
    execute format('alter table public.%I drop constraint if exists profiles_available_days_check', profile_table);
    execute format('alter table public.%I drop constraint if exists athlete_profiles_available_days_check', profile_table);
    execute format('alter table public.%I drop constraint if exists athlete_profiles_gender_check', profile_table);
    execute format('alter table public.%I drop constraint if exists athlete_profiles_goals_check', profile_table);
    execute format('alter table public.%I drop constraint if exists athlete_profiles_activities_check', profile_table);
    execute format('alter table public.%I drop constraint if exists athlete_profiles_description_check', profile_table);
    execute format('alter table public.%I drop constraint if exists athlete_profiles_primary_activity_check', profile_table);

    execute format(
        'alter table public.%I
            add constraint athlete_profiles_gender_check
                check (gender is null or gender in (''female'', ''male'')),
            add constraint athlete_profiles_goals_check
                check (length(goals) <= 2000),
            add constraint athlete_profiles_activities_check
                check (
                    cardinality(activities) <= 7
                    and activities <@ array[
                        ''running'', ''cycling'', ''swimming'', ''strength_training'',
                        ''climbing'', ''hiking'', ''walking''
                    ]::text[]
                ),
            add constraint athlete_profiles_available_days_check
                check (
                    cardinality(available_days) <= 7
                    and available_days <@ array[
                        ''monday'', ''tuesday'', ''wednesday'', ''thursday'',
                        ''friday'', ''saturday'', ''sunday''
                    ]::text[]
                ),
            add constraint athlete_profiles_description_check
                check (length(description) <= 4000),
            add constraint athlete_profiles_primary_activity_check
                check (
                    primary_activity is null
                    or primary_activity in (
                        ''running'', ''cycling'', ''swimming'', ''strength_training'',
                        ''climbing'', ''hiking'', ''walking''
                    )
                )',
        profile_table
    );
end;
$$;

do $$
declare
    profile_table text;
    profile_fk_column text;
begin
    if to_regclass('public.profiles') is not null then
        profile_table := 'profiles';
        profile_fk_column := 'profile_id';
    else
        profile_table := 'athlete_profiles';
        profile_fk_column := 'athlete_profile_id';
    end if;

    if to_regclass('public.injuries') is null then
        execute format(
            'create table public.injuries (
                id uuid primary key default gen_random_uuid(),
                %1$I uuid not null references public.%2$I(id) on delete cascade,
                injury_name text not null
                    check (length(trim(injury_name)) between 1 and 150),
                started_on date,
                resolved_on date,
                details text check (details is null or length(details) <= 3000),
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                check (resolved_on is null or started_on is null or resolved_on >= started_on)
            )',
            profile_fk_column,
            profile_table
        );
    end if;

    if to_regclass('public.feedback') is null then
        execute format(
            'create table public.feedback (
                id uuid primary key default gen_random_uuid(),
                %1$I uuid not null references public.%2$I(id) on delete cascade,
                feedback_date date not null,
                soreness smallint check (soreness is null or soreness between 1 and 5),
                sleep_hours numeric(4, 1)
                    check (sleep_hours is null or sleep_hours between 0 and 24),
                stress smallint check (stress is null or stress between 1 and 5),
                notes text check (notes is null or length(notes) <= 3000),
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                unique (%1$I, feedback_date)
            )',
            profile_fk_column,
            profile_table
        );
    end if;
end;
$$;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'injuries'
          and column_name = 'profile_id'
    ) then
        create index if not exists idx_injuries_profile_dates
            on public.injuries(profile_id, started_on desc);
    else
        create index if not exists idx_injuries_athlete_profile_dates
            on public.injuries(athlete_profile_id, started_on desc);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'feedback'
          and column_name = 'profile_id'
    ) then
        create index if not exists idx_feedback_profile_date
            on public.feedback(profile_id, feedback_date desc);
    else
        create index if not exists idx_feedback_athlete_profile_date
            on public.feedback(athlete_profile_id, feedback_date desc);
    end if;
end;
$$;

comment on table public.injuries is
    'Athlete-provided injury history and training limitations; treat as sensitive health information.';
comment on table public.feedback is
    'Athlete-entered daily wellness feedback used as context for workout planning.';

alter table public.injuries enable row level security;
alter table public.feedback enable row level security;

revoke all on table public.injuries from anon, authenticated;
revoke all on table public.feedback from anon, authenticated;
grant select, insert, update, delete on table public.injuries to service_role;
grant select, insert, update, delete on table public.feedback to service_role;
