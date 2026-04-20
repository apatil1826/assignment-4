import { getRegionBySlug, type RegionSlug } from "@/lib/constants";
import type { FlightSnapshot } from "@/lib/types";

type FlightMapProps = {
  flights: FlightSnapshot[];
  regionSlug: RegionSlug;
};

export function FlightMap({ flights, regionSlug }: FlightMapProps) {
  const region = getRegionBySlug(regionSlug);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(254,243,199,0.8),_rgba(255,255,255,0.95)_42%,_rgba(245,245,244,0.95)_100%)] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Live Map</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">{region.label}</h2>
        </div>
        <p className="max-w-xs text-right text-sm leading-6 text-stone-500">{region.description}</p>
      </div>

      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.55),_rgba(231,229,228,0.72))]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(120,113,108,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(120,113,108,0.12)_1px,transparent_1px)] bg-[size:12%_12%]" />

        {flights.slice(0, 120).map((flight) => {
          if (flight.latitude === null || flight.longitude === null) {
            return null;
          }

          const left =
            ((flight.longitude - region.bounds.minLon) / (region.bounds.maxLon - region.bounds.minLon)) * 100;
          const top = 100 - ((flight.latitude - region.bounds.minLat) / (region.bounds.maxLat - region.bounds.minLat)) * 100;

          return (
            <div
              className="group absolute"
              key={flight.icao24}
              style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%, -50%) rotate(${flight.true_track ?? 0}deg)` }}
            >
              <div className="h-3.5 w-3.5 rounded-[0.35rem] border border-white/80 bg-stone-900 shadow-[0_0_0_8px_rgba(255,255,255,0.18)] transition group-hover:scale-125" />
            </div>
          );
        })}

        <div className="absolute bottom-4 left-4 rounded-full border border-stone-200/80 bg-white/80 px-4 py-2 text-xs font-medium text-stone-600 backdrop-blur">
          Showing up to 120 aircraft markers
        </div>
      </div>
    </div>
  );
}
