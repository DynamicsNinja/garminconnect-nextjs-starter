"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/actions";
import styles from "./LoginForm.module.css";

const START: LoginState = { step: "credentials" };

export function LoginForm({ notice }: { notice?: string }) {
  // One state machine for both steps: signIn() answers { step: "mfa" } when Garmin wants a code,
  // and { step: "credentials" } again if that pending sign-in expires.
  const [state, action, pending] = useActionState(signIn, START);

  return (
    <section className={styles.card}>
      <h1>Connect your Garmin account</h1>
      <p className={styles.lead}>
        Your password goes to Garmin&apos;s sign-in service and nowhere else. Only the resulting
        tokens are kept, in <code>.garmin-tokens/</code> on this machine.
      </p>
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
    </section>
  );
}
