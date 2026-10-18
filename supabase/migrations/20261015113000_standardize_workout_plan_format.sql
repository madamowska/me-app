update public.workout_plans as plans
set plan_data = jsonb_build_object(
    'summary',
    case
        when jsonb_typeof(plans.plan_data -> 'summary') = 'string'
            then plans.plan_data -> 'summary'
        else to_jsonb(''::text)
    end,
    'recoveryNotes',
    case
        when jsonb_typeof(plans.plan_data -> 'recoveryNotes') = 'array'
            then plans.plan_data -> 'recoveryNotes'
        else '[]'::jsonb
    end,
    'days',
    (
        select jsonb_agg(
            jsonb_build_object(
                'day', entry.workout -> 'day',
                'date', entry.workout -> 'date',
                'type',
                case lower(entry.workout ->> 'type')
                    when 'biking' then to_jsonb('cycling'::text)
                    when 'strength training' then to_jsonb('strength_training'::text)
                    else entry.workout -> 'type'
                end,
                'title', coalesce(entry.workout -> 'title', to_jsonb(''::text)),
                'durationMinutes',
                case
                    when jsonb_typeof(entry.workout -> 'durationMinutes') = 'number'
                        then entry.workout -> 'durationMinutes'
                    when entry.workout ->> 'duration' ~ '^\d+\s*min$'
                        then to_jsonb(regexp_replace(entry.workout ->> 'duration', '\s*min$', '', 'i')::integer)
                    when entry.workout ->> 'duration' ~ '^\d+\s*h$'
                        then to_jsonb(regexp_replace(entry.workout ->> 'duration', '\s*h$', '', 'i')::integer * 60)
                    when entry.workout ->> 'duration' ~ '^\d+:\d{2}$'
                        then to_jsonb(
                            split_part(entry.workout ->> 'duration', ':', 1)::integer * 60
                            + split_part(entry.workout ->> 'duration', ':', 2)::integer
                        )
                    when lower(entry.workout ->> 'type') = 'rest'
                        then to_jsonb(0)
                    else 'null'::jsonb
                end,
                'intensity',
                case
                    when jsonb_typeof(entry.workout -> 'intensity') = 'string'
                        then entry.workout -> 'intensity'
                    when lower(entry.workout ->> 'type') = 'rest'
                        then to_jsonb('easy'::text)
                    else to_jsonb(''::text)
                end,
                'warmup',
                case jsonb_typeof(entry.workout -> 'warmup')
                    when 'array' then entry.workout -> 'warmup'
                    when 'string' then coalesce((
                        select jsonb_agg(to_jsonb(btrim(lines.line)) order by lines.ordinality)
                        from regexp_split_to_table(entry.workout ->> 'warmup', E'\\r?\\n')
                            with ordinality as lines(line, ordinality)
                        where btrim(lines.line) <> ''
                    ), '[]'::jsonb)
                    else '[]'::jsonb
                end,
                'exercises',
                case jsonb_typeof(entry.workout -> 'exercises')
                    when 'array' then entry.workout -> 'exercises'
                    when 'string' then coalesce((
                        select jsonb_agg(to_jsonb(btrim(lines.line)) order by lines.ordinality)
                        from regexp_split_to_table(entry.workout ->> 'exercises', E'\\r?\\n')
                            with ordinality as lines(line, ordinality)
                        where btrim(lines.line) <> ''
                    ), '[]'::jsonb)
                    else '[]'::jsonb
                end,
                'cooldown',
                case jsonb_typeof(entry.workout -> 'cooldown')
                    when 'array' then entry.workout -> 'cooldown'
                    when 'string' then coalesce((
                        select jsonb_agg(to_jsonb(btrim(lines.line)) order by lines.ordinality)
                        from regexp_split_to_table(entry.workout ->> 'cooldown', E'\\r?\\n')
                            with ordinality as lines(line, ordinality)
                        where btrim(lines.line) <> ''
                    ), '[]'::jsonb)
                    else '[]'::jsonb
                end,
                'notes',
                case
                    when jsonb_typeof(entry.workout -> 'notes') = 'string'
                        then entry.workout -> 'notes'
                    else to_jsonb(''::text)
                end,
                'distanceKm',
                case
                    when jsonb_typeof(entry.workout -> 'distanceKm') = 'number'
                        then entry.workout -> 'distanceKm'
                    else 'null'::jsonb
                end,
                'pace',
                case
                    when jsonb_typeof(entry.workout -> 'pace') = 'string'
                        then entry.workout -> 'pace'
                    else to_jsonb(''::text)
                end,
                'speedKph',
                case
                    when jsonb_typeof(entry.workout -> 'speedKph') = 'number'
                        then entry.workout -> 'speedKph'
                    else 'null'::jsonb
                end,
                'elevationGainM',
                case
                    when jsonb_typeof(entry.workout -> 'elevationGainM') = 'number'
                        then entry.workout -> 'elevationGainM'
                    else 'null'::jsonb
                end
            )
            order by entry.ordinality
        )
        from jsonb_array_elements(plans.plan_data -> 'days')
            with ordinality as entry(workout, ordinality)
    )
)
where jsonb_typeof(plans.plan_data -> 'days') = 'array'
  and jsonb_array_length(plans.plan_data -> 'days') = 7;
