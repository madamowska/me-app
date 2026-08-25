create table public.activities (
    id uuid primary key default gen_random_uuid(),

    profile_id uuid not null
        references public.profiles(id)
        on delete cascade,

    garmin_activity_id bigint not null,

    activity_type text,
    activity_name text,

    start_time timestamptz not null,

    duration_seconds integer,
    distance_m numeric,

    calories numeric,

    avg_heart_rate integer,
    max_heart_rate integer,

    avg_speed_mps numeric,
    max_speed_mps numeric,

    raw_data jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (profile_id, garmin_activity_id)
);

create index idx_activities_profile_start_time
on public.activities(profile_id, start_time desc);