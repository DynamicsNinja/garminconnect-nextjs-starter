import Link from "next/link";
import { connection } from "next/server";
import { GarminAuthError } from "garminconnect-js";
import { logout } from "@/app/actions";
import { ColumnChart, LineChart } from "@/components/charts";
import { LoginForm } from "@/components/LoginForm";
import { demoNights } from "@/lib/demo";
import { getGarmin } from "@/lib/garmin";
import { MODE } from "@/lib/mode";
import { formatHours, range, toNights, type Night } from "@/lib/sleep";
import styles from "./page.module.css";

const RANGES = [7, 30, 90] as const;

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
  let name: string;
  if (!garmin) {
    [nights, name] = [demoNights(start, end), "Demo data"];
  } else {
    try {
      // One call covers everything below: getSleepDaily carries score, duration, HRV and resting HR.
      [nights, name] = await Promise.all([garmin.getSleepDaily(start, end).then(toNights), garmin.fullName()]);
    } catch (e) {
      if (e instanceof GarminAuthError) {
        return <LoginForm mode={MODE} notice="Your Garmin session has expired. Sign in again to reconnect." />;
      }
      throw e;
    }
  }

  const dates = nights.map((n) => n.date);
  const last = nights.findLast((n) => n.score !== null || n.hours !== null);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>Sleep &amp; HRV</h1>
          <p className={styles.sub}>{name}</p>
        </div>
        {garmin && (
          <form action={logout}>
            <button className={styles.ghost}>{MODE === "public" ? "Sign out" : "Disconnect"}</button>
          </form>
        )}
      </header>

      {!garmin && MODE === "public" && (
        <div className={styles.demo}>
          <p>
            <strong>You&apos;re looking at synthetic demo data.</strong> Sign in with your Garmin
            account to see your own sleep and HRV. Your password goes to Garmin only and is never
            stored; your session stays in your browser.
          </p>
          <Link href="/?signin" className={styles.cta}>
            Sign in with Garmin
          </Link>
        </div>
      )}
      {!garmin && MODE === "demo" && (
        <p className={styles.demo}>
          <strong>Live demo, synthetic data.</strong> To chart your own sleep and HRV, start from the{" "}
          <a href="https://github.com/DynamicsNinja/garminconnect-nextjs-starter">template</a> — it
          runs locally and signs in to your own Garmin account.
        </p>
      )}

      <nav className={styles.ranges} aria-label="Date range">
        {RANGES.map((r) => (
          <Link key={r} href={`/?days=${r}`} aria-current={r === days ? "page" : undefined}>
            Last {r} days
          </Link>
        ))}
      </nav>

      {nights.length === 0 ? (
        <p className={styles.empty}>
          No sleep data between {start} and {end}. Wear your watch to bed and sync it, then reload.
        </p>
      ) : (
        <>
          <section className={styles.tiles} aria-label="Last night">
            <Tile label="Sleep score" value={last?.score ?? null} />
            <Tile label="Sleep" value={last?.hours ?? null} format={formatHours} />
            <Tile label="Overnight HRV" value={last?.hrv ?? null} unit="ms" />
            <Tile label="Resting heart rate" value={last?.restingHr ?? null} unit="bpm" />
          </section>

          <section className={styles.charts}>
            <ColumnChart
              title="Sleep score"
              dates={dates}
              values={nights.map((n) => n.score)}
              yMax={100}
              unit="score"
            />
            <ColumnChart title="Sleep duration" dates={dates} values={nights.map((n) => n.hours)} unit="hours" />
            <LineChart
              title="Overnight HRV (ms)"
              dates={dates}
              series={[
                { name: "Nightly average", values: nights.map((n) => n.hrv), tone: "primary" },
                { name: "7-day average", values: nights.map((n) => n.hrv7d), tone: "secondary" },
              ]}
              unit="ms"
              wide
            />
          </section>
        </>
      )}

      <footer className={styles.footer}>
        Built with <a href="https://github.com/DynamicsNinja/garminconnect-js">garminconnect-js</a>.
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
