create extension if not exists "pgcrypto";

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user cascade;
drop function if exists public.handle_new_weather_user cascade;
drop function if exists public.set_updated_at cascade;

drop table if exists public.favorite_flights cascade;
drop table if exists public.flight_snapshots cascade;
drop table if exists public.worker_runs cascade;
drop table if exists public.user_preferences cascade;

drop table if exists public.favorite_locations cascade;
drop table if exists public.weather_snapshots cascade;
drop table if exists public.weather_worker_runs cascade;
drop table if exists public.user_weather_preferences cascade;
drop table if exists public.weather_locations cascade;

create table public.weather_locations (
  slug text primary key,
  name text not null,
  region_slug text not null,
  country_code text not null,
  timezone text not null,
  latitude double precision not null,
  longitude double precision not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.weather_snapshots (
  location_slug text primary key references public.weather_locations (slug) on delete cascade,
  observed_at timestamptz not null,
  temperature_c double precision not null,
  apparent_temperature_c double precision not null,
  relative_humidity integer not null,
  precipitation_mm double precision not null,
  weather_code integer not null,
  is_day boolean not null,
  cloud_cover integer not null,
  surface_pressure_hpa double precision,
  wind_speed_kmh double precision not null,
  wind_direction_deg integer not null,
  wind_gusts_kmh double precision,
  daily_high_c double precision,
  daily_low_c double precision,
  daily_precip_probability integer,
  sunrise timestamptz,
  sunset timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_weather_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  region_slug text not null default 'north-america',
  favorites_only boolean not null default false,
  temperature_unit text not null default 'f' check (temperature_unit in ('c', 'f')),
  wind_unit text not null default 'mph' check (wind_unit in ('kmh', 'mph')),
  precipitation_unit text not null default 'mm' check (precipitation_unit in ('mm', 'in')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorite_locations (
  user_id uuid not null references auth.users (id) on delete cascade,
  location_slug text not null references public.weather_locations (slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_slug)
);

create table public.weather_worker_runs (
  id uuid primary key default gen_random_uuid(),
  region_slug text not null,
  status text not null check (status in ('ok', 'error')),
  locations_processed integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
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

create trigger weather_snapshots_set_updated_at
before update on public.weather_snapshots
for each row
execute function public.set_updated_at();

create trigger user_weather_preferences_set_updated_at
before update on public.user_weather_preferences
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_weather_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_weather_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_weather_user();

alter table public.weather_locations enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.user_weather_preferences enable row level security;
alter table public.favorite_locations enable row level security;
alter table public.weather_worker_runs enable row level security;

create policy "authenticated users can read weather locations"
on public.weather_locations
for select
to authenticated
using (true);

create policy "authenticated users can read weather snapshots"
on public.weather_snapshots
for select
to authenticated
using (true);

create policy "authenticated users can read weather worker runs"
on public.weather_worker_runs
for select
to authenticated
using (true);

create policy "users can read own weather preferences"
on public.user_weather_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can insert own weather preferences"
on public.user_weather_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update own weather preferences"
on public.user_weather_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can read own favorite locations"
on public.favorite_locations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can add own favorite locations"
on public.favorite_locations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can delete own favorite locations"
on public.favorite_locations
for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weather_locations'
  ) then
    alter publication supabase_realtime add table public.weather_locations;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weather_snapshots'
  ) then
    alter publication supabase_realtime add table public.weather_snapshots;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_weather_preferences'
  ) then
    alter publication supabase_realtime add table public.user_weather_preferences;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'favorite_locations'
  ) then
    alter publication supabase_realtime add table public.favorite_locations;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weather_worker_runs'
  ) then
    alter publication supabase_realtime add table public.weather_worker_runs;
  end if;
end
$$;
