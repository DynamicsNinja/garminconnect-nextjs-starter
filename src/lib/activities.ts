import type { Activity } from "garminconnect-js";

/** The sports the page draws an icon for. Anything else falls back to `other`. */
export type Sport = "run" | "ride" | "swim" | "walk" | "hike" | "strength" | "yoga" | "other";

/** One activity, flattened from `getActivitiesByDate`'s rows. */
export interface ActivityRow {
  id: number;
  name: string;
  typeKey: string;
  sport: Sport;
  /** Local start time as Garmin sends it: `YYYY-MM-DD HH:MM:SS`. */
  start: string;
  km: number | null;
  seconds: number | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Garmin has ~150 type keys (`trail_running`, `indoor_cycling`, `lap_swimming`...); group them by sport. */
export function sportOf(typeKey: string): Sport {
  const k = typeKey.toLowerCase();
  if (k.includes("run")) return "run";
  if (k.includes("cycl") || k.includes("bik") || k.includes("ride")) return "ride";
  if (k.includes("swim")) return "swim";
  if (k.includes("hik") || k.includes("mountaineering")) return "hike";
  if (k.includes("walk")) return "walk";
  if (k.includes("strength") || k.includes("weight")) return "strength";
  if (k.includes("yoga") || k.includes("pilates") || k.includes("breath")) return "yoga";
  return "other";
}

/**
 * Uses only the fields `garminconnect-js` types on `Activity`: `activityName`, `startTimeLocal`,
 * `distance` (meters), `duration` (seconds) and `activityType.typeKey`. Newest first.
 */
export function toActivities(rows: Activity[]): ActivityRow[] {
  return rows
    .map((r) => {
      const typeKey = typeof r.activityType?.["typeKey"] === "string" ? (r.activityType["typeKey"] as string) : "other";
      const meters = num(r.distance);
      return {
        id: r.activityId,
        name: r.activityName || typeLabel(typeKey),
        typeKey,
        sport: sportOf(typeKey),
        start: r.startTimeLocal ?? "",
        km: meters === null || meters === 0 ? null : Math.round(meters / 10) / 100,
        seconds: num(r.duration),
      };
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}

/** `trail_running` → `Trail running`. */
export function typeLabel(typeKey: string): string {
  const words = typeKey.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

/** `2026-09-24 07:12:00` → `Sep 24, 07:12`. The time is the athlete's local time, so no zone math. */
export function formatStart(start: string): string {
  const [date, time] = start.split(" ");
  if (!date) return "—";
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return time ? `${day}, ${time.slice(0, 5)}` : day;
}
