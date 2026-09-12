import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/weg-buchhaltung/special-levies/[id]/units
// Body: { unit_id, amount } — Soll-Betrag (Cents) je Einheit für diese Sonderumlage.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id: levyId } = await params;

  const body = await request.json();
  if (!body.unit_id || body.amount === undefined || body.amount === null) {
    return badRequest("Pflichtfelder: unit_id, amount");
  }
  if (!Number.isInteger(body.amount) || body.amount < 0) return badRequest("amount muss ein ganzzahliger, nicht-negativer Cent-Betrag sein");

  const { data: levy, error: levyErr } = await supabase
    .from("special_levies").select("id, property_id, due_date, resolution_date").eq("id", levyId).single();
  if (levyErr || !levy) return badRequest("Sonderumlage nicht gefunden");

  const { data, error } = await supabase
    .from("special_levy_units")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      levy_id: levyId,
      unit_id: body.unit_id,
      amount: body.amount,
    })
    .select("id, levy_id, unit_id, amount, units ( unit_number )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sollstellung (Receivable, kind = 'special_levy') für die Ausgleichszuordnung
  // beim Zahlungseingang (B7.1/B7.6). Fälligkeit: Fälligkeitsdatum der Sonderumlage,
  // ersatzweise Beschlussdatum.
  let needsReview = false;
  if (body.amount > 0) {
    const dueDate = levy.due_date ?? levy.resolution_date;
    const { data: ownerRole } = await supabase
      .from("contact_roles")
      .select("contact_id")
      .eq("unit_id", body.unit_id)
      .eq("role", "owner")
      .lte("valid_from", dueDate)
      .or(`valid_to.is.null,valid_to.gte.${dueDate}`)
      .order("is_primary", { ascending: false })
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ownerRole) {
      await supabase.from("receivables").insert({
        tenant_id: tenantId,
        property_id: levy.property_id,
        unit_id: body.unit_id,
        owner_id: ownerRole.contact_id,
        kind: "special_levy",
        amount: body.amount,
        due_date: dueDate,
        source_special_levy_unit_id: data.id,
        created_by: user.id,
      });
    } else {
      needsReview = true;
    }
  }

  return NextResponse.json({ ...data, paid: 0, needs_review: needsReview }, { status: 201 });
}
