import { NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";

// PATCH /api/optimization/szenarien?id=<uuid>  { name?, massnahme_ids? }
export async function PATCH(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("Pflichtparameter: id");

  const body = await request.json();

  // Name aktualisieren
  if (body.name != null) {
    const { error } = await supabase.from("szenario").update({ name: body.name }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Maßnahmen neu setzen (Verknüpfungen ersetzen)
  if (Array.isArray(body.massnahme_ids)) {
    await supabase.from("szenario_massnahme").delete().eq("szenario_id", id);
    if (body.massnahme_ids.length) {
      const rows = body.massnahme_ids.map((massnahme_id: string) => ({
        szenario_id: id, massnahme_id, tenant_id: tenantId,
      }));
      const { error } = await supabase.from("szenario_massnahme").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data } = await supabase
    .from("szenario")
    .select("*, szenario_massnahme ( massnahme_id )")
    .eq("id", id)
    .single();
  return NextResponse.json(data);
}

// DELETE /api/optimization/szenarien?id=<uuid>
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("Pflichtparameter: id");

  const { error } = await supabase.from("szenario").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET /api/optimization/szenarien?property_id=<uuid>
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  let query = supabase
    .from("szenario")
    .select("*, szenario_massnahme ( massnahme_id, massnahme:massnahme_id ( invest_eur ) ), kennzahlen_snapshot ( * )")
    .order("created_at", { ascending: false });
  if (propertyId) query = query.eq("property_id", propertyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/optimization/szenarien  { property_id, name, ist_baseline?, massnahme_ids?[] }
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id) return badRequest("Pflichtfeld: property_id");

  const { data: szenario, error } = await supabase
    .from("szenario")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      name: body.name ?? "Szenario",
      ist_baseline: body.ist_baseline ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const massnahmeIds: string[] = Array.isArray(body.massnahme_ids) ? body.massnahme_ids : [];
  if (massnahmeIds.length) {
    const rows = massnahmeIds.map((massnahme_id) => ({
      szenario_id: szenario.id,
      massnahme_id,
      tenant_id: tenantId,
    }));
    const { error: linkErr } = await supabase.from("szenario_massnahme").insert(rows);
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json(szenario, { status: 201 });
}
