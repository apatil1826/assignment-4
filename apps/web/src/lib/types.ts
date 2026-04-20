import type { RegionSlug } from "@/lib/constants";

export type FlightSnapshot = {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  region_slug: RegionSlug;
  longitude: number | null;
  latitude: number | null;
  baro_altitude_m: number | null;
  geo_altitude_m: number | null;
  velocity_mps: number | null;
  vertical_rate_mps: number | null;
  true_track: number | null;
  on_ground: boolean;
  squawk: string | null;
  position_source: number | null;
  category: number | null;
  time_position: string | null;
  last_contact: string;
  observed_at: string;
};

export type UserPreferences = {
  user_id: string;
  region_slug: RegionSlug;
  favorites_only: boolean;
  show_ground_traffic: boolean;
  altitude_unit: "ft" | "m";
  speed_unit: "kts" | "kmh";
};

export type FavoriteFlight = {
  user_id: string;
  icao24: string;
  created_at: string;
};

export type WorkerRun = {
  id: string;
  region_slug: RegionSlug;
  status: "ok" | "error";
  flights_processed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string;
};
