/**
 * How this deployment behaves, from the environment:
 *
 * - `local` (default): one person on their own machine; tokens on disk in `.garmin-tokens/`.
 * - `public` (`GARMIN_PUBLIC=1`): a shared deployment. Each visitor's tokens live only in their own
 *   browser, in an encrypted httpOnly cookie. Visitors who aren't signed in see demo data.
 * - `demo` (`GARMIN_DEMO=1`): synthetic data only; sign-in is disabled.
 */
export type Mode = "local" | "public" | "demo";

export const MODE: Mode =
  process.env.GARMIN_DEMO === "1" ? "demo" : process.env.GARMIN_PUBLIC === "1" ? "public" : "local";
