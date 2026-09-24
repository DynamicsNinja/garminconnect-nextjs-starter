// Server-only. A small in-memory, fixed-window rate limiter for sign-in attempts.
//
// A public page that forwards email + password to Garmin is attractive for credential stuffing,
// and Garmin would blame — and eventually block — this server's IP, breaking sign-in for everyone.
// In-memory is enough for one long-running instance (Dokploy, a VPS, `next start`); several
// instances or a serverless host each keep their own counts, so use a shared store (Redis) there.
import { headers } from "next/headers";

const WINDOW_MS = 15 * 60 * 1000;
const PER_IP = 5; // sign-in attempts per IP per window
const GLOBAL = 60; // across all IPs per window: caps the damage from a distributed attempt

const hits = new Map<string, { count: number; reset: number }>();

function take(key: string, limit: number, now: number): boolean {
  const entry = hits.get(key);
  if (!entry || entry.reset <= now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/** The client IP as the reverse proxy reports it. Traefik (Dokploy) sets `x-real-ip`. */
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** `true` if this sign-in attempt may go ahead. Counts the attempt either way. */
export async function allowSignIn(): Promise<boolean> {
  const now = Date.now();
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }
  return take("global", GLOBAL, now) && take(`ip:${await clientIp()}`, PER_IP, now);
}
