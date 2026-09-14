import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/public/mietermatching/[unitId] — ÖFFENTLICH, kein Auth.
// Liefert nur, was ein Bewerber braucht, um die Selbstauskunft auszufüllen
// (Objekt-/Einheitenbezeichnung, akzeptierte Kriterien, Pflichtdokumente).
// Bewusst NICHT enthalten: tenant_id, Gewichtung, Score-Schwellenwerte,
// interne Notizen, andere Bewerber — alles, was nur intern relevant ist.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const admin = createAdminClient();

  const { data: unit, error: unitErr } = await admin
    .from("units")
    .select("unit_number, properties ( name, street, house_number, zip_code, city )")
    .eq("id", unitId)
    .is("deleted_at", null)
    .single();
  if (unitErr || !unit) return NextResponse.json({ error: "Einheit nicht gefunden" }, { status: 404 });

  const { data: profile, error: profileErr } = await admin
    .from("desired_tenant_profile")
    .select("employment_types_accepted, household_size_min, household_size_max, move_in_earliest, move_in_latest, schufa_required, required_documents")
    .eq("unit_id", unitId)
    .is("deleted_at", null)
    .maybeSingle();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Für diese Einheit ist aktuell keine Bewerbung möglich" }, { status: 404 });

  const property = unit.properties as unknown as { name: string; street: string | null; house_number: string | null; zip_code: string | null; city: string | null } | null;

  return NextResponse.json({
    unit_number: unit.unit_number,
    property_name: property?.name ?? "",
    property_address: property ? `${property.street ?? ""} ${property.house_number ?? ""}, ${property.zip_code ?? ""} ${property.city ?? ""}`.replace(/\s+/g, " ").trim() : "",
    employment_types_accepted: profile.employment_types_accepted,
    household_size_min: profile.household_size_min,
    household_size_max: profile.household_size_max,
    move_in_earliest: profile.move_in_earliest,
    move_in_latest: profile.move_in_latest,
    schufa_required: profile.schufa_required,
    required_documents: profile.required_documents,
  });
}
