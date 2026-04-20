export type RegionSlug =
  | "north-america"
  | "europe"
  | "asia-pacific";

export type RegionDefinition = {
  slug: RegionSlug;
  label: string;
  description: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
};

export const REGIONS: RegionDefinition[] = [
  {
    slug: "north-america",
    label: "North America",
    description: "Long-haul, domestic, and cross-border traffic across the US, Canada, and nearby airspace.",
    bounds: { minLat: 15, maxLat: 72, minLon: -168, maxLon: -52 },
  },
  {
    slug: "europe",
    label: "Europe",
    description: "Dense commercial traffic from Iberia through Central Europe and the Nordics.",
    bounds: { minLat: 34, maxLat: 72, minLon: -12, maxLon: 32 },
  },
  {
    slug: "asia-pacific",
    label: "Asia Pacific",
    description: "Major traffic arcs across East Asia, Southeast Asia, and the western Pacific.",
    bounds: { minLat: -10, maxLat: 55, minLon: 95, maxLon: 155 },
  },
];

export const DEFAULT_REGION: RegionSlug = "north-america";

export function getRegionBySlug(slug: string | null | undefined): RegionDefinition {
  return REGIONS.find((region) => region.slug === slug) ?? REGIONS[0];
}

export function formatAltitude(meters: number | null, unit: "ft" | "m") {
  if (meters === null || Number.isNaN(meters)) {
    return "Unknown";
  }

  if (unit === "m") {
    return `${Math.round(meters).toLocaleString()} m`;
  }

  return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
}

export function formatSpeed(metersPerSecond: number | null, unit: "kts" | "kmh") {
  if (metersPerSecond === null || Number.isNaN(metersPerSecond)) {
    return "Unknown";
  }

  if (unit === "kmh") {
    return `${Math.round(metersPerSecond * 3.6).toLocaleString()} km/h`;
  }

  return `${Math.round(metersPerSecond * 1.94384).toLocaleString()} kts`;
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
