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
```
