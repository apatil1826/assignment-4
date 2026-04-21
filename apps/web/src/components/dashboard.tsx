"use client";

import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import type { Session } from "@supabase/supabase-js";
import { Droplets, LoaderCircle, LogOut, Search, Star, Thermometer, Wind } from "lucide-react";

import {
  DEFAULT_REGION,
  REGIONS,
  describeWeatherCode,
  formatPrecipitation,
  formatRelativeSync,
  formatTemperature,
  formatWind,
  type RegionSlug,
} from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import type {
  FavoriteLocation,
  UserWeatherPreferences,
  WeatherLocation,
  WeatherSnapshot,
  WeatherWorkerRun,
} from "@/lib/types";
import { WeatherOverview } from "@/components/weather-overview";

type DashboardProps = {
  session: Session;
};

type WeatherCard = WeatherLocation & {
  snapshot: WeatherSnapshot | null;
};

const defaultPreferences: Omit<UserWeatherPreferences, "user_id"> = {
  region_slug: DEFAULT_REGION,
  favorites_only: false,
  temperature_unit: "f",
  wind_unit: "mph",
  precipitation_unit: "mm",
};

export function Dashboard({ session }: DashboardProps) {
  const [preferences, setPreferences] = useState<Omit<UserWeatherPreferences, "user_id">>(defaultPreferences);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [weatherCards, setWeatherCards] = useState<WeatherCard[]>([]);
  const [workerRun, setWorkerRun] = useState<WeatherWorkerRun | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const favoriteSet = useMemo(() => new Set(favorites.map((favorite) => favorite.location_slug)), [favorites]);

  const ensurePreferencesRow = useCallback(async () => {
    const { error: upsertError } = await supabase.from("user_weather_preferences").upsert(
      {
        user_id: session.user.id,
        ...defaultPreferences,
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      setError(upsertError.message);
    }
  }, [session.user.id]);

  const refreshFavorites = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("favorite_locations").select("*").eq("user_id", session.user.id);

    if (!queryError) {
      setFavorites(data ?? []);
    }
  }, [session.user.id]);

  const refreshPreferences = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("user_weather_preferences")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (queryError) {
      return;
    }

    if (!data) {
      await ensurePreferencesRow();
      return;
    }

    setPreferences({
      region_slug: data.region_slug,
      favorites_only: data.favorites_only,
      temperature_unit: data.temperature_unit,
      wind_unit: data.wind_unit,
      precipitation_unit: data.precipitation_unit,
    });
  }, [ensurePreferencesRow, session.user.id]);

  const refreshRegionData = useCallback(async (regionSlug: RegionSlug) => {
    const [locationsResult, workerRunResult] = await Promise.all([
      supabase.from("weather_locations").select("*").eq("region_slug", regionSlug).order("sort_order"),
      supabase
        .from("weather_worker_runs")
        .select("*")
        .eq("region_slug", regionSlug)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (locationsResult.error || workerRunResult.error) {
      setError(locationsResult.error?.message ?? workerRunResult.error?.message ?? "Unable to load weather data.");
      return;
    }

    const locations = (locationsResult.data ?? []) as WeatherLocation[];
    const slugs = locations.map((location) => location.slug);

    if (slugs.length === 0) {
      setWeatherCards([]);
      setWorkerRun(workerRunResult.data ?? null);
      return;
    }

    const { data: snapshotData, error: snapshotError } = await supabase
      .from("weather_snapshots")
      .select("*")
      .in("location_slug", slugs);

    if (snapshotError) {
      setError(snapshotError.message);
      return;
    }

    const snapshotMap = new Map((snapshotData as WeatherSnapshot[]).map((snapshot) => [snapshot.location_slug, snapshot]));

    setWeatherCards(
      locations.map((location) => ({
        ...location,
        snapshot: snapshotMap.get(location.slug) ?? null,
      })),
    );
    setWorkerRun(workerRunResult.data ?? null);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadAll() {
      setIsLoading(true);
      setError(null);

      const { data: preferencesData, error: preferencesError } = await supabase
        .from("user_weather_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      if (preferencesError) {
        setError(preferencesError.message);
        setIsLoading(false);
        return;
      }

      const nextPreferences = preferencesData
        ? {
            region_slug: preferencesData.region_slug,
            favorites_only: preferencesData.favorites_only,
            temperature_unit: preferencesData.temperature_unit,
            wind_unit: preferencesData.wind_unit,
            precipitation_unit: preferencesData.precipitation_unit,
          }
        : defaultPreferences;

      setPreferences(nextPreferences);

      if (!preferencesData) {
        await ensurePreferencesRow();
      }

      await Promise.all([refreshFavorites(), refreshRegionData(nextPreferences.region_slug)]);
      setIsLoading(false);
    }

    void loadAll();

    const channel = supabase
      .channel(`weather-dashboard-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "weather_snapshots" }, () => {
        void refreshRegionData(preferences.region_slug);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "weather_locations" }, () => {
        void refreshRegionData(preferences.region_slug);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weather_worker_runs", filter: `region_slug=eq.${preferences.region_slug}` },
        () => {
          void refreshRegionData(preferences.region_slug);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorite_locations", filter: `user_id=eq.${session.user.id}` },
        () => {
          void refreshFavorites();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_weather_preferences", filter: `user_id=eq.${session.user.id}` },
        () => {
          void refreshPreferences();
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [ensurePreferencesRow, preferences.region_slug, refreshFavorites, refreshPreferences, refreshRegionData, session.user.id]);

  function updatePreference<K extends keyof Omit<UserWeatherPreferences, "user_id">>(
    key: K,
    value: Omit<UserWeatherPreferences, "user_id">[K],
  ) {
    const nextPreferences = { ...preferences, [key]: value };
    setPreferences(nextPreferences);

    startTransition(async () => {
      const { error: upsertError } = await supabase.from("user_weather_preferences").upsert(
        {
          user_id: session.user.id,
          ...nextPreferences,
        },
        { onConflict: "user_id" },
      );

      if (upsertError) {
        setError(upsertError.message);
        return;
      }

      if (key === "region_slug") {
        await refreshRegionData(value as RegionSlug);
      }
    });
  }

  function toggleFavorite(locationSlug: string) {
    const isFavorite = favoriteSet.has(locationSlug);

    startTransition(async () => {
      const result = isFavorite
        ? await supabase.from("favorite_locations").delete().eq("user_id", session.user.id).eq("location_slug", locationSlug)
        : await supabase.from("favorite_locations").insert({ user_id: session.user.id, location_slug: locationSlug });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      await refreshFavorites();
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const visibleCards = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return weatherCards
      .filter((card) => (preferences.favorites_only ? favoriteSet.has(card.slug) : true))
      .filter((card) => {
        if (!normalizedSearch) {
          return true;
        }

        return [card.name, card.slug, card.country_code].some((value) => value.toLowerCase().includes(normalizedSearch));
      });
  }, [deferredSearch, favoriteSet, preferences.favorites_only, weatherCards]);

  const liveLocations = visibleCards.filter((card) => card.snapshot !== null).length;
  const hottestLocation =
    visibleCards.filter((card) => card.snapshot).sort((left, right) => (right.snapshot?.temperature_c ?? -999) - (left.snapshot?.temperature_c ?? -999))[0] ??
    null;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[2rem] border border-stone-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(68,58,42,0.08)] backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Weather Tracker</p>
          <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Live city weather with a personal watchlist.</h1>
          <p className="max-w-2xl text-base leading-8 text-stone-600">
            Signed in as <span className="font-medium text-stone-900">{session.user.email}</span>. Pick a region, favorite
            the cities you care about, and let Supabase Realtime keep the conditions fresh.
          </p>
          <div className="flex flex-wrap gap-3">
            <MetricCard label="Live cities" value={String(liveLocations)} />
            <MetricCard label="Favorites" value={String(favoriteSet.size)} />
            <MetricCard label="Top temperature" value={hottestLocation?.snapshot ? formatTemperature(hottestLocation.snapshot.temperature_c, preferences.temperature_unit) : "Soon"} />
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Sync</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">{formatRelativeSync(workerRun?.completed_at ?? null)}</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              onClick={() => void handleSignOut()}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
          <p className="text-sm leading-6 text-stone-500">
            The Railway worker polls Open-Meteo, writes fresh conditions to Supabase, and the dashboard updates without a
            page refresh.
          </p>
          {workerRun?.error_message ? <p className="mt-3 text-sm text-rose-700">{workerRun.error_message}</p> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_24px_80px_rgba(68,58,42,0.06)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Preferences</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">Tune your weather feed</h2>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">Region</span>
              <select
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 outline-none"
                onChange={(event) => updatePreference("region_slug", event.target.value as RegionSlug)}
                value={preferences.region_slug}
              >
                {REGIONS.map((region) => (
                  <option key={region.slug} value={region.slug}>
                    {region.label}
                  </option>
                ))}
              </select>
            </label>

            <Toggle
              checked={preferences.favorites_only}
              label="Favorites only"
              onChange={(checked) => updatePreference("favorites_only", checked)}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">Temperature</span>
              <select
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 outline-none"
                onChange={(event) => updatePreference("temperature_unit", event.target.value as "c" | "f")}
                value={preferences.temperature_unit}
              >
                <option value="f">Fahrenheit</option>
                <option value="c">Celsius</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">Wind</span>
              <select
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 outline-none"
                onChange={(event) => updatePreference("wind_unit", event.target.value as "kmh" | "mph")}
                value={preferences.wind_unit}
              >
                <option value="mph">mph</option>
                <option value="kmh">km/h</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">Precipitation</span>
              <select
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 outline-none"
                onChange={(event) => updatePreference("precipitation_unit", event.target.value as "mm" | "in")}
                value={preferences.precipitation_unit}
              >
                <option value="mm">Millimeters</option>
                <option value="in">Inches</option>
              </select>
            </label>
          </div>
        </aside>

        <div className="space-y-6">
          <WeatherOverview
            locations={visibleCards}
            precipitationUnit={preferences.precipitation_unit}
            regionSlug={preferences.region_slug}
            temperatureUnit={preferences.temperature_unit}
            windUnit={preferences.wind_unit}
          />

          <section className="rounded-[2rem] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_80px_rgba(68,58,42,0.06)]">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">City Feed</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-900">Realtime conditions for curated cities</h2>
              </div>
              <label className="relative block w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  className="w-full rounded-full border border-stone-200 bg-stone-50 py-3 pl-11 pr-4 text-sm text-stone-900 outline-none"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search city or country"
                  value={search}
                />
              </label>
            </div>

            {error ? <p className="mb-4 text-sm text-rose-700">{error}</p> : null}

            {isLoading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-stone-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Loading live weather...
              </div>
            ) : visibleCards.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-sm text-stone-500">
                No cities match the current filters.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleCards.map((card) => {
                  const isFavorite = favoriteSet.has(card.slug);
                  return (
                    <article className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5" key={card.slug}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold text-stone-900">{card.name}</h3>
                          <p className="mt-1 text-sm text-stone-500">
                            {card.country_code} · {card.timezone}
                          </p>
                        </div>
                        <button
                          className={`inline-flex rounded-full border px-3 py-2 transition ${
                            isFavorite
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-stone-200 bg-white text-stone-500"
                          }`}
                          onClick={() => toggleFavorite(card.slug)}
                          type="button"
                        >
                          <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                        </button>
                      </div>

                      {card.snapshot ? (
                        <>
                          <div className="mt-5 flex items-end justify-between">
                            <div>
                              <div className="text-4xl font-semibold text-stone-900">
                                {formatTemperature(card.snapshot.temperature_c, preferences.temperature_unit)}
                              </div>
                              <div className="mt-2 text-sm text-stone-600">{describeWeatherCode(card.snapshot.weather_code)}</div>
                            </div>
                            <div className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600">
                              High {formatTemperature(card.snapshot.daily_high_c, preferences.temperature_unit)}
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <SmallStat
                              icon={<Thermometer className="h-4 w-4" />}
                              label="Feels like"
                              value={formatTemperature(card.snapshot.apparent_temperature_c, preferences.temperature_unit)}
                            />
                            <SmallStat
                              icon={<Wind className="h-4 w-4" />}
                              label="Wind"
                              value={formatWind(card.snapshot.wind_speed_kmh, preferences.wind_unit)}
                            />
                            <SmallStat
                              icon={<Droplets className="h-4 w-4" />}
                              label="Precip"
                              value={formatPrecipitation(card.snapshot.precipitation_mm, preferences.precipitation_unit)}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="mt-5 text-sm text-stone-500">Waiting for the first snapshot from the worker.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>

      {isPending ? (
        <div className="fixed bottom-6 right-6 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 shadow-lg">
          Saving preferences...
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2">
      <span className="text-sm font-medium text-stone-500">{label}</span>
      <span className="ml-3 text-sm font-semibold text-stone-900">{value}</span>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className={`flex items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left transition ${
        checked ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-stone-50 text-stone-700"
      }`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-amber-300" : "bg-stone-300"}`} />
    </button>
  );
}

function SmallStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-4">
      <div className="flex items-center gap-2 text-stone-500">
        {icon}
        <span className="text-xs uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="mt-3 text-sm font-semibold text-stone-900">{value}</div>
    </div>
  );
}
