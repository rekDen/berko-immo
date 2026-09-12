import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { loadSettlementInput } from "@/lib/weg-settlement/server-load";
import { computeSettlement } from "@/lib/weg-settlement/engine";
import { runChecks } from "@/lib/weg-settlement/checks";
import { toPlain } from "@/lib/weg-settlement/serialize";
import { resolveOwnerId } from "@/lib/weg-buchhaltung/receivable-posting";

// GET /api/weg-settlement/settlements?property_id=...
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data, error } = await supabase
    .from("settlements")
    .select("id, year, version, status, engine_version, finalized_at, resolved_at, resolution_date, supersedes_id, created_at")
    .eq("property_id", propertyId)
    .order("year", { ascending: false })
    .order("version", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/weg-settlement/settlements
// Body: { property_id, year }
// Lädt die Buchhaltungsdaten (server-load.ts), berechnet die Abrechnung
// (Rechenkern, DB-frei) und speichert sie als DRAFT. Existiert bereits ein
// DRAFT für dasselbe Jahr, wird er neu berechnet (überschrieben) —
// DRAFT-Ergebnisse sind laut Spec 8.1 "flüchtig". Ist die letzte Version
// nicht mehr DRAFT (review/final/resolved), entsteht eine neue Version.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.year) return badRequest("Pflichtfelder: property_id, year");
  if (!Number.isInteger(body.year)) return badRequest("year muss eine ganze Zahl sein");

  const input = await loadSettlementInput(supabase, body.property_id, body.year);
  const result = computeSettlement(input);
  const checks = runChecks(input, result);

  const inputPlain = toPlain(input);
  const resultPlain = toPlain(result);
  const inputHash = createHash("sha256").update(JSON.stringify(inputPlain)).digest("hex");

  const { data: existing, error: existingErr } = await supabase
    .from("settlements")
    .select("id, version, status")
    .eq("property_id", body.property_id)
    .eq("year", body.year)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  let settlementId: string;
  let version: number;

  if (existing && existing.status === "draft") {
    const { error: updErr } = await supabase
      .from("settlements")
      .update({ input_snapshot: inputPlain, result_snapshot: resultPlain, input_hash: inputHash, engine_version: result.engineVersion })
      .eq("id", existing.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    settlementId = existing.id;
    version = existing.version;
  } else {
    version = (existing?.version ?? 0) + 1;
    const { data: created, error: createErr } = await supabase
      .from("settlements")
      .insert({
        tenant_id: tenantId, created_by: user.id,
        property_id: body.property_id, year: body.year, version,
        status: "draft",
        input_snapshot: inputPlain, result_snapshot: resultPlain,
        input_hash: inputHash, engine_version: result.engineVersion,
        supersedes_id: existing?.id ?? null,
      })
      .select("id")
      .single();
    if (createErr || !created) return NextResponse.json({ error: createErr?.message ?? "Abrechnung konnte nicht angelegt werden" }, { status: 500 });
    settlementId = created.id;
  }

  await supabase.from("settlement_units").delete().eq("settlement_id", settlementId);
  const today = new Date().toISOString().slice(0, 10);
  const settlementUnitRows = [];
  for (const u of result.units) {
    const addresseeOwnerId = await resolveOwnerId(supabase, u.unitId, today);
    settlementUnitRows.push({
      tenant_id: tenantId, settlement_id: settlementId, unit_id: u.unitId,
      addressee_owner_id: addresseeOwnerId, costs: u.costs, income: u.income,
      advances_due: u.advancesSoll, balance: u.balance,
    });
  }
  if (settlementUnitRows.length > 0) {
    const { error: suErr } = await supabase.from("settlement_units").insert(settlementUnitRows);
    if (suErr) return NextResponse.json({ error: suErr.message }, { status: 500 });
  }

  const { data: settlement, error: readErr } = await supabase
    .from("settlements")
    .select("id, year, version, status, engine_version, created_at")
    .eq("id", settlementId)
    .single();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  return NextResponse.json({ settlement, result: resultPlain, checks }, { status: 201 });
}
