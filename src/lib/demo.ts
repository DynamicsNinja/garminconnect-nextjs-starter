import { sportOf, type ActivityRow } from "./activities";
import type { HeartDay } from "./heart";
import type { Badge, PersonalRecordRow } from "./records";
import { eachDay, type Night } from "./sleep";

/**
 * Synthetic data for `GARMIN_DEMO=1`, and for public-mode visitors who haven't signed in: try the
 * dashboard, or take screenshots, without an account and without anyone's real health data.
 * Deterministic, so screenshots are repeatable.
 */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
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

export function demoHeart(start: string, end: string): HeartDay[] {
  const rand = rng(23);
  return eachDay(start, end).map((date, i) => ({
    date,
    rhr: Math.round(49 + Math.sin(i / 5) * 2 + rand() * 3),
    hrv: Math.round(58 + Math.sin(i / 4 + 1) * 6 + rand() * 8),
  }));
}

/** Records and badges are dated relative to `end`, so they always look recent. */
function daysBefore(end: string, days: number): string {
  return new Date(Date.parse(`${end}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

export function demoRecords(end: string): PersonalRecordRow[] {
  const rows: [number, string, number, PersonalRecordRow["kind"], string, number][] = [
    [1, "1 km", 228, "time", "Track intervals", 41],
    [2, "1 mile", 372, "time", "Track intervals", 41],
    [3, "5 km", 1_274, "time", "Parkrun", 12],
    [4, "10 km", 2_689, "time", "Riverside 10K", 96],
    [5, "Half marathon", 5_942, "time", "City half", 180],
    [7, "Longest run", 28_410, "distance", "Long trail run", 26],
  ];
  return rows.map(([typeId, label, value, kind, activityName, ago]) => ({
    typeId,
    label,
    value,
    kind,
    activityId: null,
    activityName,
    date: daysBefore(end, ago),
  }));
}

export function demoBadges(end: string): Badge[] {
  const rows: [string, number, number][] = [
    ["Parkrun Regular", 12, 1],
    ["Weekend Warrior", 19, 4],
    ["Trail Blazer", 26, 1],
    ["Early Bird", 33, 6],
    ["Century Ride", 58, 1],
    ["Pool Party", 74, 2],
    ["Step Streak 30", 101, 1],
    ["Summit Seeker", 140, 1],
    ["Half Marathon", 180, 1],
    ["First Activity", 400, 1],
  ];
  return rows.map(([name, ago, times], i) => ({ id: i + 1, name, earned: daysBefore(end, ago), times }));
}
