import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { getClientIp } from "@/lib/request-ip";

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

  const { error } = await supabase.from("usage_history").insert({
    tenant_id: tenantId,
    user_id: user.id,
    module: moduleName,
    path,
    ip_address: getClientIp(request),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
