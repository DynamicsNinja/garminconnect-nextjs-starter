// Server-only. Never import this from a Client Component: it handles Garmin tokens.
import { FileTokenStore, Garmin, GarminClient, type TokenStore } from "garminconnect-js";
import { cookieTokenStore } from "./cookie-token-store";
import { MODE } from "./mode";

/**
 * Where tokens live depends on the mode (see `mode.ts`):
 *
 * - `local`: on disk in `.garmin-tokens/` (gitignored), garth-compatible — one person, one machine.
 * - `public`: in each visitor's own browser, as an encrypted httpOnly cookie. Nothing is kept on
 *   the server, so one visitor can never see another's data.
 *
 * For a deployed app with real user accounts, implement `TokenStore` against your database, keyed
 * by your own user id — see the README.
 */
export const tokenStore: TokenStore =
  MODE === "public"
    ? cookieTokenStore
    : new FileTokenStore(process.env.GARMIN_TOKEN_DIR ?? ".garmin-tokens");

export function newClient(): GarminClient {
  return new GarminClient({ tokenStore });
}

/** A ready `Garmin`, or `null` when nobody has connected yet (or in demo mode). */
export async function getGarmin(): Promise<Garmin | null> {
  if (MODE === "demo") return null;
  const client = newClient();
  return (await client.loadTokens()) ? new Garmin(client) : null;
}
