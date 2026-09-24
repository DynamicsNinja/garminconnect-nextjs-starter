<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# This starter

A single-user Next.js 16 dashboard over `garminconnect-js`. Before changing anything that touches
Garmin, read `node_modules/garminconnect-js/AGENTS.md` — the library's own agent briefing, with
the real method names, return shapes and verification status. Do not invent method names from
Python's `garminconnect`.

- **Server-only.** `garminconnect-js` uses `node:crypto`, and tokens must never reach the browser.
  Import `src/lib/garmin.ts` only from Server Components and Server Actions — never from a file
  marked `"use client"`.
- **No functions across the server/client boundary.** The charts take a `unit` string, not a
  formatter function; a Server Component cannot pass a function to a Client Component (it fails
  at runtime, not at build time).
- **`getSleepDaily` rows are `{ calendarDate, values: {...} }`.** The fields used here
  (`sleepScore`, `totalSleepTimeInSeconds`, `avgOvernightHrv`, `hrv7dAverage`,
  `restingHeartRate`) were read off a real account; the library types the row loosely. Map them in
  `src/lib/sleep.ts`, nowhere else.
- **Dates are UTC calendar dates**, which is how Garmin keys them.
- **`GARMIN_DEMO=1`** renders synthetic data — use it for screenshots, never real health data.
