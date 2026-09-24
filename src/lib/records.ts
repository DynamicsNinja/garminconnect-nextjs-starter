import type { BadgeDetail, Badge as GarminBadge, PersonalRecords } from "garminconnect-js";

/** One running personal record, flattened from `getPersonalRecord`'s rows. */
export interface PersonalRecordRow {
  typeId: number;
  label: string;
  /** Seconds for the timed distances; meters for the longest run. */
  value: number;
  kind: "time" | "distance";
  activityId: number | null;
  activityName: string;
  /** `YYYY-MM-DD`, or `""` when Garmin sent no date we recognise. */
  date: string;
}

/** One earned badge, flattened from `getEarnedBadges`' rows. */
export interface Badge {
  id: number;
  name: string;
  /** `YYYY-MM-DD`, or `""`. */
  earned: string;
  /** How many times it was earned; 1 for one-off badges. */
  times: number;
  /** Garmin's badge artwork (`badgeImageUrls.small`), or null when the library couldn't build one. */
  image: string | null;
  /** What earning it takes, from Garmin's translation file (`badge-text.ts`); `""` if unknown. */
  description: string;
  /** The activity that earned it, for activity badges; null for challenges and the like. */
  activity: { id: string; name: string } | null;
  /** Set when the badge is one step of a series (1 mile, 5K, 10K...); see `getBadgeDetail`. */
  seriesId: number | null;
}

/** A badge series around one earned badge, from `getBadgeDetail`: every step, in order. */
export interface BadgeSeries {
  /** The earned badge the series was fetched for. */
  name: string;
  steps: { id: number; name: string; image: string | null; earned: boolean; current: boolean }[];
}

// The running `typeId`s the library documents on `PersonalRecord`. Garmin has more (cycling,
// swimming, steps), but their units aren't documented, so they're counted rather than guessed at.
const RUNNING: Record<number, [label: string, kind: PersonalRecordRow["kind"]]> = {
  1: ["1 km", "time"],
  2: ["1 mile", "time"],
  3: ["5 km", "time"],
  4: ["10 km", "time"],
  5: ["Half marathon", "time"],
  6: ["Marathon", "time"],
  7: ["Longest run", "distance"],
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const day = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}/.test(str(v)) ? str(v).slice(0, 10) : "");

/**
 * The library types a record row as `Record<string, unknown>`; its 17 keys (`typeId`, `value`,
 * `activityId`, `activityName`, `activityStartDateTimeLocal`, ...) are listed in the library's
 * AGENTS.md from a real account. Returns the running records in distance order, plus how many
 * other-sport records were left out.
 */
export function toRecords(rows: PersonalRecords | null): { records: PersonalRecordRow[]; other: number } {
  const records: PersonalRecordRow[] = [];
  let other = 0;
  for (const r of rows ?? []) {
    const typeId = num(r["typeId"]);
    const value = num(r["value"]);
    const known = typeId === null ? undefined : RUNNING[typeId];
    if (typeId === null || value === null || !known) {
      other++;
      continue;
    }
    records.push({
      typeId,
      label: known[0],
      kind: known[1],
      value,
      activityId: num(r["activityId"]),
      activityName: str(r["activityName"]),
      date: day(r["activityStartDateTimeLocal"]) || day(r["prStartTimeLocalFormatted"]),
    });
  }
  return { records: records.sort((a, b) => a.typeId - b.typeId), other };
}

/**
 * `getEarnedBadges` rows are typed loosely (`Badge`); the fields read here are the ones 0.4.0 types
 * on `BadgeDetail`, which the same rows carry, so they're read through that type. A missing one
 * falls back rather than failing. Newest first.
 */
export function toBadges(rows: GarminBadge[] | null, descriptions: Map<string, string>): Badge[] {
  return ((rows ?? []) as BadgeDetail[])
    .map((b, i) => ({
      id: b.badgeId ?? -i,
      name: str(b.badgeName) || "Badge",
      earned: day(b.badgeEarnedDate),
      times: b.badgeEarnedNumber ?? 1,
      image: b.badgeImageUrls?.small ?? null,
      description: descriptions.get(str(b.badgeKey)) ?? "",
      activity:
        b.badgeAssocType === "activityId" && b.badgeAssocDataId
          ? { id: b.badgeAssocDataId, name: str(b.badgeAssocDataName) || "Activity" }
          : null,
      seriesId: num(b.badgeSeriesId),
    }))
    .sort((a, b) => b.earned.localeCompare(a.earned));
}

/**
 * `getBadgeDetail` returns the badge plus `relatedBadges`: the rest of its series, without itself.
 * Put it back and order the steps by difficulty, then points, which is how Garmin ranks them
 * (1 mile → 5K → 10K → half → marathon).
 */
export function toSeries(detail: BadgeDetail | null): BadgeSeries | null {
  if (!detail?.badgeId || !detail.relatedBadges?.length) return null;
  const steps = [{ ...detail, earnedByMe: true }, ...detail.relatedBadges]
    .filter((b) => b.badgeId !== undefined)
    .sort((a, b) => (a.badgeDifficultyId ?? 0) - (b.badgeDifficultyId ?? 0) || (a.badgePoints ?? 0) - (b.badgePoints ?? 0))
    .map((b) => ({
      id: b.badgeId!,
      name: str(b.badgeName) || "Badge",
      image: b.badgeImageUrls?.small ?? null,
      earned: b.earnedByMe === true,
      current: b.badgeId === detail.badgeId,
    }));
  return { name: str(detail.badgeName) || "Badge", steps };
}

/** The newest earned badge that belongs to a series: the one worth a `getBadgeDetail` call. */
export function seriesCandidate(badges: Badge[]): Badge | undefined {
  return badges.find((b) => b.seriesId !== null && b.id > 0);
}

/** `1234.5` seconds → `20:34`; over an hour → `1:42:07`. */
export function formatRaceTime(seconds: number): string {
  const s = Math.round(seconds);
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatRecord(r: PersonalRecordRow): string {
  return r.kind === "time" ? formatRaceTime(r.value) : `${(r.value / 1000).toFixed(2)} km`;
}
