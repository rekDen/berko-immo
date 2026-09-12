import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-buchhaltung/special-levies?property_id=...
// Sonderumlagen inkl. Soll je Einheit (Spec 5.6, weg-buchhaltung-spec.md 5.6).
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data: levies, error: leviesErr } = await supabase
    .from("special_levies")
    .select("id, resolution_date, purpose, due_date")
    .eq("property_id", propertyId)
    .order("resolution_date", { ascending: false });
  if (leviesErr) return NextResponse.json({ error: leviesErr.message }, { status: 500 });

  const { data: units, error: unitsErr } = await supabase
    .from("special_levy_units")
    .select("id, levy_id, unit_id, amount, units ( unit_number )")
    .in("levy_id", (levies ?? []).map((l) => l.id));
  if (unitsErr) return NextResponse.json({ error: unitsErr.message }, { status: 500 });

  const { data: payments, error: paymentsErr } = await supabase
    .from("transactions")
    .select("special_levy_id, unit_id, amount")
    .in("special_levy_id", (levies ?? []).map((l) => l.id))
    .eq("status", "confirmed");
  if (paymentsErr) return NextResponse.json({ error: paymentsErr.message }, { status: 500 });

  const result = (levies ?? []).map((l) => ({
    ...l,
    units: (units ?? []).filter((u) => u.levy_id === l.id).map((u) => ({
      ...u,
      paid: (payments ?? [])
        .filter((p) => p.special_levy_id === l.id && p.unit_id === u.unit_id)
        .reduce((sum, p) => sum + p.amount, 0),
    })),
  }));

  return NextResponse.json(result);
}

// POST /api/weg-buchhaltung/special-levies
// Body: { property_id, resolution_date, purpose, due_date? }
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.resolution_date || !body.purpose) {
    return badRequest("Pflichtfelder: property_id, resolution_date, purpose");
  }

  const { data, error } = await supabase
    .from("special_levies")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      resolution_date: body.resolution_date,
      purpose: body.purpose,
      due_date: body.due_date ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, units: [] }, { status: 201 });
}
