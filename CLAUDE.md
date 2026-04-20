# Flight Tracker Architecture

## Goal

Build a multi-service flight tracker that polls live aircraft state vectors, stores the latest snapshot in Supabase, and pushes updates to authenticated users in real time.

## Services

### `apps/web`

- Next.js App Router frontend deployed to Vercel.
- Tailwind CSS for the UI.
- Supabase Auth for sign up, sign in, and session management.
- Supabase Realtime subscriptions for live flight updates.
- Personalized dashboard driven by:
  - `user_preferences` for region and unit preferences
  - `favorite_flights` for per-user saved aircraft

### `apps/worker`

- Node.js worker deployed to Railway.
- Polls OpenSky's `/states/all` endpoint on an interval using OAuth client credentials.
- Fetches curated regional bounding boxes to control API credit usage.
- Normalizes aircraft state vectors and upserts them into `public.flight_snapshots`.
- Records health and freshness data in `public.worker_runs`.

## Data Flow

1. Railway starts the worker on a fixed interval.
2. The worker authenticates with OpenSky and requests live state vectors for configured regions.
3. The worker transforms each state vector into a typed flight snapshot.
4. The worker upserts flight snapshots into Supabase using the service role key.
5. Authenticated users load their preferences and the current regional flight list from Supabase.
6. The frontend subscribes to Realtime changes on `flight_snapshots`, `user_preferences`, and `favorite_flights`.
7. Any database change is reflected on screen without a refresh.

## Tables

### `flight_snapshots`

- Current aircraft state keyed by `icao24`
- Includes position, velocity, altitude, heading, callsign, and region
- Readable by authenticated users

### `user_preferences`

- One row per authenticated user
- Stores selected region, favorites-only toggle, unit choices, and whether to show grounded aircraft

### `favorite_flights`

- Join table between `auth.users` and tracked aircraft
- Used to surface saved aircraft per user

### `worker_runs`

- Operational visibility for the most recent worker runs
- Used by the dashboard to show freshness and worker status

## Realtime Strategy

- Realtime is enabled on `flight_snapshots`, `user_preferences`, `favorite_flights`, and `worker_runs`.
- The frontend keeps a local copy of the current region's flights and re-fetches when relevant changes arrive.
- This keeps the UI simple and robust while still meeting the realtime requirement.

## Security

- Supabase Auth gates dashboard access.
- Row Level Security allows users to read shared flight data while restricting preferences and favorites to the owning user.
- The worker uses the service role key and bypasses RLS for writes.

## Deployment

- Vercel:
  - Root directory: `apps/web`
  - Build command: default Next.js build
  - Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- Railway:
  - Root directory: repository root or `apps/worker`
  - Build command: `npm run build:worker`
  - Start command: `npm run start:worker`
  - Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `POLL_INTERVAL_MS`, `OPENSKY_REGION_SLUGS`

## Notes

- OpenSky's current API documentation uses OAuth client credentials and a credit-based quota model, so the worker polls curated regions every 5 minutes by default.
- OpenSky's current Terms of Use also state that operational REST API use requires a written agreement, so confirm the course usage is covered before making the public deployment your final submission.
- If you want to satisfy the assignment item for Supabase MCP, add the server locally with:
  - `claude mcp add --transport http supabase https://mcp.supabase.com/mcp`
