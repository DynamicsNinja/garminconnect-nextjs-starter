<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# This starter

A Next.js 16 live demo of `garminconnect-js`: each panel prints the library call that filled it
(`src/components/Call.tsx`), so keep that call bar accurate when you change what a panel fetches.
Before changing anything that touches Garmin, read `node_modules/garminconnect-js/AGENTS.md` — the library's own agent briefing, with
the real method names, return shapes and verification status. Do not invent method names from
Python's `garminconnect`.

- **Server-only.** `garminconnect-js` uses `node:crypto`, and tokens must never reach the browser.
  Import `src/lib/garmin.ts` only from Server Components and Server Actions — never from a file
  marked `"use client"`.
- **No functions across the server/client boundary.** The charts take a `unit` string, not a
  formatter function; a Server Component cannot pass a function to a Client Component (it fails
  at runtime, not at build time).
- **`getSleepDaily` rows are `{ calendarDate, values: {...} }`.** The fields used here
  (`sleepScore`, `totalSleepTimeInSeconds`) were read off a real account; the library types the
  row loosely. Map them in `src/lib/sleep.ts`, nowhere else.
- **Activities come from `getActivitiesByDate`** and are mapped in `src/lib/activities.ts`, using
  only the fields the library types on `Activity` (`activityName`, `startTimeLocal`, `distance` in
  meters, `duration` in seconds, `activityType.typeKey`). `sportOf` groups type keys into the
  sports `src/components/ActivityIcon.tsx` draws; unknown keys fall back to `other`.
- **Heart, records and badges** are mapped in `src/lib/heart.ts` and `src/lib/records.ts`.
  `getHrvDataRange` and `getEarnedBadges` pass Garmin's payload through untyped, so
  `hrvSummaries[].lastNightAvg`, `badgeName` and `badgeEarnedDate` are read defensively and map
  to `null`/fallbacks when missing. Badge artwork is the library's `badgeImageUrls.small`
  (Garmin sends no image URL; `garminconnect-js` 0.5.0+ adds it) — don't rebuild the URL here. Demo badges have no image. Badge descriptions come from Garmin's public translation file
  (`src/lib/badge-text.ts`, cached a day); the page makes one `getBadgeDetail` call, for the
  newest badge that has a `badgeSeriesId`, to draw its series. Personal records map only the running `typeId`s 1–7 the
  library documents; others are counted, not shown. These calls go through `attempt()` in
  `page.tsx`, so a failure empties one panel instead of the page.
- **Dates are UTC calendar dates**, which is how Garmin keys them.
- **Three modes** (`src/lib/mode.ts`): `local` (tokens on disk), `public` (`GARMIN_PUBLIC=1`:
  each visitor's tokens only in their own encrypted cookie — never add server-side storage of
  another person's tokens or health data here), `demo` (`GARMIN_DEMO=1`: sign-in disabled).
- **Every Server Action is a public endpoint**, whether or not the UI shows its form. Keep the
  mode checks and the rate limit at the top of `signIn`; a new action that talks to Garmin needs
  the same treatment.
- **`GARMIN_DEMO=1`** renders synthetic data — use it for screenshots, never real health data.
