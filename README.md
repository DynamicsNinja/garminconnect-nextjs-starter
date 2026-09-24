# Garmin sleep & HRV — a Next.js starter

A small Next.js app that signs in to Garmin Connect and charts your sleep score, sleep duration
and overnight HRV. It's built on [`garminconnect-js`](https://github.com/DynamicsNinja/garminconnect-js),
and it's meant to be copied: click **Use this template**, then make it yours.

![The dashboard, showing synthetic demo data](docs/screenshot.png)

<sub>**Unofficial.** Not affiliated with, endorsed by, or supported by Garmin. Garmin and Garmin
Connect are trademarks of Garmin Ltd. or its subsidiaries. The screenshot shows synthetic demo
data.</sub>

## What it shows

- **Last night at a glance:** sleep score, time asleep, overnight HRV and resting heart rate.
- **Charts for 7, 30 or 90 days:** sleep score, sleep duration, and nightly HRV against its 7-day
  average. Hover a chart for exact values, or open its table.
- **Sign-in with MFA:** if Garmin sends you a code, a second step asks for it.

Everything comes from a single library call, `garmin.getSleepDaily(start, end)`, which returns
one row per night with the score, duration, HRV and resting heart rate together. The charts are
plain SVG and add no dependencies.

## Run it

Needs Node 20.9 or newer (Next.js 16).

```bash
npm install
cp .env.example .env.local   # then set SESSION_SECRET — the file says how
npm run dev                  # http://127.0.0.1:3000
```

Sign in with your Garmin Connect email and password. Your password goes to Garmin's own sign-in
service and nowhere else; the app keeps only the OAuth tokens, in `.garmin-tokens/` (gitignored).
The tokens refresh themselves for about 30 days after your last use, then you sign in again.
**Disconnect** deletes them.

**No account handy, or taking screenshots?** Set `GARMIN_DEMO=1` in `.env.local` and the app shows
deterministic synthetic data instead of calling Garmin.

## How it's built

| File | What it does |
|---|---|
| `src/app/page.tsx` | The dashboard. A Server Component: it reads tokens, calls Garmin, and renders. |
| `src/app/actions.ts` | Server Actions for sign-in (including MFA) and disconnect. |
| `src/lib/garmin.ts` | The `GarminClient` and its `FileTokenStore`. **The place to swap in your own storage.** |
| `src/lib/seal.ts` | AES-256-GCM sealing for the short-lived MFA cookie. |
| `src/lib/sleep.ts` | Flattens `getSleepDaily` rows into the `Night` shape the page uses. |
| `src/components/charts.tsx` | Dependency-free SVG column and line charts, with hover and table views. |

The library only runs on the server: it uses `node:crypto`, and your tokens must never reach the
browser. Everything that touches Garmin lives in Server Components and Server Actions.

### MFA across two requests

`client.login()` doesn't block waiting for a code. It returns `{ state: "mfa_required", mfaState }`,
and the app finishes later with `client.resumeLogin(mfaState, code)`, in a different request.
`mfaState` holds no password, but it is a live, half-finished sign-in, so the app encrypts it into
an httpOnly cookie that expires after 10 minutes and deletes it as soon as it's used.

## Before you deploy it

This starter is built for **one person on their own machine**, which is why `npm run dev` and
`npm start` listen on `127.0.0.1` only. Before putting it on the internet:

1. **Add your own authentication.** As shipped, anyone who can reach the app sees the connected
   account's data and can disconnect it.
2. **Store tokens per user, in your database.** Replace the `FileTokenStore` in `src/lib/garmin.ts`
   with a `TokenStore` keyed by your user id. It is a three-method interface: `load`, `save` and
   `clear`. Persist the whole token object, and keep `expires_at` and `refresh_token_expires_at` as
   numbers, because every refresh decision reads them. Serverless hosts have no persistent disk,
   so the file store won't work there.
3. **Build one `Garmin` per user and reuse it.** Each new instance costs an extra profile fetch.

EU accounts: Garmin rejects every *write* with HTTP 412 until upload consent is granted in Garmin
Connect's settings. This starter only reads, so it's unaffected.

## Going further

The library has 164 typed methods: activities, training readiness, body battery, workouts,
courses and more. See its [API reference](https://github.com/DynamicsNinja/garminconnect-js/tree/main/docs/api).
Adding a chart usually means one more call in `page.tsx` and another chart component.

## License

MIT.
