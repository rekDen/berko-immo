import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// PATCH /api/weg-buchhaltung/special-levy-units/[id]
// Body: { amount } — Korrektur des Soll-Betrags.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  if (body.amount === undefined || body.amount === null) return badRequest("Pflichtfeld: amount");
  if (!Number.isInteger(body.amount) || body.amount < 0) return badRequest("amount muss ein ganzzahliger, nicht-negativer Cent-Betrag sein");

  const { data, error } = await supabase
    .from("special_levy_units")
    .update({ amount: body.amount })
    .eq("id", id)
    .select("id, levy_id, unit_id, amount, units ( unit_number )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
