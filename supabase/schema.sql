create extension if not exists "pgcrypto";

create table if not exists public.flight_snapshots (
  icao24 text primary key,
  callsign text,
  origin_country text not null,
  region_slug text not null,
  longitude double precision,
  latitude double precision,
  baro_altitude_m double precision,
  geo_altitude_m double precision,
  velocity_mps double precision,
  vertical_rate_mps double precision,
  true_track double precision,
  on_ground boolean not null default false,
  squawk text,
  position_source integer,
  category integer,
  time_position timestamptz,
  last_contact timestamptz not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_runs (
  id uuid primary key default gen_random_uuid(),
  region_slug text not null,
  status text not null check (status in ('ok', 'error')),
  flights_processed integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  region_slug text not null default 'north-america',
  favorites_only boolean not null default false,
  show_ground_traffic boolean not null default false,
  altitude_unit text not null default 'ft' check (altitude_unit in ('ft', 'm')),
  speed_unit text not null default 'kts' check (speed_unit in ('kts', 'kmh')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorite_flights (
  user_id uuid not null references auth.users (id) on delete cascade,
  icao24 text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, icao24)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists flight_snapshots_set_updated_at on public.flight_snapshots;
create trigger flight_snapshots_set_updated_at
before update on public.flight_snapshots
for each row
execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.flight_snapshots enable row level security;
alter table public.worker_runs enable row level security;
alter table public.user_preferences enable row level security;
alter table public.favorite_flights enable row level security;

drop policy if exists "authenticated users can read flights" on public.flight_snapshots;
create policy "authenticated users can read flights"
on public.flight_snapshots
for select
to authenticated
using (true);

drop policy if exists "authenticated users can read worker runs" on public.worker_runs;
create policy "authenticated users can read worker runs"
on public.worker_runs
for select
to authenticated
using (true);

drop policy if exists "users can read own preferences" on public.user_preferences;
create policy "users can read own preferences"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can insert own preferences" on public.user_preferences;
create policy "users can insert own preferences"
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own preferences" on public.user_preferences;
create policy "users can update own preferences"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users can read own favorites" on public.favorite_flights;
create policy "users can read own favorites"
on public.favorite_flights
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can add own favorites" on public.favorite_flights;
create policy "users can add own favorites"
on public.favorite_flights
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own favorites" on public.favorite_flights;
create policy "users can delete own favorites"
on public.favorite_flights
for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'flight_snapshots'
  ) then
    alter publication supabase_realtime add table public.flight_snapshots;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'worker_runs'
  ) then
    alter publication supabase_realtime add table public.worker_runs;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_preferences'
  ) then
    alter publication supabase_realtime add table public.user_preferences;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'favorite_flights'
  ) then
    alter publication supabase_realtime add table public.favorite_flights;
  end if;
end
$$;
