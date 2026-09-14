import { NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/users — Liste aller Nutzer des eigenen Mandanten
// (Nutzerverwaltung → Login-/Nutzungshistorie). Nur für Tenant-Admins.
export async function GET() {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (myProfile?.role !== "tenant_admin") return NextResponse.json({ error: "Nur für Administratoren" }, { status: 403 });

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name, first_name, last_name, role")
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = createAdminClient();
  const withEmail = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      return { ...p, email: data.user?.email ?? null };
    }),
  );

  return NextResponse.json(withEmail);
}
