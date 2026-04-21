import type { RegionSlug } from "@/lib/constants";

export type WeatherLocation = {
  slug: string;
  name: string;
  region_slug: RegionSlug;
  country_code: string;
  timezone: string;
  latitude: number;
  longitude: number;
  sort_order: number;
};

export type WeatherSnapshot = {
  location_slug: string;
  observed_at: string;
  temperature_c: number;
  apparent_temperature_c: number;
  relative_humidity: number;
  precipitation_mm: number;
  weather_code: number;
  is_day: boolean;
  cloud_cover: number;
  surface_pressure_hpa: number | null;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  wind_gusts_kmh: number | null;
  daily_high_c: number | null;
  daily_low_c: number | null;
  daily_precip_probability: number | null;
  sunrise: string | null;
  sunset: string | null;
};

export type UserWeatherPreferences = {
  user_id: string;
  region_slug: RegionSlug;
  favorites_only: boolean;
  temperature_unit: "c" | "f";
  wind_unit: "kmh" | "mph";
  precipitation_unit: "mm" | "in";
};

export type FavoriteLocation = {
  user_id: string;
  location_slug: string;
  created_at: string;
};

export type WeatherWorkerRun = {
  id: string;
  region_slug: RegionSlug;
  status: "ok" | "error";
  locations_processed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string;
};
