import { sportOf, type ActivityRow } from "./activities";
import type { Night } from "./sleep";

/**
 * Synthetic data for `GARMIN_DEMO=1`, and for public-mode visitors who haven't signed in: try the
 * dashboard, or take screenshots, without an account and without anyone's real health data.
 * Deterministic, so screenshots are repeatable.
 */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

export function demoNights(start: string, end: string): Night[] {
  const rand = rng(7);
  return eachDay(start, end).map((date, i) => {
    const hours = Math.round((6.4 + Math.sin(i / 3) * 0.6 + rand() * 1.2) * 10) / 10;
    return { date, score: Math.min(98, Math.round(58 + (hours - 6) * 12 + rand() * 10)), hours };
  });
}

// A week of training, repeated: [typeKey, name, km per hour (0 = no distance), minutes, start hour].
const WEEK: ([string, string, number, number, number] | null)[] = [
  ["running", "Easy run", 10.2, 42, 7],
  ["strength_training", "Upper body", 0, 50, 18],
  ["road_biking", "Lunch ride", 27, 75, 12],
  null,
  ["lap_swimming", "Pool swim", 2.4, 40, 7],
  ["trail_running", "Long trail run", 8.8, 95, 8],
  ["hiking", "Ridge hike", 4.1, 180, 10],
];
const EXTRA: [string, string, number, number, number][] = [
  ["walking", "Evening walk", 5.2, 35, 19],
  ["yoga", "Recovery yoga", 0, 30, 21],
];

export function demoActivities(start: string, end: string): ActivityRow[] {
  const rand = rng(11);
  const rows: ActivityRow[] = [];
  for (const date of eachDay(start, end)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const plan = [WEEK[weekday], rand() < 0.3 ? EXTRA[Math.floor(rand() * EXTRA.length)] : null];
    for (const p of plan) {
      if (!p) continue;
      const [typeKey, name, kmh, minutes, hour] = p;
      const seconds = Math.round(minutes * 60 * (0.85 + rand() * 0.3));
      const minute = String(Math.floor(rand() * 60)).padStart(2, "0");
      rows.push({
        id: rows.length + 1,
        name,
        typeKey,
        sport: sportOf(typeKey),
        start: `${date} ${String(hour).padStart(2, "0")}:${minute}:00`,
        km: kmh ? Math.round(kmh * (seconds / 3600) * (0.95 + rand() * 0.1) * 100) / 100 : null,
        seconds,
      });
    }
  }
  return rows.sort((a, b) => b.start.localeCompare(a.start));
}
