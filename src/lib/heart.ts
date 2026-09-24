import type { HrvDataRange, RhrDailyEntry } from "garminconnect-js";

/** One day of heart data: resting HR from `getRhrDaily`, overnight HRV from `getHrvDataRange`. */
export interface HeartDay {
  date: string;
  rhr: number | null;
  hrv: number | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * `getRhrDaily` is typed by the library (`{ calendarDate, value }`, nulls already dropped).
 * `getHrvDataRange` is passed through unparsed; Garmin sends `{ hrvSummaries: [{ calendarDate,
 * lastNightAvg, ... }] }`. Anything missing maps to `null`, so a changed payload shows gaps, not a crash.
 * One row per date in `dates`, so both charts share an x-axis with the sleep charts.
 */
export function toHeartDays(dates: string[], rhr: RhrDailyEntry[], hrv: HrvDataRange | null): HeartDay[] {
  const rhrBy = new Map(rhr.flatMap((r) => (r.calendarDate ? [[r.calendarDate, num(r.value)] as const] : [])));
  const summaries = Array.isArray(hrv?.["hrvSummaries"]) ? (hrv["hrvSummaries"] as Record<string, unknown>[]) : [];
  const hrvBy = new Map(
    summaries.flatMap((s) => (typeof s?.["calendarDate"] === "string" ? [[s["calendarDate"], num(s["lastNightAvg"])] as const] : [])),
  );
  return dates.map((date) => ({ date, rhr: rhrBy.get(date) ?? null, hrv: hrvBy.get(date) ?? null }));
}

