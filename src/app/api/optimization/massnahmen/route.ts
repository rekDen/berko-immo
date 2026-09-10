import { NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";

// GET /api/optimization/massnahmen?property_id=<uuid>&szenario_id=<uuid>
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId  = request.nextUrl.searchParams.get("property_id");
  const szenarioId  = request.nextUrl.searchParams.get("szenario_id");

  if (szenarioId) {
    // Nur die Maßnahmen dieses Szenarios, in der Reihenfolge der Verknüpfung
    const { data, error } = await supabase
      .from("szenario_massnahme")
      .select("massnahme:massnahme_id ( *, massnahme_typ ( kategorie, klasse, label, constraint_codes ) )")
      .eq("szenario_id", szenarioId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map((r: Record<string, unknown>) => r.massnahme));
  }

  let query = supabase
    .from("massnahme")
    .select("*, massnahme_typ ( kategorie, klasse, label, constraint_codes )")
    .order("created_at", { ascending: false });
  if (propertyId) query = query.eq("property_id", propertyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/optimization/massnahmen
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.typ_code)
    return badRequest("Pflichtfelder: property_id, typ_code");

  const { data, error } = await supabase
    .from("massnahme")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      typ_code: body.typ_code,
      potenzialflaeche_id: body.potenzialflaeche_id ?? null,
      params: body.params ?? {},
    })
    .select("*, massnahme_typ ( kategorie, klasse, label, constraint_codes )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/optimization/massnahmen?id=<uuid>  { invest_eur, ertragswirkung_pa_eur, amortisation_jahre, params }
export async function PATCH(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("Pflichtparameter: id");

  const body = await request.json();
  const allowed = ["invest_eur", "ertragswirkung_pa_eur", "amortisation_jahre", "params"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];

  const { data, error } = await supabase
    .from("massnahme")
    .update(updates)
    .eq("id", id)
    .select("*, massnahme_typ ( kategorie, klasse, label, constraint_codes )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/optimization/massnahmen?id=<uuid>
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("Pflichtparameter: id");

  const { error } = await supabase.from("massnahme").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
