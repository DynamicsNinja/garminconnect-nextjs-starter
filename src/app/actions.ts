"use server";

import { deflateRawSync, inflateRawSync } from "node:zlib";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GarminAuthError, GarminError, GarminRateLimitError, type MfaState } from "garminconnect-js";
import { newClient, tokenStore } from "@/lib/garmin";
import { MODE } from "@/lib/mode";
import { allowSignIn } from "@/lib/rate-limit";
import { seal, unseal } from "@/lib/seal";

export type LoginState = { step: "credentials" | "mfa"; error?: string };

// The half-finished MFA login. `mfaState` holds no password, but it IS a live, partially
// authenticated SSO session — so it is encrypted, httpOnly, short-lived, and deleted once used.
const MFA_COOKIE = "garmin_mfa";
// Browsers cap a cookie at ~4 KB. A sign-in that went through Garmin's web widget carries more
// state than a mobile one, so the state is compressed before it is sealed.
const MAX_COOKIE = 3900;

function sealMfa(state: MfaState): string | null {
  const sealed = seal(deflateRawSync(Buffer.from(JSON.stringify(state), "utf8")).toString("base64"));
  return sealed.length <= MAX_COOKIE ? sealed : null;
}

function unsealMfa(sealed: string): MfaState | null {
  const packed = unseal<string>(sealed);
  if (!packed) return null;
  try {
    return JSON.parse(inflateRawSync(Buffer.from(packed, "base64")).toString("utf8")) as MfaState;
  } catch {
    return null;
  }
}

/**
 * Only an "SSO error:" means Garmin looked at the password or code and said no. A 403 or a
 * challenge page is Garmin (or Cloudflare) refusing the request, so say what actually happened.
 */
function message(e: unknown, step: LoginState["step"]): string {
  if (e instanceof GarminRateLimitError) {
    return "Garmin is rate limiting sign-ins from this server. Wait a while and try again.";
  }
  if (e instanceof GarminAuthError && e.message.startsWith("SSO error:")) {
    return step === "mfa" ? "Garmin rejected that code." : "Garmin rejected that email or password.";
  }
  if (e instanceof GarminError) return `Garmin sign-in failed: ${e.message}`;
  return e instanceof Error ? e.message : "Login failed.";
}

/** One action for both steps, so the form has a single state: the MFA form posts a `code`. */
export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  // Demo mode never renders the login form — but a Server Action is still a public POST endpoint,
  // so without this a demo deployment would relay anyone's Garmin login attempts.
  if (MODE === "demo") return { step: "credentials", error: "Sign-in is disabled in demo mode." };
  const step = form.has("code") ? "mfa" : "credentials";
  if (MODE === "public" && !(await allowSignIn())) {
    return { step, error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }
  return step === "mfa" ? verifyMfa(form) : login(form);
}

async function login(form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { step: "credentials", error: "Enter your Garmin email and password." };

  let result;
  try {
    result = await newClient().login(email, password);
  } catch (e) {
    return { step: "credentials", error: message(e, "credentials") };
  }

  if (result.state === "mfa_required") {
    const sealed = sealMfa(result.mfaState);
    if (!sealed) return { step: "credentials", error: "Garmin's sign-in state is too large to keep. Try again." };
    (await cookies()).set(MFA_COOKIE, sealed, {
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
  const mfaState = sealed ? unsealMfa(sealed) : null;
  if (!mfaState) return { step: "credentials", error: "That sign-in expired. Start again." };
  if (!code) return { step: "mfa", error: "Enter the code Garmin sent you." };

  try {
    await newClient().resumeLogin(mfaState, code);
  } catch (e) {
    return { step: "mfa", error: message(e, "mfa") };
  }
  jar.delete(MFA_COOKIE);
  redirect("/");
}

export async function logout(): Promise<void> {
  if (MODE !== "demo") await tokenStore.clear();
  redirect("/");
}
