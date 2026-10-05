alter table public.athlete_profiles
    drop constraint if exists athlete_profiles_activities_check,
    drop constraint if exists athlete_profiles_primary_activity_check;

alter table public.athlete_profiles
    add constraint athlete_profiles_activities_check
        check (
            cardinality(activities) <= 8
            and activities <@ array[
                'running', 'cycling', 'swimming', 'strength_training',
                'climbing', 'hiking', 'walking', 'stretching/yoga'
            ]::text[]
        ),
    add constraint athlete_profiles_primary_activity_check
        check (
            primary_activity is null
            or primary_activity in (
                'running', 'cycling', 'swimming', 'strength_training',
                'climbing', 'hiking', 'walking', 'stretching/yoga'
            )
        );
