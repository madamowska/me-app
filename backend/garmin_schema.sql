create table if not exists garmin_sync_state (
  source text primary key,
  last_synced_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists garmin_activities (
  source_id text primary key,
  source text not null,
  activity_name text,
  sport text,
  started_at timestamptz,
  duration_seconds double precision,
  distance_meters double precision,
  calories double precision,
  avg_heart_rate integer,
  max_heart_rate integer,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function update_garmin_activity_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists garmin_activities_updated_at on garmin_activities;
create trigger garmin_activities_updated_at
before update on garmin_activities
for each row
execute function update_garmin_activity_updated_at();
