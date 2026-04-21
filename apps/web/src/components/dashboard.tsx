"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import type { Session } from "@supabase/supabase-js";
import { LoaderCircle, LogOut, Search, Star } from "lucide-react";

import {
  DEFAULT_REGION,
  REGIONS,
  formatAltitude,
  formatRelativeSync,
  formatSpeed,
  type RegionSlug,
} from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import type { FavoriteFlight, FlightSnapshot, UserPreferences, WorkerRun } from "@/lib/types";
import { FlightMap } from "@/components/flight-map";

type DashboardProps = {
  session: Session;
};

const defaultPreferences: Omit<UserPreferences, "user_id"> = {
  region_slug: DEFAULT_REGION,
  favorites_only: false,
  show_ground_traffic: false,
  altitude_unit: "ft",
  speed_unit: "kts",
};

export function Dashboard({ session }: DashboardProps) {
  const [preferences, setPreferences] = useState<Omit<UserPreferences, "user_id">>(defaultPreferences);
  const [favorites, setFavorites] = useState<FavoriteFlight[]>([]);
  const [flights, setFlights] = useState<FlightSnapshot[]>([]);
  const [workerRun, setWorkerRun] = useState<WorkerRun | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const ensurePreferencesRow = useCallback(async () => {
    const { error: upsertError } = await supabase.from("user_preferences").upsert(
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

  const refreshPreferences = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (queryError || !data) {
      return;
    }

    setPreferences({
      region_slug: data.region_slug,
      favorites_only: data.favorites_only,
      show_ground_traffic: data.show_ground_traffic,
      altitude_unit: data.altitude_unit,
      speed_unit: data.speed_unit,
    });
  }, [session.user.id]);

  const refreshFavorites = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("favorite_flights").select("*").eq("user_id", session.user.id);

    if (queryError) {
      return;
    }

    setFavorites(data ?? []);
  }, [session.user.id]);

  const refreshFlights = useCallback(async (regionSlug: RegionSlug) => {
    const { data, error: queryError } = await supabase
      .from("flight_snapshots")
      .select("*")
      .eq("region_slug", regionSlug)
      .order("last_contact", { ascending: false })
      .limit(200);

    if (queryError) {
      return;
    }

    setFlights(data ?? []);
  }, []);

  const refreshWorkerRun = useCallback(async (regionSlug: RegionSlug) => {
    const { data, error: queryError } = await supabase
      .from("worker_runs")
      .select("*")
      .eq("region_slug", regionSlug)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      return;
    }

    setWorkerRun(data ?? null);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadAll() {
      setIsLoading(true);
      setError(null);

      const [preferencesResult, favoritesResult, flightsResult, workerRunResult] = await Promise.all([
        supabase.from("user_preferences").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("favorite_flights").select("*").eq("user_id", session.user.id),
        supabase
          .from("flight_snapshots")
          .select("*")
          .eq("region_slug", preferences.region_slug)
          .order("last_contact", { ascending: false })
          .limit(200),
        supabase
          .from("worker_runs")
          .select("*")
          .eq("region_slug", preferences.region_slug)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!isActive) {
        return;
      }

      if (preferencesResult.error || favoritesResult.error || flightsResult.error || workerRunResult.error) {
        setError(
          preferencesResult.error?.message ??
            favoritesResult.error?.message ??
            flightsResult.error?.message ??
            workerRunResult.error?.message ??
            "Unable to load dashboard data.",
        );
        setIsLoading(false);
        return;
      }

      if (preferencesResult.data) {
        setPreferences({
          region_slug: preferencesResult.data.region_slug,
          favorites_only: preferencesResult.data.favorites_only,
          show_ground_traffic: preferencesResult.data.show_ground_traffic,
          altitude_unit: preferencesResult.data.altitude_unit,
          speed_unit: preferencesResult.data.speed_unit,
        });
      } else {
        await ensurePreferencesRow();
      }

      setFavorites(favoritesResult.data ?? []);
      setFlights(flightsResult.data ?? []);
      setWorkerRun(workerRunResult.data ?? null);
      setIsLoading(false);
    }

    void loadAll();

    const channel = supabase
      .channel(`dashboard-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_snapshots", filter: `region_slug=eq.${preferences.region_slug}` },
        () => {
          void refreshFlights(preferences.region_slug);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_runs", filter: `region_slug=eq.${preferences.region_slug}` },
        () => {
          void refreshWorkerRun(preferences.region_slug);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorite_flights", filter: `user_id=eq.${session.user.id}` },
        () => {
          void refreshFavorites();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences", filter: `user_id=eq.${session.user.id}` },
        () => {
          void refreshPreferences();
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [ensurePreferencesRow, preferences.region_slug, refreshFavorites, refreshFlights, refreshPreferences, refreshWorkerRun, session.user.id]);

  function updatePreference<K extends keyof Omit<UserPreferences, "user_id">>(
    key: K,
    value: Omit<UserPreferences, "user_id">[K],
  ) {
    const nextPreferences = { ...preferences, [key]: value };
    setPreferences(nextPreferences);

    startTransition(async () => {
      const { error: upsertError } = await supabase.from("user_preferences").upsert(
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
        await Promise.all([refreshFlights(value as RegionSlug), refreshWorkerRun(value as RegionSlug)]);
      }
    });
  }

  function toggleFavorite(icao24: string) {
    const isFavorite = favorites.some((favorite) => favorite.icao24 === icao24);

    startTransition(async () => {
      const result = isFavorite
        ? await supabase.from("favorite_flights").delete().eq("user_id", session.user.id).eq("icao24", icao24)
        : await supabase.from("favorite_flights").insert({ user_id: session.user.id, icao24 });

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

  const favoriteSet = useMemo(() => new Set(favorites.map((favorite) => favorite.icao24)), [favorites]);
  const visibleFlights = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return flights
      .filter((flight) => (preferences.show_ground_traffic ? true : !flight.on_ground))
      .filter((flight) => (preferences.favorites_only ? favoriteSet.has(flight.icao24) : true))
      .filter((flight) => {
        if (!normalizedSearch) {
          return true;
        }

        return [flight.callsign, flight.icao24, flight.origin_country].some((value) =>
          value?.toLowerCase().includes(normalizedSearch),
        );
      });
  }, [deferredSearch, favoriteSet, flights, preferences.favorites_only, preferences.show_ground_traffic]);

  const hasWorkerData = workerRun !== null;
  const hasAnyFlights = flights.length > 0;
  const showSetupState = !isLoading && !error && !hasAnyFlights;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[2rem] border border-stone-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(68,58,42,0.08)] backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Flight Tracker</p>
          <h1 className="font-serif text-4xl text-stone-900 md:text-5xl">Realtime aircraft flow with a personal lens.</h1>
          <p className="max-w-2xl text-base leading-8 text-stone-600">
            Signed in as <span className="font-medium text-stone-900">{session.user.email}</span>. Pick a region, save
            favorite aircraft, and watch Supabase Realtime keep the dashboard current.
          </p>
          <div className="flex flex-wrap gap-3">
            <MetricCard label="Visible flights" value={String(visibleFlights.length)} />
            <MetricCard label="Favorites" value={String(favoriteSet.size)} />
            <MetricCard label="Worker status" value={workerRun?.status === "ok" ? "Healthy" : "Pending"} />
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
            Worker runs are stored in Supabase too, so you can surface freshness directly in the interface.
          </p>
          {workerRun?.error_message ? <p className="mt-3 text-sm text-rose-700">{workerRun.error_message}</p> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <aside className="space-y-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_24px_80px_rgba(68,58,42,0.06)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Preferences</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">Personalize your live feed</h2>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                checked={preferences.favorites_only}
                label="Favorites only"
                onChange={(checked) => updatePreference("favorites_only", checked)}
              />
              <Toggle
                checked={preferences.show_ground_traffic}
                label="Show ground traffic"
                onChange={(checked) => updatePreference("show_ground_traffic", checked)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-700">Altitude</span>
                <select
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 outline-none"
                  onChange={(event) => updatePreference("altitude_unit", event.target.value as "ft" | "m")}
                  value={preferences.altitude_unit}
                >
                  <option value="ft">Feet</option>
                  <option value="m">Meters</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-700">Speed</span>
                <select
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 outline-none"
                  onChange={(event) => updatePreference("speed_unit", event.target.value as "kts" | "kmh")}
                  value={preferences.speed_unit}
                >
                  <option value="kts">Knots</option>
                  <option value="kmh">km/h</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-600">
            OpenSky polling is configured around curated regions so the Railway worker stays inside the current credit model
            while still delivering frequent updates.
          </div>
        </aside>

        <div className="space-y-6">
          <FlightMap flights={visibleFlights} regionSlug={preferences.region_slug} />

          <section className="rounded-[2rem] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_80px_rgba(68,58,42,0.06)]">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Aircraft Feed</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-900">Live flights in your selected region</h2>
              </div>
              <label className="relative block w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  className="w-full rounded-full border border-stone-200 bg-stone-50 py-3 pl-11 pr-4 text-sm text-stone-900 outline-none"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search callsign, ICAO, country"
                  value={search}
                />
              </label>
            </div>

            {error ? <p className="mb-4 text-sm text-rose-700">{error}</p> : null}

            {isLoading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-stone-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Loading live data...
              </div>
            ) : showSetupState ? (
              <EmptyState hasWorkerData={hasWorkerData} regionSlug={preferences.region_slug} />
            ) : (
              <div className="overflow-hidden rounded-[1.5rem] border border-stone-200">
                <div className="grid grid-cols-[1.35fr_1fr_1fr_0.9fr_auto] gap-4 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                  <span>Flight</span>
                  <span>Altitude</span>
                  <span>Speed</span>
                  <span>Status</span>
                  <span className="text-right">Favorite</span>
                </div>
                <div className="max-h-[34rem] divide-y divide-stone-200 overflow-y-auto bg-white">
                  {visibleFlights.length === 0 ? (
                    <div className="px-4 py-10 text-sm text-stone-500">No flights match the current filters.</div>
                  ) : (
                    visibleFlights.map((flight) => {
                      const isFavorite = favoriteSet.has(flight.icao24);
                      return (
                        <div
                          className="grid grid-cols-[1.35fr_1fr_1fr_0.9fr_auto] items-center gap-4 px-4 py-4"
                          key={flight.icao24}
                        >
                          <div>
                            <div className="font-semibold text-stone-900">{flight.callsign?.trim() || flight.icao24.toUpperCase()}</div>
                            <div className="mt-1 text-sm text-stone-500">
                              {flight.origin_country} · {flight.icao24.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-sm text-stone-700">
                            {formatAltitude(flight.geo_altitude_m ?? flight.baro_altitude_m, preferences.altitude_unit)}
                          </div>
                          <div className="text-sm text-stone-700">{formatSpeed(flight.velocity_mps, preferences.speed_unit)}</div>
                          <div className="text-sm text-stone-600">{flight.on_ground ? "Grounded" : "Airborne"}</div>
                          <div className="text-right">
                            <button
                              className={`inline-flex rounded-full border px-3 py-2 transition ${
                                isFavorite
                                  ? "border-amber-300 bg-amber-50 text-amber-700"
                                  : "border-stone-200 bg-white text-stone-500"
                              }`}
                              onClick={() => toggleFavorite(flight.icao24)}
                              type="button"
                            >
                              <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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

function EmptyState({ hasWorkerData, regionSlug }: { hasWorkerData: boolean; regionSlug: RegionSlug }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">No live flights yet</p>
      <h3 className="mt-3 text-2xl font-semibold text-stone-900">
        {hasWorkerData ? "The selected region is currently empty." : "The worker has not written any flight data yet."}
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
        {hasWorkerData
          ? `Try another region or wait for the next poll. The dashboard is connected, but there are no recent aircraft snapshots for ${regionSlug}.`
          : "Next steps: apply supabase/schema.sql in your Supabase SQL editor, deploy the Railway worker from this repo, and add the worker environment variables so it can poll OpenSky and write to Supabase."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-700">
        <span className="rounded-full border border-stone-200 bg-white px-4 py-2">1. Run the Supabase schema</span>
        <span className="rounded-full border border-stone-200 bg-white px-4 py-2">2. Deploy the Railway worker</span>
        <span className="rounded-full border border-stone-200 bg-white px-4 py-2">3. Wait for the first sync</span>
      </div>
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
