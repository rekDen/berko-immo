import type { NextRequest } from "next/server";

/**
 * Ermittelt die Client-IP aus den üblichen Proxy-Headern. Next.js' `NextRequest`
 * hat kein eigenes `.ip` mehr (Vercel-spezifisch, entfernt) — Standard-Weg ist
 * `x-forwarded-for` (erster Eintrag = ursprünglicher Client), Fallback `x-real-ip`.
 * Liefert `null`, wenn keiner der Header gesetzt ist (z. B. lokal ohne Proxy).
 */
export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}
