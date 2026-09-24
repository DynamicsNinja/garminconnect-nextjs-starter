// Server-only. Never import this from a Client Component: it reads tokens off disk.
import { FileTokenStore, Garmin, GarminClient } from "garminconnect-js";

/**
 * Tokens live on disk in `.garmin-tokens/` (gitignored), in the same format Python's garth uses.
 * That suits one person running this locally. For a deployed, multi-user app, implement
 * `TokenStore` against your database, keyed by your own user id — see the README.
 */
export const tokenStore = new FileTokenStore(process.env.GARMIN_TOKEN_DIR ?? ".garmin-tokens");

export function newClient(): GarminClient {
  return new GarminClient({ tokenStore });
}

/** A ready `Garmin`, or `null` when nobody has connected yet. */
export async function getGarmin(): Promise<Garmin | null> {
  const client = newClient();
  return (await client.loadTokens()) ? new Garmin(client) : null;
}
