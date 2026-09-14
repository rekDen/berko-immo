import { NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/admin/users/[userId]/activity — Login- und Nutzungshistorie
// eines einzelnen Nutzers. Nur für Tenant-Admins (zusätzlich zur RLS auf
// login_history/usage_history explizit geprüft, für eine klare 403-Antwort
// statt einer leeren Liste).
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { userId } = await params;

  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (myProfile?.role !== "tenant_admin") return NextResponse.json({ error: "Nur für Administratoren" }, { status: 403 });

  const { data: targetProfile, error: targetErr } = await supabase
    .from("profiles").select("id, name, tenant_id").eq("id", userId).single();
  if (targetErr || !targetProfile || targetProfile.tenant_id !== tenantId) return badRequest("Nutzer nicht gefunden");

  const [{ data: logins, error: loginsErr }, { data: usage, error: usageErr }] = await Promise.all([
    supabase.from("login_history").select("id, ip_address, user_agent, logged_in_at")
      .eq("user_id", userId).order("logged_in_at", { ascending: false }).limit(200),
    supabase.from("usage_history").select("id, module, path, ip_address, visited_at")
      .eq("user_id", userId).order("visited_at", { ascending: false }).limit(500),
  ]);
  if (loginsErr) return NextResponse.json({ error: loginsErr.message }, { status: 500 });
  if (usageErr) return NextResponse.json({ error: usageErr.message }, { status: 500 });

  return NextResponse.json({ user: targetProfile, logins: logins ?? [], usage: usage ?? [] });
}
