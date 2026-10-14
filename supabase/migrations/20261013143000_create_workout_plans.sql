create table public.workout_plans (
    id uuid primary key default gen_random_uuid(),
    athlete_profile_id uuid not null
        references public.athlete_profiles(id)
        on delete cascade,
    title text not null
        check (length(btrim(title)) between 1 and 120),
    week_start date not null,
    week_end date not null,
    plan_data jsonb not null
        check (
            jsonb_typeof(plan_data) = 'object'
            and case
                when jsonb_typeof(plan_data -> 'days') = 'array'
                    then jsonb_array_length(plan_data -> 'days') = 7
                else false
            end
        ),
    is_current boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint workout_plans_week_range_check
        check (week_end = week_start + 6)
);

create index idx_workout_plans_athlete_created
    on public.workout_plans(athlete_profile_id, created_at desc);

create unique index idx_workout_plans_one_current_per_athlete
    on public.workout_plans(athlete_profile_id)
    where is_current;

alter table public.workout_plans enable row level security;
revoke all on table public.workout_plans from anon, authenticated;
grant select, insert, update, delete on table public.workout_plans to service_role;

create or replace function public.set_current_workout_plan(
    target_plan_id uuid,
    target_athlete_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    selected_plan_id uuid;
begin
    perform pg_advisory_xact_lock(hashtextextended(target_athlete_profile_id::text, 0));

    update public.workout_plans
    set is_current = false,
        updated_at = now()
    where athlete_profile_id = target_athlete_profile_id
      and is_current;

    update public.workout_plans
    set is_current = true,
        updated_at = now()
    where id = target_plan_id
      and athlete_profile_id = target_athlete_profile_id
    returning id into selected_plan_id;

    if selected_plan_id is null then
        raise exception 'Workout plan was not found for this athlete profile.';
    end if;

    return selected_plan_id;
end;
$$;

revoke all on function public.set_current_workout_plan(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_current_workout_plan(uuid, uuid) to service_role;
