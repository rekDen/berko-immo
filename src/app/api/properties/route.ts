import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/properties?type=weg&search=berlin
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const type = searchParams.get("type");

  let query = supabase
    .from("properties")
    .select("id, name, street, house_number, zip_code, city, type, unit_count, year_built, managed_since, created_at, units(count)")
    .order("name", { ascending: true });

  if (type) query = query.eq("type", type);
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,street.ilike.%${search}%,city.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/properties
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.name) return badRequest("Pflichtfeld: name");

  const { data, error } = await supabase
    .from("properties")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      // Identifikation
      name: body.name,
      type: body.type ?? "weg",
      usage_type: body.usage_type ?? null,
      year_built: body.year_built ?? null,
      last_renovation_year: body.last_renovation_year ?? null,
      last_renovation_notes: body.last_renovation_notes ?? null,
      managed_since: body.managed_since ?? null,
      // Adresse
      street: body.street ?? null,
      house_number: body.house_number ?? null,
      zip_code: body.zip_code ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      country: body.country ?? "DE",
      location_description: body.location_description ?? null,
      // Flächen
      total_area: body.total_area ?? null,
      living_area: body.living_area ?? null,
      usable_area: body.usable_area ?? null,
      plot_area: body.plot_area ?? null,
      unit_count: body.unit_count ?? null,
      room_count: body.room_count ?? null,
      bathroom_count: body.bathroom_count ?? null,
      floor: body.floor ?? null,
      // Eigentum & Grundbuch
      gemarkung: body.gemarkung ?? null,
      flur: body.flur ?? null,
      flurstueck: body.flurstueck ?? null,
      land_register_volume: body.land_register_volume ?? null,
      land_register_sheet: body.land_register_sheet ?? null,
      is_weg: body.is_weg ?? (body.type === "weg"),
      // Technik
      heating_type: body.heating_type ?? null,
      energy_class: body.energy_class ?? null,
      energy_certificate: body.energy_certificate ?? null,
      has_elevator: body.has_elevator ?? null,
      parking_spaces: body.parking_spaces ?? null,
      has_balcony: body.has_balcony ?? null,
      has_terrace: body.has_terrace ?? null,
      is_furnished: body.is_furnished ?? null,
      // Miete
      rental_status: body.rental_status ?? null,
      short_term_rental_allowed: body.short_term_rental_allowed ?? null,
      // Kosten
      monthly_reserve: body.monthly_reserve ?? null,
      monthly_operating_costs: body.monthly_operating_costs ?? null,
      monthly_management_costs: body.monthly_management_costs ?? null,
      // Versicherungen
      insurances: body.insurances ?? [],
      // Recht
      building_permit_info: body.building_permit_info ?? null,
      usage_change_info: body.usage_change_info ?? null,
      misuse_status: body.misuse_status ?? null,
      is_monument: body.is_monument ?? null,
      // Sonstiges
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
