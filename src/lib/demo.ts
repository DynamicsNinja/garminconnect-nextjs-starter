import type { Night } from "./sleep";

/**
 * Synthetic nights for `GARMIN_DEMO=1` — try the dashboard, or take screenshots, without an
 * account and without anyone's real health data. Deterministic, so screenshots are repeatable.
 */
export function demoNights(start: string, end: string): Night[] {
  const nights: Night[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let hrv7: number | null = null;
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    const i = nights.length;
    const hours = Math.round((6.4 + Math.sin(i / 3) * 0.6 + rand() * 1.2) * 10) / 10;
    const hrv = Math.round(52 + Math.sin(i / 5) * 6 + (rand() - 0.5) * 12);
    hrv7 = hrv7 === null ? hrv : Math.round(((hrv7 * 6 + hrv) / 7) * 10) / 10;
    nights.push({
      date: new Date(t).toISOString().slice(0, 10),
      score: Math.min(98, Math.round(58 + (hours - 6) * 12 + rand() * 10)),
      hours,
      hrv,
      hrv7d: hrv7,
      restingHr: Math.round(52 + rand() * 5),
    });
  }
  return nights;
}
