import { NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";

// GET /api/optimization/mietvertraege?property_id=<uuid>
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  let query = supabase
    .from("mietvertrag")
    .select("*, units!inner ( id, unit_number, property_id )")
    .order("created_at", { ascending: false });
  if (propertyId) query = query.eq("units.property_id", propertyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/optimization/mietvertraege
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.unit_id || body.kaltmiete_eur == null)
    return badRequest("Pflichtfelder: unit_id, kaltmiete_eur");

  const { data, error } = await supabase
    .from("mietvertrag")
    .insert({
      tenant_id: tenantId,
      unit_id: body.unit_id,
      mietart: body.mietart ?? "standard",
      kaltmiete_eur: body.kaltmiete_eur,
      beginn: body.beginn ?? null,
      letzte_erhoehung: body.letzte_erhoehung ?? null,
      leerstand: body.leerstand ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
