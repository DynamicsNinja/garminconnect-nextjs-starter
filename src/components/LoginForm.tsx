"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/actions";
import type { Mode } from "@/lib/mode";
import styles from "./LoginForm.module.css";

const START: LoginState = { step: "credentials" };

/** `mode` comes from the server: this is a Client Component, so it cannot read server env vars. */
export function LoginForm({ mode, notice }: { mode: Mode; notice?: string }) {
  // One state machine for both steps: signIn() answers { step: "mfa" } when Garmin wants a code,
  // and { step: "credentials" } again if that pending sign-in expires.
  const [state, action, pending] = useActionState(signIn, START);

  return (
    <section className={styles.card}>
      <h1>{mode === "public" ? "Sign in with Garmin" : "Connect your Garmin account"}</h1>
      {mode === "public" ? (
        <div className={styles.lead}>
          <p>
            This site runs the open-source{" "}
            <a href="https://github.com/DynamicsNinja/garminconnect-nextjs-starter">garminconnect-nextjs-starter</a>.
            It is unofficial and not affiliated with Garmin.
          </p>
          <ul>
            <li>Your email and password are sent to Garmin&apos;s sign-in service and never stored.</li>
            <li>Your session is kept only in your browser, as an encrypted cookie. Nothing about you is saved on this server.</li>
            <li>The app only reads your sleep data. Sign out removes the cookie.</li>
          </ul>
          <p>
            Rather not type your password into someone else&apos;s site? Fair — run the template
            locally instead. <Link href="/privacy">Privacy note</Link>.
          </p>
        </div>
      ) : (
        <p className={styles.lead}>
          Your password goes to Garmin&apos;s sign-in service and nowhere else. Only the resulting
          tokens are kept, in <code>.garmin-tokens/</code> on this machine.
        </p>
      )}
      {notice && <p className={styles.notice}>{notice}</p>}

      {state.step === "mfa" ? (
        <form action={action} className={styles.form} key="mfa">
          <label>
            Verification code
            <input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required />
          </label>
          <p className={styles.hint}>Garmin sent a code to your email or phone.</p>
          <button disabled={pending}>{pending ? "Verifying…" : "Verify"}</button>
          <p className={styles.error} aria-live="polite">{state.error}</p>
        </form>
      ) : (
        <form action={action} className={styles.form} key="credentials">
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
          <p className={styles.error} aria-live="polite">{state.error}</p>
        </form>
      )}
      {mode === "public" && (
        <p className={styles.back}>
          <Link href="/">← Back to the demo</Link>
        </p>
      )}
    </section>
  );
}
