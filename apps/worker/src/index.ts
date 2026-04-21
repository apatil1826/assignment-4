import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

type RegionSlug = "north-america" | "europe" | "asia-pacific";

type LocationSeed = {
  slug: string;
  name: string;
  region_slug: RegionSlug;
  country_code: string;
  timezone: string;
  latitude: number;
  longitude: number;
  sort_order: number;
};

type OpenMeteoResponse = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    is_day: number;
    cloud_cover: number;
    surface_pressure: number | null;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number | null;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
  };
};

type OpenMeteoBatchResponse = OpenMeteoResponse | OpenMeteoResponse[];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pollIntervalMs = Number.parseInt(process.env.POLL_INTERVAL_MS ?? "300000", 10);
const fetchTimeoutMs = Number.parseInt(process.env.FETCH_TIMEOUT_MS ?? "20000", 10);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const locations: LocationSeed[] = [
  {
    slug: "chicago-us",
    name: "Chicago",
    region_slug: "north-america",
    country_code: "US",
    timezone: "America/Chicago",
    latitude: 41.8781,
    longitude: -87.6298,
    sort_order: 1,
  },
  {
    slug: "new-york-us",
    name: "New York",
    region_slug: "north-america",
    country_code: "US",
    timezone: "America/New_York",
    latitude: 40.7128,
    longitude: -74.006,
    sort_order: 2,
  },
  {
    slug: "san-francisco-us",
    name: "San Francisco",
    region_slug: "north-america",
    country_code: "US",
    timezone: "America/Los_Angeles",
    latitude: 37.7749,
    longitude: -122.4194,
    sort_order: 3,
  },
  {
    slug: "toronto-ca",
    name: "Toronto",
    region_slug: "north-america",
    country_code: "CA",
    timezone: "America/Toronto",
    latitude: 43.6532,
    longitude: -79.3832,
    sort_order: 4,
  },
  {
    slug: "london-gb",
    name: "London",
    region_slug: "europe",
    country_code: "GB",
    timezone: "Europe/London",
    latitude: 51.5072,
    longitude: -0.1276,
    sort_order: 1,
  },
  {
    slug: "paris-fr",
    name: "Paris",
    region_slug: "europe",
    country_code: "FR",
    timezone: "Europe/Paris",
    latitude: 48.8566,
    longitude: 2.3522,
    sort_order: 2,
  },
  {
    slug: "berlin-de",
    name: "Berlin",
    region_slug: "europe",
    country_code: "DE",
    timezone: "Europe/Berlin",
    latitude: 52.52,
    longitude: 13.405,
    sort_order: 3,
  },
  {
    slug: "tokyo-jp",
    name: "Tokyo",
    region_slug: "asia-pacific",
    country_code: "JP",
    timezone: "Asia/Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
    sort_order: 1,
  },
  {
    slug: "singapore-sg",
    name: "Singapore",
    region_slug: "asia-pacific",
    country_code: "SG",
    timezone: "Asia/Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
    sort_order: 2,
  },
  {
    slug: "sydney-au",
    name: "Sydney",
    region_slug: "asia-pacific",
    country_code: "AU",
    timezone: "Australia/Sydney",
    latitude: -33.8688,
    longitude: 151.2093,
    sort_order: 3,
  },
];

const regionSlugs =
  process.env.WEATHER_REGION_SLUGS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? ["north-america", "europe", "asia-pacific"];

const enabledLocations = locations.filter((location) => regionSlugs.includes(location.region_slug));
const enabledRegions = [...new Set(enabledLocations.map((location) => location.region_slug))] as RegionSlug[];

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    const cause =
      typeof error.cause === "object" && error.cause !== null && "message" in error.cause
        ? String(error.cause.message)
        : null;

    return cause ? `${error.message} (${cause})` : error.message;
  }

  return "Unknown worker error";
}

async function fetchWithRetry(url: string, label: string, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);

      if (attempt === maxAttempts) {
        throw new Error(`${label} failed after ${maxAttempts} attempts: ${formatError(error)}`);
      }

      await sleep(750 * attempt);
    }
  }

  throw new Error(`${label} failed unexpectedly.`);
}

async function seedLocations() {
  const { error } = await supabase.from("weather_locations").upsert(enabledLocations, {
    onConflict: "slug",
  });

  if (error) {
    throw new Error(`Failed to seed weather locations: ${error.message}`);
  }
}

async function fetchRegionForecasts(regionLocations: LocationSeed[]) {
  const params = new URLSearchParams({
    latitude: regionLocations.map((location) => String(location.latitude)).join(","),
    longitude: regionLocations.map((location) => String(location.longitude)).join(","),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: regionLocations.map((location) => location.timezone).join(","),
    forecast_days: "1",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });

  const response = await fetchWithRetry(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    `Open-Meteo forecast request for ${regionLocations[0]?.region_slug ?? "region"}`,
  );

  if (!response.ok) {
    throw new Error(`Open-Meteo forecast failed for ${regionLocations[0]?.region_slug ?? "region"} with ${response.status}.`);
  }

  const payload = (await response.json()) as OpenMeteoBatchResponse;
  return Array.isArray(payload) ? payload : [payload];
}

function normalizeSnapshot(location: LocationSeed, payload: OpenMeteoResponse) {
  return {
    location_slug: location.slug,
    observed_at: payload.current.time,
    temperature_c: payload.current.temperature_2m,
    apparent_temperature_c: payload.current.apparent_temperature,
    relative_humidity: payload.current.relative_humidity_2m,
    precipitation_mm: payload.current.precipitation,
    weather_code: payload.current.weather_code,
    is_day: payload.current.is_day === 1,
    cloud_cover: payload.current.cloud_cover,
    surface_pressure_hpa: payload.current.surface_pressure,
    wind_speed_kmh: payload.current.wind_speed_10m,
    wind_direction_deg: payload.current.wind_direction_10m,
    wind_gusts_kmh: payload.current.wind_gusts_10m,
    daily_high_c: payload.daily.temperature_2m_max[0] ?? null,
    daily_low_c: payload.daily.temperature_2m_min[0] ?? null,
    daily_precip_probability: payload.daily.precipitation_probability_max[0] ?? null,
    sunrise: payload.daily.sunrise[0] ?? null,
    sunset: payload.daily.sunset[0] ?? null,
  };
}

async function recordWorkerRun(regionSlug: RegionSlug, status: "ok" | "error", locationsProcessed: number, errorMessage?: string) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("weather_worker_runs").insert({
    region_slug: regionSlug,
    status,
    locations_processed: locationsProcessed,
    error_message: errorMessage ?? null,
    started_at: now,
    completed_at: now,
  });

  if (error) {
    console.error("Failed to record weather worker run", error.message);
  }
}

async function syncRegion(regionSlug: RegionSlug) {
  const regionLocations = enabledLocations.filter((location) => location.region_slug === regionSlug);

  try {
    const payloads = await fetchRegionForecasts(regionLocations);

    if (payloads.length !== regionLocations.length) {
      throw new Error(`Open-Meteo returned ${payloads.length} payloads for ${regionLocations.length} locations in ${regionSlug}.`);
    }

    const snapshots = regionLocations.map((location, index) => normalizeSnapshot(location, payloads[index]));

    const { error } = await supabase.from("weather_snapshots").upsert(snapshots, {
      onConflict: "location_slug",
    });

    if (error) {
      throw new Error(error.message);
    }

    await recordWorkerRun(regionSlug, "ok", snapshots.length);
    console.log(`[${new Date().toISOString()}] Synced ${snapshots.length} weather snapshots for ${regionSlug}`);
  } catch (error) {
    const message = formatError(error);
    await recordWorkerRun(regionSlug, "error", 0, message);
    console.error(`[${new Date().toISOString()}] ${regionSlug} sync failed: ${message}`);
  }
}

async function runOnce() {
  await seedLocations();

  for (const regionSlug of enabledRegions) {
    await syncRegion(regionSlug);
  }
}

async function main() {
  if (enabledLocations.length === 0) {
    throw new Error("No weather locations configured.");
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
