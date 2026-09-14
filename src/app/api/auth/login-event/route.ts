import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { getClientIp } from "@/lib/request-ip";

// POST /api/auth/login-event
// Wird vom Client direkt nach erfolgreichem supabase.auth.signInWithPassword()
// aufgerufen (src/app/login/page.tsx) — Supabase Auth selbst feuert keinen
// serverseitigen Login-Hook, den wir sonst nutzen könnten. Protokolliert
// Zeitpunkt + IP (aus Proxy-Headern, s. request-ip.ts) + User-Agent.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { error } = await supabase.from("login_history").insert({
    tenant_id: tenantId,
    user_id: user.id,
    ip_address: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
