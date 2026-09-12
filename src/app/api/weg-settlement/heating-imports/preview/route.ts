import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { parseHeatingRows } from "@/lib/weg-settlement/heating-import";

// POST /api/weg-settlement/heating-imports/preview
// multipart/form-data: file (CSV oder XLSX), property_id
// Reine Vorschau — schreibt nichts in die Datenbank (Muster wie
// bank-accounts/[id]/import/preview). Löst die Einheiten-Spalte gegen die
// tatsächlichen Einheiten des Objekts auf (per unit_number, case-insensitiv).
export async function POST(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const propertyId = form.get("property_id") as string | null;
  if (!file || !propertyId) return badRequest("Pflichtfelder: file, property_id");

  let sheetRows: Record<string, string | number>[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sheetRows = XLSX.utils.sheet_to_json(sheet);
  } catch {
    return badRequest("Datei konnte nicht gelesen werden (CSV oder XLSX erwartet)");
  }

  const parsed = parseHeatingRows(sheetRows);

  const { data: units, error: unitsErr } = await supabase
    .from("units").select("id, unit_number").eq("property_id", propertyId);
  if (unitsErr) return NextResponse.json({ error: unitsErr.message }, { status: 500 });

  const unitByLabel = new Map((units ?? []).map((u) => [u.unit_number.trim().toLowerCase(), u.id]));
  const errors = [...parsed.errors];
  const rows = parsed.rows.map((r) => {
    const unitId = unitByLabel.get(r.unitLabel.trim().toLowerCase()) ?? null;
    if (!unitId) errors.push(`Einheit „${r.unitLabel}" wurde im Objekt nicht gefunden`);
    return { ...r, unitId };
  });

  return NextResponse.json({
    rows,
    errors,
    total: parsed.total,
    unitsMatched: rows.filter((r) => r.unitId).length,
    unitsTotal: (units ?? []).length,
  });
}
