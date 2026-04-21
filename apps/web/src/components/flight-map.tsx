import { getRegionBySlug, type RegionSlug } from "@/lib/constants";
import type { FlightSnapshot } from "@/lib/types";

type FlightMapProps = {
  flights: FlightSnapshot[];
  regionSlug: RegionSlug;
};

export function FlightMap({ flights, regionSlug }: FlightMapProps) {
  const region = getRegionBySlug(regionSlug);
  const landmass = LANDMASS_BY_REGION[regionSlug];

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
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id={`water-${regionSlug}`} x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
              <stop offset="100%" stopColor="rgba(214,211,209,0.86)" />
            </linearGradient>
            <linearGradient id={`land-${regionSlug}`} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(214,211,209,0.9)" />
              <stop offset="100%" stopColor="rgba(168,162,158,0.75)" />
            </linearGradient>
          </defs>
          <rect fill={`url(#water-${regionSlug})`} height="100" width="100" x="0" y="0" />
          {landmass.map((path) => (
            <path
              d={path}
              fill={`url(#land-${regionSlug})`}
              key={path}
              stroke="rgba(87,83,78,0.22)"
              strokeWidth="0.35"
            />
          ))}
        </svg>

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

const LANDMASS_BY_REGION: Record<RegionSlug, string[]> = {
  "north-america": [
    "M2,8 L9,4 L18,5 L26,9 L31,16 L33,23 L37,28 L41,34 L45,41 L44,50 L39,58 L36,66 L31,72 L24,78 L21,84 L16,88 L11,87 L8,81 L10,73 L7,65 L4,55 L3,44 L2,31 L1,20 Z",
    "M43,55 L49,56 L55,61 L59,68 L60,76 L56,86 L50,95 L45,96 L42,87 L43,77 L41,68 Z",
    "M62,16 L68,13 L74,14 L77,18 L75,23 L69,24 L64,21 Z",
  ],
  europe: [
    "M12,58 L16,49 L25,41 L35,37 L44,33 L52,34 L59,38 L67,37 L74,41 L78,48 L75,55 L68,58 L61,57 L55,61 L47,61 L39,57 L33,60 L25,66 L18,68 L13,64 Z",
    "M30,24 L34,20 L39,20 L42,24 L40,29 L34,29 Z",
    "M67,24 L72,22 L78,24 L80,29 L77,34 L71,33 L67,28 Z",
    "M57,66 L62,69 L64,75 L60,81 L54,80 L52,73 Z",
  ],
  "asia-pacific": [
    "M8,18 L18,16 L28,18 L36,24 L40,32 L37,40 L32,45 L23,48 L16,45 L11,38 L8,29 Z",
    "M42,20 L51,18 L61,21 L68,28 L69,37 L64,44 L58,48 L50,49 L43,45 L40,36 Z",
    "M56,50 L63,53 L69,59 L71,66 L67,73 L61,76 L54,74 L50,67 L51,58 Z",
    "M72,56 L77,58 L82,63 L83,70 L79,75 L73,73 L70,67 Z",
    "M79,19 L86,21 L91,26 L90,33 L84,35 L79,31 L77,24 Z",
  ],
};
