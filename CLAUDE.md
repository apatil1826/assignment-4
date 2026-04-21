# Weather Tracker Architecture

## Goal

Build a multi-service weather tracker that polls live forecast data, stores the latest conditions in Supabase, and pushes updates to authenticated users in realtime.

## Services

### `apps/web`

- Next.js App Router frontend deployed to Vercel
- Tailwind CSS for the UI
- Supabase Auth for sign up, sign in, and session management
- Supabase Realtime subscriptions for live weather updates
- Personalized dashboard driven by:
  - `user_weather_preferences`
  - `favorite_locations`

### `apps/worker`

- Node.js worker deployed to Railway
- Polls Open-Meteo forecast endpoints for a curated set of cities
- Seeds the city catalog into `weather_locations`
- Upserts current conditions and same-day summary data into `weather_snapshots`
- Records worker health in `weather_worker_runs`

## Data Flow

1. Railway starts the worker on a fixed interval.
2. The worker seeds the curated city list into Supabase.
3. The worker fetches current and daily forecast data from Open-Meteo for each city.
4. The worker normalizes and upserts weather snapshots into Supabase.
5. The frontend loads the user's preferences, favorites, weather locations, and weather snapshots.
6. Supabase Realtime pushes table changes to the frontend without a page refresh.

## Tables

### `weather_locations`

- Curated city catalog used by the worker and frontend

### `weather_snapshots`

- Latest current conditions and same-day weather summary per city

### `user_weather_preferences`

- Per-user region and unit preferences

### `favorite_locations`

- Per-user favorite city list

### `weather_worker_runs`

- Operational run history used to surface freshness and failures

## Security

- Supabase Auth gates dashboard access
- RLS allows authenticated users to read shared weather data
- Preferences and favorites are scoped to the owning user
- The Railway worker writes with the Supabase service role key

## Deployment

- Vercel hosts the frontend from `apps/web`
- Railway runs the worker from the repository root using workspace scripts
- Supabase stores auth, realtime, and weather data

## Notes

- Open-Meteo does not require API credentials for this assignment architecture.
- The worker polls every 5 minutes by default and uses a small curated set of cities to keep the interface focused and fast.
