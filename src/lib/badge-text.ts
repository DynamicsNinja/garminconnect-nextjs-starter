// Badge descriptions. Garmin's badge API sends none; Garmin Connect's web app reads them from this
// public translation file (~1 MB of `key=value` lines), keyed `badge_description_<badgeKey>`.
const URL = "https://connect.garmin.com/web-translations/badges-list/badges-list.properties";
const DAY = 86_400;

let cached: { at: number; text: Map<string, string> } | null = null;

/**
 * `badgeKey` → description, fetched at most once a day per server process. Nobody's data is in it,
 * so it is safe to share across visitors in every mode. Returns an empty map if Garmin is
 * unreachable: descriptions are decoration, and the panel reads fine without them.
 */
export async function badgeDescriptions(): Promise<Map<string, string>> {
  if (cached && Date.now() - cached.at < DAY * 1000) return cached.text;
  try {
    const res = await fetch(URL, { next: { revalidate: DAY } });
    if (!res.ok) return cached?.text ?? new Map();
    cached = { at: Date.now(), text: parse(await res.text()) };
    return cached.text;
  } catch (e) {
    console.error(e);
    return cached?.text ?? new Map();
  }
}

const PREFIX = "badge_description_";

function parse(file: string): Map<string, string> {
  const text = new Map<string, string>();
  for (const line of file.split(/\r?\n/)) {
    if (!line.startsWith(PREFIX)) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    // Sponsored challenges put HTML links in their text; this page renders plain text only.
    const value = line
      .slice(eq + 1)
      .replace(/<[^>]*>/g, "")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .trim();
    if (value) text.set(line.slice(PREFIX.length, eq), value);
  }
  return text;
}
