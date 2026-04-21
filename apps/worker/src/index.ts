import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

type RegionSlug = "north-america" | "europe" | "asia-pacific";

type Region = {
  slug: RegionSlug;
  bounds: {
    lamin: number;
    lomin: number;
    lamax: number;
    lomax: number;
  };
};

type OpenSkyState = [
  string,
  string | null,
  string,
  number | null,
  number,
  number | null,
  number | null,
  number | null,
  boolean,
  number | null,
  number | null,
  number | null,
  number[] | null,
  number | null,
  string | null,
  boolean,
  number | null,
  number | null,
];

type OpenSkyResponse = {
  time: number;
  states: OpenSkyState[] | null;
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openskyClientId = process.env.OPENSKY_CLIENT_ID;
const openskyClientSecret = process.env.OPENSKY_CLIENT_SECRET;
const pollIntervalMs = Number.parseInt(process.env.POLL_INTERVAL_MS ?? "300000", 10);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!openskyClientId || !openskyClientSecret) {
  throw new Error("Missing OPENSKY_CLIENT_ID or OPENSKY_CLIENT_SECRET.");
}

const allRegions: Region[] = [
  {
    slug: "north-america",
    bounds: { lamin: 15, lomin: -168, lamax: 72, lomax: -52 },
  },
  {
    slug: "europe",
    bounds: { lamin: 34, lomin: -12, lamax: 72, lomax: 32 },
  },
  {
    slug: "asia-pacific",
    bounds: { lamin: -10, lomin: 95, lamax: 55, lomax: 155 },
  },
];

const regionSlugs =
  process.env.OPENSKY_REGION_SLUGS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? allRegions.map((region) => region.slug);

const regions = allRegions.filter((region) => regionSlugs.includes(region.slug));

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let cachedToken: { value: string; expiresAt: number } | null = null;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

async function getOpenSkyToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const response = await fetch("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requireEnv(openskyClientId, "OPENSKY_CLIENT_ID"),
      client_secret: requireEnv(openskyClientSecret, "OPENSKY_CLIENT_SECRET"),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenSky auth failed with ${response.status}.`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  };

  return cachedToken.value;
}

async function fetchRegionStates(region: Region) {
  const token = await getOpenSkyToken();
  const params = new URLSearchParams({
    lamin: String(region.bounds.lamin),
    lomin: String(region.bounds.lomin),
    lamax: String(region.bounds.lamax),
    lomax: String(region.bounds.lomax),
    extended: "1",
  });

  const response = await fetch(`https://opensky-network.org/api/states/all?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenSky states request failed for ${region.slug} with ${response.status}.`);
  }

  return (await response.json()) as OpenSkyResponse;
}

function toIsoTimestamp(unixSeconds: number | null) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

function normalizeStates(region: Region, payload: OpenSkyResponse) {
  const observedAt = new Date(payload.time * 1000).toISOString();

  return (payload.states ?? [])
    .filter((state) => state[5] !== null && state[6] !== null)
    .map((state) => ({
      icao24: state[0],
      callsign: state[1]?.trim() || null,
      origin_country: state[2],
      region_slug: region.slug,
      longitude: state[5],
      latitude: state[6],
      baro_altitude_m: state[7],
      geo_altitude_m: state[13],
      velocity_mps: state[9],
      vertical_rate_mps: state[11],
      true_track: state[10],
      on_ground: state[8],
      squawk: state[14],
      position_source: state[16],
      category: state[17],
      time_position: toIsoTimestamp(state[3]),
      last_contact: toIsoTimestamp(state[4]) ?? observedAt,
      observed_at: observedAt,
    }));
}

async function recordWorkerRun(regionSlug: RegionSlug, status: "ok" | "error", flightsProcessed: number, errorMessage?: string) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("worker_runs").insert({
    region_slug: regionSlug,
    status,
    flights_processed: flightsProcessed,
    error_message: errorMessage ?? null,
    started_at: now,
    completed_at: now,
  });

  if (error) {
    console.error("Failed to record worker run", error.message);
  }
}

async function syncRegion(region: Region) {
  try {
    const payload = await fetchRegionStates(region);
    const flights = normalizeStates(region, payload);

    if (flights.length > 0) {
      const { error } = await supabase.from("flight_snapshots").upsert(flights, {
        onConflict: "icao24",
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    const staleThreshold = new Date(Date.now() - pollIntervalMs * 3).toISOString();
    const { error: deleteError } = await supabase
      .from("flight_snapshots")
      .delete()
      .eq("region_slug", region.slug)
      .lt("observed_at", staleThreshold);

    if (deleteError) {
      console.error("Failed to delete stale flights", deleteError.message);
    }

    await recordWorkerRun(region.slug, "ok", flights.length);
    console.log(`[${new Date().toISOString()}] Synced ${flights.length} flights for ${region.slug}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    await recordWorkerRun(region.slug, "error", 0, message);
    console.error(`[${new Date().toISOString()}] ${region.slug} sync failed: ${message}`);
  }
}

async function runOnce() {
  for (const region of regions) {
    await syncRegion(region);
  }
}

async function main() {
  if (regions.length === 0) {
    throw new Error("No OpenSky regions configured.");
  }

  await runOnce();
  setInterval(() => {
    void runOnce();
  }, pollIntervalMs);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
