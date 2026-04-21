export type RegionSlug = "north-america" | "europe" | "asia-pacific";

export type RegionDefinition = {
  slug: RegionSlug;
  label: string;
  description: string;
  accent: string;
};

export const REGIONS: RegionDefinition[] = [
  {
    slug: "north-america",
    label: "North America",
    description: "Monitor major cities across the US and Canada with fresh model-based conditions every few minutes.",
    accent: "from-sky-200 via-cyan-100 to-white",
  },
  {
    slug: "europe",
    label: "Europe",
    description: "Follow temperature, wind, and precipitation signals across high-traffic European hubs.",
    accent: "from-emerald-200 via-teal-100 to-white",
  },
  {
    slug: "asia-pacific",
    label: "Asia Pacific",
    description: "Track weather shifts across dense coastal and inland population centers in the Asia Pacific region.",
    accent: "from-amber-200 via-orange-100 to-white",
  },
];

export const DEFAULT_REGION: RegionSlug = "north-america";

export function getRegionBySlug(slug: string | null | undefined): RegionDefinition {
  return REGIONS.find((region) => region.slug === slug) ?? REGIONS[0];
}

export function formatTemperature(celsius: number | null, unit: "c" | "f") {
  if (celsius === null || Number.isNaN(celsius)) {
    return "Unknown";
  }

  if (unit === "c") {
    return `${Math.round(celsius)}°C`;
  }

  return `${Math.round((celsius * 9) / 5 + 32)}°F`;
}

export function formatWind(kmh: number | null, unit: "kmh" | "mph") {
  if (kmh === null || Number.isNaN(kmh)) {
    return "Unknown";
  }

  if (unit === "kmh") {
    return `${Math.round(kmh)} km/h`;
  }

  return `${Math.round(kmh * 0.621371)} mph`;
}

export function formatPrecipitation(mm: number | null, unit: "mm" | "in") {
  if (mm === null || Number.isNaN(mm)) {
    return "0";
  }

  if (unit === "in") {
    return `${(mm * 0.0393701).toFixed(2)} in`;
  }

  return `${mm.toFixed(1)} mm`;
}

export function formatRelativeSync(timestamp: string | null) {
  if (!timestamp) {
    return "Waiting for first worker run";
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Updated just now";
  }

  if (diffMinutes === 1) {
    return "Updated 1 minute ago";
  }

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} minutes ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  return `Updated ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
}

export function describeWeatherCode(code: number) {
  if (code === 0) {
    return "Clear";
  }

  if ([1, 2, 3].includes(code)) {
    return "Cloudy";
  }

  if ([45, 48].includes(code)) {
    return "Fog";
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return "Drizzle";
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "Rain";
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "Snow";
  }

  if ([95, 96, 99].includes(code)) {
    return "Thunderstorm";
  }

  return "Mixed";
}
