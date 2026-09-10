import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

type Params = { params: Promise<{ id: string }> };

// GET /api/properties/:id/units
export async function GET(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data, error } = await supabase
    .from("units")
    .select(`
      *,
      contact_roles (
        id, contact_id, role, valid_from, valid_to, is_primary,
        contacts ( id, first_name, last_name, company_name, type )
      )
    `)
    .eq("property_id", id)
    .order("unit_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/properties/:id/units
export async function POST(request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id: propertyId } = await params;
  const body = await request.json();

  if (!body.unit_number) return badRequest("Pflichtfeld: unit_number");

  const { data, error } = await supabase
    .from("units")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: propertyId,
      unit_number: body.unit_number,
      floor: body.floor ?? null,
      location_description: body.location_description ?? null,
      type: body.type ?? "apartment",
      area: body.area ?? null,
      room_count: body.room_count ?? null,
      mea: body.mea ?? null,
      land_register_sheet: body.land_register_sheet ?? null,
      land_register_number: body.land_register_number ?? null,
      heating_type: body.heating_type ?? null,
      meter_numbers: body.meter_numbers ?? [],
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
