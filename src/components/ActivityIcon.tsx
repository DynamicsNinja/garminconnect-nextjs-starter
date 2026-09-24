import type { Sport } from "@/lib/activities";

// Hand-drawn 24×24 stroke icons: no icon library, same as the charts add no chart library.
const PATHS: Record<Sport, React.ReactNode> = {
  run: (
    <>
      <circle cx="15" cy="4.5" r="2" />
      <path d="M13.5 8 11 13l-3.5 2.5H5M11 13l3 3-1 4.5M13.5 8l3.5 3 2.5-1M13.5 8 10 9l-2 2.5" />
    </>
  ),
  ride: (
    <>
      <circle cx="5.5" cy="16" r="3.5" />
      <circle cx="18.5" cy="16" r="3.5" />
      <path d="m5.5 16 4-7h5.5l3.5 7M9.5 9l2.5 7H5.5M8 6h3M15 9l-1-3h2" />
    </>
  ),
  swim: (
    <>
      <circle cx="17" cy="7" r="2" />
      <path d="m4 13 5-4 4 3 3-1.5M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4.5" r="2" />
      <path d="m12.5 8-1.5 6-2.5 6M11 14l3 3 .5 3.5M12.5 8 9 11.5M12.5 8l3 3.5" />
    </>
  ),
  hike: <path d="m2 20 7-12 4 6 3-4 6 10ZM7.5 14.5l1.5-2 1.5 2" />,
  strength: <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />,
  yoga: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v6M5 9.5 12 11l7-1.5M6 18c2-3 4-4 6-4s4 1 6 4" />
    </>
  ),
  other: <path d="M3 12h4l3-7 4 14 3-7h4" />,
};

export function ActivityIcon({ sport }: { sport: Sport }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[sport]}
    </svg>
  );
}
