import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

type Params = { params: Promise<{ id: string }> };

// GET /api/properties/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data, error } = await supabase
    .from("properties")
    .select(`
      *,
      units (
        id, unit_number, floor, type, area, room_count, mea
      )
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/properties/:id
export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const allowed = [
    // Identifikation
    "name", "type", "usage_type", "year_built",
    "last_renovation_year", "last_renovation_notes", "managed_since",
    // Adresse
    "street", "house_number", "zip_code", "city", "state", "country",
    "location_description",
    // Flächen
    "total_area", "living_area", "usable_area", "plot_area",
    "unit_count", "room_count", "bathroom_count", "floor",
    // Eigentum & Grundbuch
    "gemarkung", "flur", "flurstueck",
    "land_register_volume", "land_register_sheet", "is_weg",
    // Technik
    "heating_type", "energy_class", "energy_certificate",
    "has_elevator", "parking_spaces", "has_balcony", "has_terrace", "is_furnished",
    // Miete
    "rental_status", "short_term_rental_allowed",
    // Kosten
    "monthly_reserve", "monthly_operating_costs", "monthly_management_costs",
    // Versicherungen
    "insurances",
    // Recht & Behörden
    "building_permit_info", "usage_change_info", "misuse_status", "is_monument",
    // Immobilienoptimierung (Analyse-Felder)
    "objektfaktor", "gemeinde_id", "erhaltungssatzung", "bodenrichtwert", "bgf_qm",
    // Finanzierungsparameter (für Rendite-Kennzahlen)
    "kaufpreis_eur", "erwerbsnebenkosten_eur", "eingesetztes_ek_eur", "fremdkapital_eur", "fk_zins_pct",
    // Sonstiges
    "notes",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/properties/:id (soft-delete)
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const { error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
