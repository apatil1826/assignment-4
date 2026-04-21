# Flight Tracker

Assignment 4 submission scaffold for MPCS 51238. This repo contains:

- `apps/web`: Next.js + Tailwind CSS frontend for Vercel
- `apps/worker`: Railway worker that polls OpenSky and writes to Supabase
- `supabase/schema.sql`: tables, triggers, RLS, and Realtime setup

## Local setup

1. Copy `.env.example` values into:
   - root `.env` for the worker
   - `apps/web/.env.local` for the frontend
2. Apply `supabase/schema.sql` to your Supabase project.
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
- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`
- `POLL_INTERVAL_MS`
- `OPENSKY_REGION_SLUGS`

## Supabase MCP

To satisfy the assignment workflow, configure the Supabase MCP server locally:

```bash
claude mcp add --transport http supabase https://mcp.supabase.com/mcp

## OpenSky note

OpenSky's currently published Terms of Use say operational REST API usage requires a written agreement. Since this assignment expects a public deployment classmates can use, confirm that your coursework use is permitted before using OpenSky for the final live URL.

## Remaining deployment steps

### 1. Run the Supabase schema

Open your Supabase project's SQL editor and run the full contents of [supabase/schema.sql](/Users/atharva/Documents/MPCS/MPCS%2051238%20-%20Design%20Build%20Ship/assignment-4/supabase/schema.sql).

This creates:

- `flight_snapshots`
- `worker_runs`
- `user_preferences`
- `favorite_flights`

It also:

- enables RLS
- provisions a `user_preferences` row for new users
- adds the tables to `supabase_realtime`

### 2. Configure Supabase Auth

In the Supabase dashboard:

- enable `Email` auth
- enable `Email + Password`
- add `http://localhost:3000` to allowed URLs
- add your Vercel production URL to allowed URLs

### 3. Deploy the Railway worker

Create a Railway service from this repo using the repository root as the service root.

Use these commands in Railway service settings:

- Build command: `npm run build:worker`
- Start command: `npm run start:worker`

Add these Railway environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`
- `POLL_INTERVAL_MS=300000`
- `OPENSKY_REGION_SLUGS=north-america,europe,asia-pacific`

### 4. Verify end-to-end

After the worker deploys:

- watch Railway logs for a successful sync
- confirm rows appear in `flight_snapshots`
- confirm a `worker_runs` row is inserted
- refresh the Vercel app and wait for realtime updates
```
