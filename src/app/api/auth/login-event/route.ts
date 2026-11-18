import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { getClientIp } from "@/lib/request-ip";
import { sendSystemNotification } from "@/lib/notify";

// Fester Empfänger für Login-Benachrichtigungen (auf Wunsch des
// Auftraggebers) — kein Vorlagensystem nötig für eine einzelne, feste Adresse.
const LOGIN_NOTIFICATION_EMAIL = "dennis@berko.ai";

// POST /api/auth/login-event
// Wird vom Client direkt nach erfolgreichem supabase.auth.signInWithPassword()
// aufgerufen (src/app/login/page.tsx) — Supabase Auth selbst feuert keinen
// serverseitigen Login-Hook, den wir sonst nutzen könnten. Protokolliert
// Zeitpunkt + IP (aus Proxy-Headern, s. request-ip.ts) + User-Agent und
// benachrichtigt zusätzlich per E-Mail, wenn sich irgendein Nutzer anmeldet.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const ip = getClientIp(request);
  const loggedInAt = new Date();

  const { error } = await supabase.from("login_history").insert({
    tenant_id: tenantId,
    user_id: user.id,
    ip_address: ip,
    user_agent: request.headers.get("user-agent"),
    logged_in_at: loggedInAt.toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nicht abgewartet — ein langsamer/fehlschlagender SMTP-Versand darf den
  // Login nicht verzögern (sendSystemNotification fängt Fehler bereits selbst ab).
  void sendSystemNotification({
    to: LOGIN_NOTIFICATION_EMAIL,
    subject: `Login: ${user.email ?? user.id}`,
    text:
      `Nutzer ${user.email ?? user.id} hat sich soeben angemeldet.\n\n` +
      `Zeitpunkt: ${loggedInAt.toLocaleString("de-DE", { dateStyle: "full", timeStyle: "medium" })}\n` +
      `IP-Adresse: ${ip ?? "unbekannt"}`,
  });

  return NextResponse.json({ ok: true });
}
