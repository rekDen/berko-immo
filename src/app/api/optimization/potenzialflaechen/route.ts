import { NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";

// GET /api/optimization/potenzialflaechen?property_id=<uuid>
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  let query = supabase.from("potenzialflaeche").select("*").order("created_at", { ascending: false });
  if (propertyId) query = query.eq("property_id", propertyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/optimization/potenzialflaechen
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.art) return badRequest("Pflichtfelder: property_id, art");

  const { data, error } = await supabase
    .from("potenzialflaeche")
    .insert({
      tenant_id: tenantId,
      property_id: body.property_id,
      art: body.art,
      flaeche_qm: body.flaeche_qm ?? null,
      menge: body.menge ?? null,
      beschreibung: body.beschreibung ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/optimization/potenzialflaechen?id=<uuid>
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("Pflichtparameter: id");

  const { error } = await supabase.from("potenzialflaeche").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
