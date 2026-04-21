"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, Wind } from "lucide-react";

import { describeWeatherCode, formatPrecipitation, formatTemperature, formatWind, getRegionBySlug, type RegionSlug } from "@/lib/constants";
import type { WeatherLocation, WeatherSnapshot } from "@/lib/types";

type WeatherOverviewProps = {
  locations: Array<WeatherLocation & { snapshot: WeatherSnapshot | null }>;
  regionSlug: RegionSlug;
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  precipitationUnit: "mm" | "in";
};

export function WeatherOverview({
  locations,
  regionSlug,
  temperatureUnit,
  windUnit,
  precipitationUnit,
}: WeatherOverviewProps) {
  const region = getRegionBySlug(regionSlug);
  const featured = locations.slice(0, 3);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white/90 shadow-[0_24px_80px_rgba(68,58,42,0.06)]">
      <div className={`bg-gradient-to-br ${region.accent} p-6`}>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-600">Regional Weather</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-3xl text-stone-900">{region.label}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">{region.description}</p>
          </div>
          <div className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm text-stone-700 backdrop-blur">
            Curated city favorites with realtime refresh from Supabase
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {featured.map((location) => (
          <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5" key={location.slug}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">{location.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-stone-500">
                  {location.country_code} · {location.timezone}
                </p>
              </div>
              <WeatherGlyph code={location.snapshot?.weather_code ?? 3} />
            </div>

            {location.snapshot ? (
              <>
                <div className="mt-6 text-4xl font-semibold text-stone-900">
                  {formatTemperature(location.snapshot.temperature_c, temperatureUnit)}
                </div>
                <div className="mt-2 text-sm text-stone-600">{describeWeatherCode(location.snapshot.weather_code)}</div>
                <div className="mt-6 grid gap-3 text-sm text-stone-600">
                  <StatLine
                    label="Feels like"
                    value={formatTemperature(location.snapshot.apparent_temperature_c, temperatureUnit)}
                  />
                  <StatLine label="Wind" value={formatWind(location.snapshot.wind_speed_kmh, windUnit)} />
                  <StatLine
                    label="Precipitation"
                    value={formatPrecipitation(location.snapshot.precipitation_mm, precipitationUnit)}
                  />
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm text-stone-500">Waiting for the first worker sync for this city.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function WeatherGlyph({ code }: { code: number }) {
  if (code === 0) {
    return <Sun className="h-8 w-8 text-amber-500" />;
  }

  if ([45, 48].includes(code)) {
    return <CloudFog className="h-8 w-8 text-stone-500" />;
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return <CloudDrizzle className="h-8 w-8 text-cyan-600" />;
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return <CloudRain className="h-8 w-8 text-sky-600" />;
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return <CloudSnow className="h-8 w-8 text-indigo-500" />;
  }

  if ([95, 96, 99].includes(code)) {
    return <CloudLightning className="h-8 w-8 text-violet-600" />;
  }

  if ([1, 2, 3].includes(code)) {
    return <Cloud className="h-8 w-8 text-stone-500" />;
  }

  return <Wind className="h-8 w-8 text-stone-500" />;
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-full border border-stone-200 bg-white px-4 py-2">
      <span>{label}</span>
      <span className="font-medium text-stone-900">{value}</span>
    </div>
  );
}
