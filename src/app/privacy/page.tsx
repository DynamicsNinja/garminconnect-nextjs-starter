import Link from "next/link";
import { connection } from "next/server";
import styles from "../page.module.css";

export const metadata = { title: "Privacy — garminconnect-js demo" };

/** What this app does with a visitor's data, stated as facts about the code. Not legal advice. */
export default async function Privacy() {
  await connection(); // read PRIVACY_CONTACT at request time, not build time
  const contact = process.env.PRIVACY_CONTACT;
  return (
    <main className={styles.main} style={{ maxWidth: 720 }}>
      <h1>Privacy</h1>
      <p>
        This site runs <a href="https://github.com/DynamicsNinja/garminconnect-nextjs-starter">garminconnect-nextjs-starter</a>,
        which is open source, so everything below can be checked against the code. It is unofficial
        and not affiliated with or endorsed by Garmin.
      </p>

      <h2>When you sign in</h2>
      <ul>
        <li>
          Your email and password go from your browser to this server, and from it straight to
          Garmin&apos;s own sign-in service. They are not stored, logged, or sent anywhere else.
        </li>
        <li>
          If Garmin asks for a verification code, the half-finished sign-in is kept for up to ten
          minutes in an encrypted cookie in your browser, then deleted.
        </li>
        <li>
          Garmin returns access tokens. They are encrypted and kept <strong>only in your
          browser</strong>, as an httpOnly cookie that expires after 30 days. This server keeps no
          copy and has no database.
        </li>
      </ul>

      <h2>While you&apos;re signed in</h2>
      <ul>
        <li>
          Each page view reads your name, your recent sleep (score and duration) and your recent
          activities (name, type, start time, distance, duration) from Garmin, draws the page, and
          discards the data. It is not stored.
        </li>
        <li>The app only reads. It never writes anything to your Garmin account.</li>
      </ul>

      <h2>Signing out</h2>
      <p>
        <strong>Sign out</strong> deletes the token cookie. To also end the session on Garmin&apos;s
        side, change your Garmin password or review connected sessions in Garmin Connect.
      </p>

      <h2>Other data</h2>
      <p>
        To limit abuse, sign-in attempts are counted per IP address, in memory, for 15 minutes.
        Nothing else is collected: there is no analytics and no tracking.
      </p>

      {contact && (
        <>
          <h2>Contact</h2>
          <p>{contact}</p>
        </>
      )}

      <p style={{ marginTop: 32 }}>
        <Link href="/">← Back</Link>
      </p>
    </main>
  );
}
