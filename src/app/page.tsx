import Link from "next/link";
import { connection } from "next/server";
import { GarminAuthError } from "garminconnect-js";
import { logout } from "@/app/actions";
import { ActivityIcon } from "@/components/ActivityIcon";
import { Call } from "@/components/Call";
import { ColumnChart, LineChart } from "@/components/charts";
import { LoginForm } from "@/components/LoginForm";
import { formatDuration, formatStart, toActivities, typeLabel, type ActivityRow } from "@/lib/activities";
import { badgeDescriptions } from "@/lib/badge-text";
import { demoActivities, demoBadges, demoHeart, demoNights, demoRecords, demoSeries } from "@/lib/demo";
import { getGarmin } from "@/lib/garmin";
import { toHeartDays, type HeartDay } from "@/lib/heart";
import { MODE } from "@/lib/mode";
import {
  formatRecord,
  seriesCandidate,
  toBadges,
  toRecords,
  toSeries,
  type Badge,
  type BadgeSeries,
  type PersonalRecordRow,
} from "@/lib/records";
import { eachDay, formatHours, range, shortDate, toNights, type Night } from "@/lib/sleep";
import styles from "./page.module.css";

const RANGES = [7, 30, 90] as const;
const LIST_LIMIT = 20;
const BADGE_LIMIT = 8;

/** Runs a library call and measures it, so each panel can show how long Garmin took. */
async function timed<T>(call: Promise<T>): Promise<{ value: T; ms: number }> {
  const t = performance.now();
  const value = await call;
  return { value, ms: Math.round(performance.now() - t) };
}

/**
 * Like `timed`, but a failure fills only its own panel instead of the whole page. An expired
 * session still throws, so the page can ask the visitor to sign in again.
 */
async function attempt<T>(call: Promise<T>): Promise<{ value: T; ms: number } | { error: string }> {
  try {
    return await timed(call);
  } catch (e) {
    if (e instanceof GarminAuthError) throw e;
    console.error(e);
    return { error: e instanceof Error ? e.name : "Error" };
  }
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
  // The heart, records and badge panels: their rows, or null when their call threw (see `errors`).
  let heart: HeartDay[] | null = null;
  let records: { records: PersonalRecordRow[]; other: number } | null = null;
  let badges: Badge[] | null = null;
  // The series around the newest series badge, and the badge `getBadgeDetail` was called for.
  let series: BadgeSeries | null = null;
  let seriesFor: Badge | undefined;
  const errors: Partial<Record<"rhr" | "hrv" | "records" | "badges" | "series", string>> = {};
  // Milliseconds per call; null for synthetic data, which calls nothing.
  let ms: Partial<Record<"name" | "sleep" | "activities" | "rhr" | "hrv" | "records" | "badges" | "series", number>> | null =
    null;
  if (!garmin) {
    [nights, activities, name] = [demoNights(start, end), demoActivities(start, end), "Demo athlete"];
    [heart, records, badges] = [demoHeart(start, end), { records: demoRecords(end), other: 0 }, demoBadges(end)];
    [series, seriesFor] = [demoSeries(), seriesCandidate(badges)];
  } else {
    try {
      const [n, s, a, rhr, hrv, prs, bdg, text] = await Promise.all([
        timed(garmin.fullName()),
        timed(garmin.getSleepDaily(start, end)),
        timed(garmin.getActivitiesByDate(start, end)),
        attempt(garmin.getRhrDaily(start, end)),
        attempt(garmin.getHrvDataRange(start, end)),
        attempt(garmin.getPersonalRecord()),
        attempt(garmin.getEarnedBadges()),
        badgeDescriptions(),
      ]);
      [name, nights, activities] = [n.value, toNights(s.value), toActivities(a.value)];
      ms = { name: n.ms, sleep: s.ms, activities: a.ms };
      for (const [key, o] of [["rhr", rhr], ["hrv", hrv], ["records", prs], ["badges", bdg]] as const) {
        if ("error" in o) errors[key] = o.error;
        else ms[key] = o.ms;
      }
      // One row per day, so a failed RHR or HRV call still leaves the other chart drawn.
      heart = toHeartDays(eachDay(start, end), "value" in rhr ? rhr.value : [], "value" in hrv ? hrv.value : null);
      if ("value" in prs) records = toRecords(prs.value);
      if ("value" in bdg) badges = toBadges(bdg.value, text);
      // Needs a badge id from the list above, so it can't join the parallel batch.
      seriesFor = badges ? seriesCandidate(badges) : undefined;
      if (seriesFor) {
        const detail = await attempt(garmin.getBadgeDetail(seriesFor.id));
        if ("error" in detail) errors.series = detail.error;
        else [series, ms.series] = [toSeries(detail.value), detail.ms];
      }
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
  const heartDates = heart?.map((d) => d.date) ?? [];
  const lastRhr = heart?.findLast((d) => d.rhr !== null)?.rhr ?? null;
  const lastHrv = heart?.findLast((d) => d.hrv !== null)?.hrv ?? null;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const rows = (n: number, one: string, many: string) => `${count(n, one, many)}${garmin ? "" : " (synthetic)"}`;
  // What a call bar says came back: a count, or the error the call threw.
  const outcome = (key: keyof typeof errors, n: number, one: string, many: string) =>
    errors[key] ? `threw ${errors[key]}` : rows(n, one, many);

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
        <Tile label="Resting heart rate, latest" value={lastRhr} unit="bpm" />
        <Tile label="HRV, last night" value={lastHrv} unit="ms" />
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

      <section className={styles.panel} aria-labelledby="heart-title">
        <Call
          method="getRhrDaily"
          args={[start, end]}
          result={outcome("rhr", heart?.filter((d) => d.rhr !== null).length ?? 0, "day", "days")}
          ms={ms?.rhr}
        />
        <Call
          method="getHrvDataRange"
          args={[start, end]}
          result={outcome("hrv", heart?.filter((d) => d.hrv !== null).length ?? 0, "night", "nights")}
          ms={ms?.hrv}
        />
        <div className={styles.body}>
          <h2 id="heart-title" className={styles.srOnly}>
            Heart
          </h2>
          {!heart || (lastRhr === null && lastHrv === null) ? (
            <p className={styles.empty}>
              No resting heart rate or HRV between {start} and {end}. Both come from wearing your watch
              overnight; sync it, then reload.
            </p>
          ) : (
            <div className={styles.charts}>
              <LineChart title="Resting heart rate" dates={heartDates} values={heart.map((d) => d.rhr)} unit="bpm" />
              <LineChart title="Overnight HRV" dates={heartDates} values={heart.map((d) => d.hrv)} unit="ms" />
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="records-title">
        <Call
          method="getPersonalRecord"
          result={outcome("records", records?.records.length ?? 0, "running record", "running records")}
          ms={ms?.records}
        />
        <Call method="getEarnedBadges" result={outcome("badges", badges?.length ?? 0, "badge", "badges")} ms={ms?.badges} />
        {seriesFor && (
          <Call
            method="getBadgeDetail"
            args={[seriesFor.id]}
            result={outcome("series", series?.steps.length ?? 0, "badge in its series", "badges in its series")}
            ms={ms?.series}
          />
        )}
        <div className={`${styles.body} ${styles.split}`}>
          <div>
            <h2 id="records-title" className={styles.heading}>
              Personal records
            </h2>
            {!records ? (
              <p className={styles.empty}>Garmin didn&apos;t return personal records. Reload to try again.</p>
            ) : records.records.length === 0 ? (
              <p className={styles.empty}>No running records yet. Garmin sets them from your runs.</p>
            ) : (
              <table className={styles.records}>
                <tbody>
                  {records.records.map((r) => (
                    <tr key={r.typeId}>
                      <th scope="row">{r.label}</th>
                      <td className={styles.num}>{formatRecord(r)}</td>
                      <td className={styles.where}>
                        {r.activityId !== null ? (
                          <a href={`https://connect.garmin.com/modern/activity/${r.activityId}`}>{r.activityName || "Activity"}</a>
                        ) : (
                          r.activityName
                        )}
                        {r.date && <span>{shortDate(r.date)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {records && records.other > 0 && (
              <p className={styles.more}>
                Plus {count(records.other, "record", "records")} in other sports, whose units this demo doesn&apos;t map.
              </p>
            )}
          </div>
          <div>
            <h2 className={styles.heading}>Latest badges</h2>
            {!badges ? (
              <p className={styles.empty}>Garmin didn&apos;t return badges. Reload to try again.</p>
            ) : badges.length === 0 ? (
              <p className={styles.empty}>No badges earned yet.</p>
            ) : (
              <>
                <ul className={styles.badges}>
                  {badges.slice(0, BADGE_LIMIT).map((b) => (
                    <li key={b.id}>
                      <BadgeArt image={b.image} />
                      <span className={styles.badgeText}>
                        <span className={styles.badgeTitle}>
                          <strong>{b.name}</strong>
                          {b.times > 1 && <span className={styles.times}>×{b.times}</span>}
                        </span>
                        {(b.description || b.activity) && (
                          <span className={styles.badgeMeta}>
                            {b.description}
                            {b.description && b.activity && " · "}
                            {b.activity &&
                              (b.activity.id ? (
                                <a href={`https://connect.garmin.com/modern/activity/${b.activity.id}`}>{b.activity.name}</a>
                              ) : (
                                b.activity.name
                              ))}
                          </span>
                        )}
                      </span>
                      <span className={styles.badgeDate}>{b.earned ? shortDate(b.earned) : ""}</span>
                    </li>
                  ))}
                </ul>
                {badges.length > BADGE_LIMIT && (
                  <p className={styles.more}>
                    Showing the latest {BADGE_LIMIT} of {badges.length}.
                  </p>
                )}
                {series && (
                  <>
                    <h3 className={styles.subheading}>The {series.name} series</h3>
                    <ol className={styles.series}>
                      {series.steps.map((s) => (
                        <li key={s.id} data-earned={s.earned} aria-current={s.current ? "step" : undefined}>
                          <BadgeArt image={s.image} />
                          <span>{s.name}</span>
                          <span className={styles.srOnly}>{s.earned ? "earned" : "not earned yet"}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}
          </div>
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

/** Garmin's badge artwork, or a plain disc for synthetic badges, which have none. */
function BadgeArt({ image }: { image: string | null }) {
  return image ? (
    // A plain <img>: next/image would proxy Garmin's artwork through this server.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={32} height={37} loading="lazy" referrerPolicy="no-referrer" className={styles.badgeImage} />
  ) : (
    <span className={styles.badgeImage} aria-hidden="true" />
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
