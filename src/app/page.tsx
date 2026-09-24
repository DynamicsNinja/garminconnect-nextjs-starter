import Link from "next/link";
import { connection } from "next/server";
import { GarminAuthError } from "garminconnect-js";
import { logout } from "@/app/actions";
import { ActivityIcon } from "@/components/ActivityIcon";
import { Call } from "@/components/Call";
import { ColumnChart } from "@/components/charts";
import { LoginForm } from "@/components/LoginForm";
import { formatDuration, formatStart, toActivities, typeLabel, type ActivityRow } from "@/lib/activities";
import { demoActivities, demoNights } from "@/lib/demo";
import { getGarmin } from "@/lib/garmin";
import { MODE } from "@/lib/mode";
import { formatHours, range, toNights, type Night } from "@/lib/sleep";
import styles from "./page.module.css";

const RANGES = [7, 30, 90] as const;
const LIST_LIMIT = 20;

/** Runs a library call and measures it, so each panel can show how long Garmin took. */
async function timed<T>(call: Promise<T>): Promise<{ value: T; ms: number }> {
  const t = performance.now();
  const value = await call;
  return { value, ms: Math.round(performance.now() - t) };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; signin?: string }>;
}) {
  await connection(); // always render per request: this page reads live account data
  const params = await searchParams;
  const garmin = await getGarmin();
  // Local mode has nothing to show until you connect. Public mode shows demo data to visitors who
  // haven't signed in, and the sign-in form when they ask for it.
  if (!garmin && (MODE === "local" || (MODE === "public" && params.signin !== undefined))) {
    return <LoginForm mode={MODE} />;
  }

  const requested = Number(params.days);
  const days = RANGES.find((r) => r === requested) ?? 30;
  const { start, end } = range(days);

  let nights: Night[];
  let activities: ActivityRow[];
  let name: string;
  // Milliseconds per call; null for synthetic data, which calls nothing.
  let ms: { name: number; sleep: number; activities: number } | null = null;
  if (!garmin) {
    [nights, activities, name] = [demoNights(start, end), demoActivities(start, end), "Demo athlete"];
  } else {
    try {
      const [n, s, a] = await Promise.all([
        timed(garmin.fullName()),
        timed(garmin.getSleepDaily(start, end)),
        timed(garmin.getActivitiesByDate(start, end)),
      ]);
      [name, nights, activities] = [n.value, toNights(s.value), toActivities(a.value)];
      ms = { name: n.ms, sleep: s.ms, activities: a.ms };
    } catch (e) {
      if (e instanceof GarminAuthError) {
        return <LoginForm mode={MODE} notice="Your Garmin session has expired. Sign in again to reconnect." />;
      }
      throw e;
    }
  }

  const dates = nights.map((n) => n.date);
  const last = nights.findLast((n) => n.score !== null || n.hours !== null);
  const activeSeconds = activities.reduce((sum, a) => sum + (a.seconds ?? 0), 0);
  const rows = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}${garmin ? "" : " (synthetic)"}`;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.intro}>
          <h1 className={styles.wordmark}>
            garminconnect<span>-js</span>
          </h1>
          <p className={styles.lede}>
            A zero-dependency TypeScript client for Garmin Connect. This page is its live demo: each
            panel shows the library call that filled it, with the arguments it sent and what came back.
          </p>
        </div>
        <div className={styles.aside}>
          <code className={styles.install}>npm install garminconnect-js</code>
          <nav className={styles.links} aria-label="Library">
            <a href="https://github.com/DynamicsNinja/garminconnect-js">GitHub</a>
            <a href="https://github.com/DynamicsNinja/garminconnect-js/tree/main/docs/api">API reference</a>
            <a href="https://www.npmjs.com/package/garminconnect-js">npm</a>
          </nav>
        </div>
      </header>

      {!garmin && MODE === "public" && (
        <div className={styles.demo}>
          <p>
            <strong>You&apos;re looking at synthetic demo data.</strong> Sign in with your Garmin
            account to run these calls against your own data. Your password goes to Garmin only and
            is never stored; your session stays in your browser.
          </p>
          <Link href="/?signin" className={styles.cta}>
            Sign in with Garmin
          </Link>
        </div>
      )}
      {!garmin && MODE === "demo" && (
        <p className={styles.demo}>
          <strong>Live demo, synthetic data.</strong> To run these calls against your own account, start
          from the <a href="https://github.com/DynamicsNinja/garminconnect-nextjs-starter">template</a> —
          it runs locally and signs in to your own Garmin account.
        </p>
      )}

      <section className={styles.panel} aria-label="Account">
        <Call method="fullName" result={garmin ? `"${name}"` : `"${name}" (synthetic)`} ms={ms?.name} />
        <div className={styles.account}>
          <span>
            {garmin ? "Signed in as" : "Showing"} <strong>{name}</strong>
          </span>
          {garmin && (
            <form action={logout}>
              <button className={styles.ghost}>{MODE === "public" ? "Sign out" : "Disconnect"}</button>
            </form>
          )}
        </div>
      </section>

      <nav className={styles.ranges} aria-label="Date range">
        {RANGES.map((r) => (
          <Link key={r} href={`/?days=${r}`} aria-current={r === days ? "page" : undefined}>
            Last {r} days
          </Link>
        ))}
      </nav>

      <section className={styles.tiles} aria-label="Summary">
        <Tile label="Sleep score, last night" value={last?.score ?? null} />
        <Tile label="Sleep, last night" value={last?.hours ?? null} format={formatHours} />
        <Tile label={`Activities, ${days} days`} value={activities.length} />
        <Tile label={`Active time, ${days} days`} value={activeSeconds} format={formatDuration} />
      </section>

      <section className={styles.panel} aria-labelledby="sleep-title">
        <Call method="getSleepDaily" args={[start, end]} result={rows(nights.length, "night", "nights")} ms={ms?.sleep} />
        <div className={styles.body}>
          <h2 id="sleep-title" className={styles.srOnly}>
            Sleep
          </h2>
          {nights.length === 0 ? (
            <p className={styles.empty}>
              No sleep data between {start} and {end}. Wear your watch to bed and sync it, then reload.
            </p>
          ) : (
            <div className={styles.charts}>
              <ColumnChart title="Sleep score" dates={dates} values={nights.map((n) => n.score)} yMax={100} unit="score" />
              <ColumnChart title="Sleep duration" dates={dates} values={nights.map((n) => n.hours)} unit="hours" />
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="activities-title">
        <Call
          method="getActivitiesByDate"
          args={[start, end]}
          result={rows(activities.length, "activity", "activities")}
          ms={ms?.activities}
        />
        <div className={styles.body}>
          <h2 id="activities-title" className={styles.srOnly}>
            Activities
          </h2>
          {activities.length === 0 ? (
            <p className={styles.empty}>
              No activities between {start} and {end}. Record one on your watch and sync it, then reload.
            </p>
          ) : (
            <>
              <ol className={styles.activities}>
                {activities.slice(0, LIST_LIMIT).map((a) => (
                  <li key={a.id} style={{ "--sport": `var(--sport-${a.sport})` } as React.CSSProperties}>
                    <span className={styles.icon}>
                      <ActivityIcon sport={a.sport} />
                    </span>
                    <span className={styles.what}>
                      <strong>{a.name}</strong>
                      <span>
                        {typeLabel(a.typeKey)} · {formatStart(a.start)}
                      </span>
                    </span>
                    <span className={`${styles.num} ${styles.dist}`}>{a.km === null ? "" : `${a.km.toFixed(2)} km`}</span>
                    <span className={`${styles.num} ${styles.dur}`}>{formatDuration(a.seconds)}</span>
                  </li>
                ))}
              </ol>
              {activities.length > LIST_LIMIT && (
                <p className={styles.more}>
                  Showing the latest {LIST_LIMIT} of {activities.length}.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        Built with <a href="https://github.com/DynamicsNinja/garminconnect-js">garminconnect-js</a> and
        Next.js — <a href="https://github.com/DynamicsNinja/garminconnect-nextjs-starter">use this starter</a>.
        Unofficial — not affiliated with or endorsed by Garmin.
      </footer>
    </main>
  );
}

function Tile(props: { label: string; value: number | null; unit?: string; format?: (v: number | null) => string }) {
  const text = props.format ? props.format(props.value) : props.value === null ? "—" : String(Math.round(props.value));
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{props.label}</span>
      <span className={styles.tileValue}>
        {text}
        {props.value !== null && props.unit && <small> {props.unit}</small>}
      </span>
    </div>
  );
}
