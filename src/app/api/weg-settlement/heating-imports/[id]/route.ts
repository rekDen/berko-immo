import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// PATCH /api/weg-settlement/heating-imports/[id]
// Body: { confirmed_difference?: number | null, reconciliation_note?: string | null }
// Erlaubt das Nachtragen/Ändern der Rundungsdifferenz-Bestätigung (C06) und der
// Überleitungs-Erläuterung (C07) an einem bereits committeten Import, ohne die
// Datei erneut hochladen zu müssen (z. B. nach einem KI-Textvorschlag, K3).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if ("confirmed_difference" in body) patch.confirmed_difference = body.confirmed_difference;
  if ("reconciliation_note" in body) patch.reconciliation_note = body.reconciliation_note;
  if (Object.keys(patch).length === 0) return badRequest("Nichts zu ändern — erlaubt: confirmed_difference, reconciliation_note");

  const { data, error } = await supabase.from("heating_imports").update(patch).eq("id", id).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Heizkostenimport nicht gefunden" }, { status: 404 });

  return NextResponse.json({ updated: true });
}

// DELETE /api/weg-settlement/heating-imports/[id]
// Entfernt einen Heizkostenimport vollständig, damit eine fehlerhafte Datei
// erneut hochgeladen werden kann (die Unique-Constraint aus M1 erlaubt sonst
// nur einen Import je Kostenart/Jahr).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { data: imp, error: readErr } = await supabase.from("heating_imports").select("id").eq("id", id).single();
  if (readErr || !imp) return badRequest("Heizkostenimport nicht gefunden");

  const { error: unitsErr } = await supabase.from("heating_import_units").delete().eq("import_id", id);
  if (unitsErr) return NextResponse.json({ error: unitsErr.message }, { status: 500 });

  const { error: impErr } = await supabase.from("heating_imports").delete().eq("id", id);
  if (impErr) return NextResponse.json({ error: impErr.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
