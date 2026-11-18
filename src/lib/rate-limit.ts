/**
 * Einfacher In-Memory-Rate-Limiter (Fixed Window) für öffentliche Routen.
 *
 * Grenze: Der Zähler lebt pro Server-Prozess. Bei mehreren Instanzen
 * (Serverless, horizontale Skalierung) gilt das Limit pro Instanz. Für
 * strikte Limits auf einen geteilten Speicher (z. B. Redis/Upstash oder
 * eine Postgres-Tabelle) umstellen.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

/**
 * Zählt einen Treffer für `key`. Liefert `ok: false`, sobald mehr als
 * `limit` Treffer im Fenster `windowMs` auflaufen.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { ok: boolean; retryAfterSec: number } {
  sweep(now);
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  return { ok: bucket.count <= limit, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** Nur für Tests. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
