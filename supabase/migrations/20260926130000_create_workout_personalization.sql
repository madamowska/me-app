alter table public.profiles
    add column goal text not null default 'general_fitness'
        check (length(trim(goal)) > 0 and length(goal) <= 100),
    add column preferred_activities text[] not null default array[]::text[],
    add column available_days text[] not null default array[]::text[]
        check (
            cardinality(available_days) <= 7
            and available_days <@ array[
                'monday', 'tuesday', 'wednesday', 'thursday',
                'friday', 'saturday', 'sunday'
            ]::text[]
        ),
    add column equipment text[] not null default array[]::text[],
    add column additional_preferences jsonb not null default '{}'::jsonb
        check (jsonb_typeof(additional_preferences) = 'object');

comment on column public.profiles.goal is
    'Athlete primary training goal.';
comment on column public.profiles.preferred_activities is
    'Activity types the athlete prefers to include in workout plans.';
comment on column public.profiles.available_days is
    'Lowercase weekday names available for training.';
comment on column public.profiles.equipment is
    'Equipment available to the athlete.';
comment on column public.profiles.additional_preferences is
    'Additional structured workout preferences for plan personalization.';

create table public.injuries (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.profiles(id)
        on delete cascade,
    injury_name text not null
        check (length(trim(injury_name)) between 1 and 150),
    started_on date,
    resolved_on date,
    details text
        check (details is null or length(details) <= 3000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (resolved_on is null or started_on is null or resolved_on >= started_on)
);

create index idx_injuries_profile_dates
    on public.injuries(profile_id, started_on desc);

comment on table public.injuries is
    'Athlete-provided injury history and training limitations; treat as sensitive health information.';

create table public.feedback (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.profiles(id)
        on delete cascade,
    feedback_date date not null,
    soreness smallint
        check (soreness is null or soreness between 1 and 5),
    sleep_hours numeric(4, 1)
        check (sleep_hours is null or sleep_hours between 0 and 24),
    stress smallint
        check (stress is null or stress between 1 and 5),
    notes text
        check (notes is null or length(notes) <= 3000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (profile_id, feedback_date)
);

create index idx_feedback_profile_date
    on public.feedback(profile_id, feedback_date desc);

comment on table public.feedback is
    'Athlete-entered daily wellness feedback used as context for workout planning.';

alter table public.injuries enable row level security;
alter table public.feedback enable row level security;

revoke all on table public.injuries from anon, authenticated;
revoke all on table public.feedback from anon, authenticated;
grant select, insert, update, delete on table public.injuries to service_role;
grant select, insert, update, delete on table public.feedback to service_role;
