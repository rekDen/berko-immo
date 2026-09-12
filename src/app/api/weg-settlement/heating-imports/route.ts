import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-settlement/heating-imports?property_id=...&year=...
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  const year = request.nextUrl.searchParams.get("year");
  if (!propertyId || !year) return badRequest("Pflichtparameter: property_id, year");

  const { data: imports, error } = await supabase
    .from("heating_imports")
    .select("id, cost_type_id, year, provider, total_amount, confirmed_difference, reconciliation_note, created_at, cost_types ( name )")
    .eq("property_id", propertyId)
    .eq("year", parseInt(year, 10));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const importIds = (imports ?? []).map((i) => i.id);
  const { data: units } = importIds.length
    ? await supabase
        .from("heating_import_units")
        .select("import_id, unit_id, heating, hot_water, co2_cost, co2_landlord_share_pct, labor_amount, units ( unit_number )")
        .in("import_id", importIds)
    : { data: [] };

  const unitsByImport = new Map<string, typeof units>();
  for (const u of units ?? []) {
    unitsByImport.set(u.import_id, [...(unitsByImport.get(u.import_id) ?? []), u]);
  }

  const result = (imports ?? []).map((imp) => ({ ...imp, units: unitsByImport.get(imp.id) ?? [] }));
  return NextResponse.json(result);
}

// POST /api/weg-settlement/heating-imports
// Body: { property_id, year, cost_type_id, provider, total_amount, rows: [{unit_id,
//         heating, hot_water, co2_cost?, co2_landlord_share_pct?, labor_amount?}],
//         confirmed_difference?, reconciliation_note? }
// Übernimmt die (im Preview-Schritt geprüften) Zeilen. `total_amount` ist der
// Gesamtbetrag LAUT MESSDIENST-ABRECHNUNG (Spec 5.5.2) — ein eigenständiger
// Wert, NICHT aus Σ Zeilen abgeleitet: sonst könnte die Abweichungsprüfung
// (C06) nie auslösen, weil beide Seiten immer gleich wären. Der Verwalter
// trägt ihn aus dem Originaldokument ein (Vorschlag: Σ Zeilen als Startwert).
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.year || !body.cost_type_id || !body.provider || !Array.isArray(body.rows) || !Number.isInteger(body.total_amount)) {
    return badRequest("Pflichtfelder: property_id, year, cost_type_id, provider, total_amount, rows");
  }
  if (body.rows.length === 0) return badRequest("rows darf nicht leer sein");
  for (const r of body.rows) {
    if (!r.unit_id || !Number.isInteger(r.heating) || !Number.isInteger(r.hot_water)) {
      return badRequest("Jede Zeile benötigt unit_id sowie ganzzahlige heating/hot_water-Werte (Cents)");
    }
  }

  const { data: imp, error: impErr } = await supabase
    .from("heating_imports")
    .insert({
      tenant_id: tenantId, created_by: user.id,
      property_id: body.property_id, cost_type_id: body.cost_type_id, year: body.year,
      provider: body.provider, total_amount: body.total_amount,
      confirmed_difference: body.confirmed_difference ?? null,
      reconciliation_note: body.reconciliation_note ?? null,
    })
    .select("id")
    .single();
  if (impErr || !imp) {
    if (impErr?.message.includes("uq_heating_imports_property_year_costtype")) {
      return badRequest("Für diese Kostenart und dieses Jahr existiert bereits ein Heizkostenimport");
    }
    return NextResponse.json({ error: impErr?.message ?? "Import konnte nicht angelegt werden" }, { status: 500 });
  }

  const unitRows = body.rows.map((r: {
    unit_id: string; heating: number; hot_water: number;
    co2_cost?: number; co2_landlord_share_pct?: string | number; labor_amount?: number;
  }) => ({
    tenant_id: tenantId, import_id: imp.id, unit_id: r.unit_id,
    heating: r.heating, hot_water: r.hot_water,
    co2_cost: r.co2_cost ?? null,
    co2_landlord_share_pct: r.co2_landlord_share_pct !== undefined ? Number(r.co2_landlord_share_pct) : null,
    labor_amount: r.labor_amount ?? null,
  }));

  const { error: unitsErr } = await supabase.from("heating_import_units").insert(unitRows);
  if (unitsErr) {
    // Kein Rollback-RPC verfügbar (s. hausgeldabrechnung-plan.md Q6) — Import-
    // Kopf best-effort entfernen, damit kein verwaister, leerer Import bleibt.
    await supabase.from("heating_imports").delete().eq("id", imp.id);
    return NextResponse.json({ error: unitsErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: imp.id, totalAmount: body.total_amount }, { status: 201 });
}
