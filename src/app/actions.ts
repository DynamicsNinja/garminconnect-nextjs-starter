"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GarminAuthError, type MfaState } from "garminconnect-js";
import { newClient, tokenStore } from "@/lib/garmin";
import { seal, unseal } from "@/lib/seal";

export type LoginState = { step: "credentials" | "mfa"; error?: string };

// The half-finished MFA login. `mfaState` holds no password, but it IS a live, partially
// authenticated SSO session — so it is encrypted, httpOnly, short-lived, and deleted once used.
const MFA_COOKIE = "garmin_mfa";

function message(e: unknown): string {
  if (e instanceof GarminAuthError) return "Garmin rejected those credentials.";
  return e instanceof Error ? e.message : "Login failed.";
}

/** One action for both steps, so the form has a single state: the MFA form posts a `code`. */
export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  return form.has("code") ? verifyMfa(form) : login(form);
}

async function login(form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { step: "credentials", error: "Enter your Garmin email and password." };

  let result;
  try {
    result = await newClient().login(email, password);
  } catch (e) {
    return { step: "credentials", error: message(e) };
  }

  if (result.state === "mfa_required") {
    (await cookies()).set(MFA_COOKIE, seal(result.mfaState), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
    return { step: "mfa" };
  }
  redirect("/"); // outside try/catch: redirect() works by throwing
}

async function verifyMfa(form: FormData): Promise<LoginState> {
  const code = String(form.get("code") ?? "").trim();
  const jar = await cookies();
  const sealed = jar.get(MFA_COOKIE)?.value;
  const mfaState = sealed ? unseal<MfaState>(sealed) : null;
  if (!mfaState) return { step: "credentials", error: "That sign-in expired. Start again." };
  if (!code) return { step: "mfa", error: "Enter the code Garmin sent you." };

  try {
    await newClient().resumeLogin(mfaState, code);
  } catch (e) {
    return { step: "mfa", error: message(e) };
  }
  jar.delete(MFA_COOKIE);
  redirect("/");
}

export async function logout(): Promise<void> {
  await tokenStore.clear();
  redirect("/");
}
