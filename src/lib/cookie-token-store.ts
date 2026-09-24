// Server-only. A TokenStore that keeps each visitor's Garmin tokens in THEIR browser — never on
// the server — as an encrypted, httpOnly cookie.
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { cookies } from "next/headers";
import type { TokenStore, Tokens } from "garminconnect-js";
import { seal, unseal } from "./seal";

const NAME = "garmin_tokens";
// Browsers cap a cookie at ~4 KB including its name and attributes. The OAuth2 access token alone
// is ~2 KB, so the sealed value is compressed and, if it is still too long, split across cookies.
const CHUNK = 3500;
const MAX_CHUNKS = 3;
// The OAuth1 token that drives refresh lasts about 30 days; past that the visitor signs in again.
const MAX_AGE = 30 * 24 * 60 * 60;

const options = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export const cookieTokenStore: TokenStore = {
  async load(): Promise<Tokens | null> {
    const jar = await cookies();
    let sealed = "";
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const part = jar.get(`${NAME}.${i}`)?.value;
      if (!part) break;
      sealed += part;
    }
    if (!sealed) return null;
    const packed = unseal<string>(sealed);
    if (!packed) return null;
    try {
      const tokens = JSON.parse(inflateRawSync(Buffer.from(packed, "base64")).toString("utf8")) as Tokens;
      // An expiry that didn't survive would make every refresh decision guess. Treat it as signed out.
      const o2 = tokens.oauth2 as { expires_at?: unknown; refresh_token_expires_at?: unknown } | undefined;
      if (typeof o2?.expires_at !== "number" || typeof o2.refresh_token_expires_at !== "number") return null;
      return tokens;
    } catch {
      return null;
    }
  },

  async save(tokens: Tokens): Promise<void> {
    const packed = deflateRawSync(Buffer.from(JSON.stringify(tokens), "utf8")).toString("base64");
    const sealed = seal(packed);
    const parts = sealed.match(new RegExp(`.{1,${CHUNK}}`, "g")) ?? [];
    if (parts.length > MAX_CHUNKS) throw new Error("Garmin tokens are too large to keep in cookies");
    try {
      const jar = await cookies();
      parts.forEach((part, i) => jar.set(`${NAME}.${i}`, part, options));
      for (let i = parts.length; i < MAX_CHUNKS; i++) jar.delete(`${NAME}.${i}`);
    } catch {
      // A Server Component can read cookies but not set them. This fires when the library refreshes
      // an expired access token during a page render: the fresh token is used for this request and
      // simply refreshed again next time (from the still-valid OAuth1 token). Sign-in and sign-out
      // run in Server Actions, where setting works.
    }
  },

  async clear(): Promise<void> {
    const jar = await cookies();
    for (let i = 0; i < MAX_CHUNKS; i++) jar.delete(`${NAME}.${i}`);
  },
};
