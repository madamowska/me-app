-- Consolidation: garmin data lives in public.activities (has profile_id FK
-- and garmin_activity_id already). The standalone garmin_activities table
-- was a duplicate that never went through a proper migration.
drop table if exists public.garmin_activities cascade;

-- Formalize garmin_sync_state as a real migration (previously only existed
-- as a raw .sql file in backend/, never applied via `supabase migration`).
create table if not exists public.garmin_sync_state (
  source text primary key,
  last_synced_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.update_garmin_sync_state_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists garmin_sync_state_updated_at on public.garmin_sync_state;
create trigger garmin_sync_state_updated_at
before update on public.garmin_sync_state
for each row
execute function public.update_garmin_sync_state_updated_at();