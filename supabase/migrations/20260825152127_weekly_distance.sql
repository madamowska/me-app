-- Migration: create weekly_distance function
-- Returns last N week-starts (date) with total km per week for a given sport.

CREATE OR REPLACE FUNCTION public.weekly_distance(sport text DEFAULT 'running', weeks int DEFAULT 10)
RETURNS TABLE(week_start date, distance_km numeric) AS
$$
WITH params AS (
  SELECT coalesce(sport, 'running')::text AS sport_in,
         greatest(coalesce(weeks, 10), 1)::int AS weeks
), week_series AS (
  SELECT generate_series(
    date_trunc('week', now() AT TIME ZONE 'UTC') - (params.weeks - 1) * INTERVAL '1 week',
    date_trunc('week', now() AT TIME ZONE 'UTC'),
    INTERVAL '1 week'
  ) AS week_start
  FROM params
), totals AS (
  SELECT
    date_trunc('week', start_time AT TIME ZONE 'UTC') AS week_start,
    SUM(COALESCE(distance_m, 0))::numeric / 1000.0 AS distance_km
  FROM activities, params
  WHERE
    activity_type ILIKE '%' || params.sport_in || '%'
    AND start_time >= (date_trunc('week', now() AT TIME ZONE 'UTC') - (params.weeks - 1) * INTERVAL '1 week')
  GROUP BY date_trunc('week', start_time AT TIME ZONE 'UTC')
)
SELECT
  ws.week_start::date AS week_start,
  COALESCE(t.distance_km, 0) AS distance_km
FROM week_series ws
LEFT JOIN totals t ON ws.week_start = t.week_start
ORDER BY ws.week_start;
$$ LANGUAGE sql STABLE;

-- Grant EXECUTE so PostgREST / anon user can call it (adjust roles if needed)
GRANT EXECUTE ON FUNCTION public.weekly_distance(text, int) TO anon;
GRANT EXECUTE ON FUNCTION public.weekly_distance(text, int) TO authenticated;
