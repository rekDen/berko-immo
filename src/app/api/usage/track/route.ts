import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { getClientIp } from "@/lib/request-ip";
import { sendSystemNotification } from "@/lib/notify";

const LOGIN_NOTIFICATION_EMAIL = "dennis@berko.ai";

// Ab dieser Inaktivitätsdauer gilt eine Navigation als "neu aktiv geworden"
// (nicht nur als Fortsetzung derselben Sitzung) und löst noch einmal eine
// Benachrichtigung aus — auch ohne dass sich der Nutzer erneut über das
// Login-Formular angemeldet hat (Supabase-Session bleibt lange gültig, s.
// Rückfrage des Auftraggebers: "was ist, wenn bereits eingeloggt ist und
// dann anfängt zu navigieren?").
const ACTIVITY_SESSION_GAP_MINUTES = 30;

// POST /api/usage/track
// Body: { module, path }. Wird clientseitig bei jedem Pfadwechsel innerhalb
// der App aufgerufen (src/components/UsageTracker.tsx), nicht bei jedem
// API-Request — sonst wäre die Schreibrate unverhältnismäßig hoch.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const moduleName = (body.module as string | undefined)?.slice(0, 100);
  const path = (body.path as string | undefined)?.slice(0, 500);
  if (!moduleName || !path) return badRequest("Pflichtfelder: module, path");

  const ip = getClientIp(request);
  const visitedAt = new Date();

  const [{ data: lastLogin }, { data: lastUsage }] = await Promise.all([
    supabase.from("login_history").select("logged_in_at").eq("user_id", user.id).order("logged_in_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("usage_history").select("visited_at").eq("user_id", user.id).order("visited_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const lastActivity = [lastLogin?.logged_in_at, lastUsage?.visited_at].filter(Boolean).map((d) => new Date(d as string).getTime());
  const minutesSinceLastActivity = lastActivity.length > 0 ? (visitedAt.getTime() - Math.max(...lastActivity)) / 60_000 : Infinity;

  const { error } = await supabase.from("usage_history").insert({
    tenant_id: tenantId,
    user_id: user.id,
    module: moduleName,
    path,
    ip_address: ip,
    visited_at: visitedAt.toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Direkt nach einem frischen Login (login-event benachrichtigt bereits
  // selbst) liegt die letzte Aktivität nur Sekunden zurück — hier also keine
  // doppelte Benachrichtigung. Erst nach einer echten Pause wird die
  // Wiederaufnahme der Nutzung gemeldet.
  if (minutesSinceLastActivity >= ACTIVITY_SESSION_GAP_MINUTES) {
    void sendSystemNotification({
      to: LOGIN_NOTIFICATION_EMAIL,
      subject: `Aktiv (ohne neuen Login): ${user.email ?? user.id}`,
      text:
        `Nutzer ${user.email ?? user.id} ist aktiv geworden (bestehende Sitzung, kein neuer Login).\n\n` +
        `Modul: ${moduleName}\n` +
        `Zeitpunkt: ${visitedAt.toLocaleString("de-DE", { dateStyle: "full", timeStyle: "medium" })}\n` +
        `IP-Adresse: ${ip ?? "unbekannt"}`,
    });
  }

  return NextResponse.json({ ok: true });
}
