# garminconnect-js live demo — a Next.js starter

A small Next.js app that signs in to Garmin Connect and shows your sleep, heart
data, recent activities, personal records and badges. It's the live demo for [`garminconnect-js`](https://github.com/DynamicsNinja/garminconnect-js):
each panel prints the library call that filled it, with its real arguments, the number of rows
that came back, and how long Garmin took. It's also meant to be copied: click **Use this
template**, then make it yours.

**Live demo:** [garmin.ficdev.xyz](https://garmin.ficdev.xyz). It shows synthetic data until you
sign in with your own Garmin account.

![The demo page, showing synthetic data](docs/screenshot.png)

<sub>**Unofficial.** Not affiliated with, endorsed by, or supported by Garmin. Garmin and Garmin
Connect are trademarks of Garmin Ltd. or its subsidiaries. The screenshot shows synthetic demo
data.</sub>

## What it shows

- **At a glance:** last night's sleep score, time asleep and HRV, your latest resting heart rate,
  plus how many activities you logged and your total active time over the selected range.
- **Sleep for 7, 30 or 90 days:** sleep score and duration charts. Hover a chart for exact
  values, or open its table.
- **Activities:** your latest activities in the range, each with a sport icon, its type, its start
  time, its distance and its duration.
- **Heart:** resting heart rate and overnight HRV for the same range, as line charts.
- **Personal records and badges:** your running records (1 km to marathon, and longest run), each
  linked to its activity; your latest badges with Garmin's artwork, what each one takes and the
  activity that earned it; and the series around your newest series badge (1 mile → 5K → 10K...),
  with the steps you haven't earned greyed out.
- **Sign-in with MFA:** if Garmin sends you a code, a second step asks for it.

Eight library calls fill the page: `garmin.fullName()`, `getSleepDaily(start, end)`,
`getActivitiesByDate(start, end)`, `getRhrDaily(start, end)`, `getHrvDataRange(start, end)`,
`getPersonalRecord()`, `getEarnedBadges()` and `getBadgeDetail(id)`. If one of the last five
fails, only its panel says so; the rest of the page still loads. The charts and icons are plain SVG and add no
dependencies.

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

## Three modes

One environment variable decides how the app behaves:

| Mode | Set | Tokens live | For |
|---|---|---|---|
| **local** | nothing (default) | on disk, `.garmin-tokens/` | you, on your own machine |
| **public** | `GARMIN_PUBLIC=1` | in each visitor's browser, as an encrypted httpOnly cookie. **Nothing on the server.** | a shared deployment where anyone can try it with their own account |
| **demo** | `GARMIN_DEMO=1` | nowhere; sign-in is disabled | a synthetic-data showcase |

In public mode, visitors who aren't signed in see demo data with a **Sign in with Garmin** button.
The sign-in form says plainly where their password goes, and links to [`/privacy`](src/app/privacy/page.tsx),
which describes what the code does with their data. Each visitor's tokens are compressed and
sealed with `SESSION_SECRET` into a cookie in their own browser, so one visitor can never see
another's data, and the server holds nothing to leak. **Sign out** deletes the cookie. Sign-in
attempts are rate-limited to 5 per IP and 60 overall per 15 minutes. A public page that forwards
passwords to Garmin is attractive for credential stuffing, and Garmin would block the server's IP
for everyone.

## Deploy it (Dokploy, Coolify, Railway: anything with Nixpacks)

`nixpacks.toml` pins Node 22 and starts the server on `0.0.0.0:$PORT`. In a container, `npm start`'s
`127.0.0.1` binding would be unreachable.

1. Create an application from this repository, with **Nixpacks** as the build type.
2. Set the environment variables:
   - `SESSION_SECRET`: 32+ random characters (see `.env.example`). Changing it signs everyone out.
   - `GARMIN_PUBLIC=1` so visitors can sign in with their own account, or `GARMIN_DEMO=1` for demo only.
   - `PRIVACY_CONTACT` (optional): a contact line shown on `/privacy`.
3. Add a domain with HTTPS. The cookies are `Secure` in production, so they need HTTPS.
4. Run **one** instance. The rate limiter counts in memory; several replicas would each keep their
   own count, so share it through Redis before scaling out.

Garmin rate limits its mobile sign-in step, often after one or two sign-ins from the same server
IP. When that happens, `garminconnect-js` (0.3.0 and later) signs in once more through Garmin's
SSO web widget. A sign-in can then take ten seconds or so: the library pauses a few seconds before
posting the password, so the request looks less like a bot. If a sign-in still fails, the error
names what Garmin refused: a 429 on `/sso/signin` means the widget is rate limited too, and a 403
or "Just a moment..." means Cloudflare challenged the server. Either way it is Garmin blocking the
server's IP, not a wrong password.

## How it's built

| File | What it does |
|---|---|
| `src/app/page.tsx` | The dashboard. A Server Component: it reads tokens, calls Garmin, and renders. |
| `src/app/actions.ts` | Server Actions for sign-in (including MFA) and sign-out, rate-limited in public mode. |
| `src/app/privacy/page.tsx` | The privacy note public mode links to. |
| `src/lib/mode.ts` | Picks local, public or demo mode from the environment. |
| `src/lib/garmin.ts` | The `GarminClient` and its token store. **The place to swap in your own storage.** |
| `src/lib/cookie-token-store.ts` | Public mode's `TokenStore`: compressed, sealed, chunked httpOnly cookies. |
| `src/lib/rate-limit.ts` | In-memory, per-IP and global sign-in limits. |
| `src/lib/seal.ts` | AES-256-GCM sealing for the MFA and token cookies. |
| `src/lib/sleep.ts` | Flattens `getSleepDaily` rows into the `Night` shape the page uses. |
| `src/lib/activities.ts` | Flattens `getActivitiesByDate` rows and groups Garmin's type keys into sports. |
| `src/lib/heart.ts` | Joins `getRhrDaily` and `getHrvDataRange` into one row per day. |
| `src/lib/records.ts` | Flattens `getPersonalRecord`, `getEarnedBadges` and `getBadgeDetail` rows. |
| `src/lib/badge-text.ts` | Badge descriptions from Garmin's public translation file, cached for a day. |
| `src/lib/demo.ts` | Deterministic synthetic data for every panel, for demo mode. |
| `src/components/Call.tsx` | The call bar above each panel: method, arguments, rows returned, time taken. |
| `src/components/ActivityIcon.tsx` | Inline SVG icons, one per sport. |
| `src/components/charts.tsx` | Dependency-free SVG column and line charts, with hover and table views. |

The library only runs on the server: it uses `node:crypto`, and your tokens must never reach the
browser. Everything that touches Garmin lives in Server Components and Server Actions.

### MFA across two requests

`client.login()` doesn't block waiting for a code. It returns `{ state: "mfa_required", mfaState }`,
and the app finishes later with `client.resumeLogin(mfaState, code)`, in a different request.
`mfaState` holds no password, but it is a live, half-finished sign-in, so the app encrypts it into
an httpOnly cookie that expires after 10 minutes and deletes it as soon as it's used.

## Building a real product on it

Public mode is enough for letting people try the library. For an app with its own user accounts:

1. **Add your own authentication.** In local mode, anyone who can reach the app sees the connected
   account's data, which is why `npm run dev` and `npm start` listen on `127.0.0.1` only.
2. **Store tokens per user, in your database.** Replace the token store in `src/lib/garmin.ts`
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
Adding a panel usually means one more call in `page.tsx`, a `<Call>` bar describing it, and a
component to draw the result.

## License

MIT.
