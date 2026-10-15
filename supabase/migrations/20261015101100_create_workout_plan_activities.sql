create table public.workout_plan_activities (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null
        references public.workout_plans(id)
        on delete cascade,
    athlete_profile_id uuid not null
        references public.athlete_profiles(id)
        on delete cascade,
    workout_date date not null,
    workout_data jsonb not null
        check (jsonb_typeof(workout_data) = 'object'),
    is_completed boolean not null default false,
    completed_at timestamptz,
    constraint workout_plan_activities_plan_date_unique
        unique (plan_id, workout_date)
);

create index idx_workout_plan_activities_athlete_date
    on public.workout_plan_activities(athlete_profile_id, workout_date desc);

alter table public.workout_plan_activities enable row level security;
revoke all on table public.workout_plan_activities from anon, authenticated;
grant select, insert, update, delete on table public.workout_plan_activities to service_role;

insert into public.workout_plan_activities (
    plan_id,
    athlete_profile_id,
    workout_date,
    workout_data,
    is_completed,
    completed_at
)
select
    plans.id,
    plans.athlete_profile_id,
    (entries.workout ->> 'date')::date,
    entries.workout - 'completed',
    true,
    now()
from public.workout_plans as plans
cross join lateral jsonb_array_elements(plans.plan_data -> 'days') as entries(workout)
where entries.workout ->> 'completed' = 'true'
on conflict (plan_id, workout_date) do nothing;
