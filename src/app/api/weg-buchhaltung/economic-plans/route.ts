import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-buchhaltung/economic-plans?property_id=...
// Liefert Wirtschaftspläne inkl. ihrer Vorschüsse je Einheit (Spec 5.5).
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data: plans, error: plansErr } = await supabase
    .from("economic_plans")
    .select("id, year, resolution_date")
    .eq("property_id", propertyId)
    .order("year", { ascending: false });
  if (plansErr) return NextResponse.json({ error: plansErr.message }, { status: 500 });

  const { data: advances, error: advErr } = await supabase
    .from("plan_advances")
    .select("id, plan_id, unit_id, monthly_operating, monthly_reserve, valid_from, valid_to, units ( unit_number )")
    .in("plan_id", (plans ?? []).map((p) => p.id))
    .order("valid_from", { ascending: true });
  if (advErr) return NextResponse.json({ error: advErr.message }, { status: 500 });

  const result = (plans ?? []).map((p) => ({
    ...p,
    advances: (advances ?? []).filter((a) => a.plan_id === p.id),
  }));

  return NextResponse.json(result);
}

// POST /api/weg-buchhaltung/economic-plans
// Body: { property_id, year, resolution_date }
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.year || !body.resolution_date) {
    return badRequest("Pflichtfelder: property_id, year, resolution_date");
  }

  const { data, error } = await supabase
    .from("economic_plans")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      year: body.year,
      resolution_date: body.resolution_date,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, advances: [] }, { status: 201 });
}
