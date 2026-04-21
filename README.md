# Weather Tracker

Assignment 4 submission scaffold for MPCS 51238. This repo now contains:

- `apps/web`: Next.js + Tailwind CSS frontend for Vercel
- `apps/worker`: Railway worker that polls Open-Meteo and writes to Supabase
- `supabase/schema.sql`: a reset migration that drops the old flight tables and creates the new weather tables

## Local setup

1. Copy `.env.example` values into:
   - root `.env` for the worker
   - `apps/web/.env.local` for the frontend
2. Apply `supabase/schema.sql` in your Supabase SQL editor.
3. Run the web app:
   - `npm run dev:web`
4. Run the worker:
   - `npm run dev:worker`

## Required environment variables

### Web

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Worker

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POLL_INTERVAL_MS`
- `FETCH_TIMEOUT_MS`
- `WEATHER_REGION_SLUGS`

## What the schema does

Running [supabase/schema.sql](/Users/atharva/Documents/MPCS/MPCS%2051238%20-%20Design%20Build%20Ship/assignment-4/supabase/schema.sql):

- drops the old flight tracker tables and functions
- creates:
  - `weather_locations`
  - `weather_snapshots`
  - `user_weather_preferences`
  - `favorite_locations`
  - `weather_worker_runs`
- sets RLS policies
- provisions a default preferences row for new auth users
- adds the weather tables to `supabase_realtime`

## Deployment

### Vercel

- import the repo
- set the root directory to `apps/web`
- add the two public Supabase env vars
- redeploy

### Railway

- build command: `npm run build:worker`
- start command: `npm run start:worker`
- add:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `POLL_INTERVAL_MS=300000`
  - `FETCH_TIMEOUT_MS=20000`
  - `WEATHER_REGION_SLUGS=north-america,europe,asia-pacific`

## Data source

This version uses the official Open-Meteo forecast API for current conditions and same-day highs/lows. Reference: [Open-Meteo Forecast API docs](https://open-meteo.com/en/docs).
