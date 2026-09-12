import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { runChecks } from "@/lib/weg-settlement/checks";
import { parseSettlementInput } from "@/lib/weg-settlement/serialize";
import type { SettlementResult } from "@/lib/weg-settlement/types";

// POST /api/weg-settlement/settlements/[id]/acknowledge
// Body: { check_id, note? }
// Quittiert eine Warnung (8.1: nur Warnungen werden quittiert, blockierende
// Prüfungen müssen durch Datenänderung behoben werden). Append-only,
// verwalterintern.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  if (!body.check_id) return badRequest("Pflichtfeld: check_id");

  const { data: settlement, error: readErr } = await supabase.from("settlements").select("input_snapshot, result_snapshot").eq("id", id).single();
  if (readErr || !settlement) return badRequest("Abrechnung nicht gefunden");
  if (!settlement.input_snapshot || !settlement.result_snapshot) return badRequest("Abrechnung hat keinen Snapshot");

  const input = parseSettlementInput(settlement.input_snapshot);
  const result = settlement.result_snapshot as SettlementResult;
  const checks = runChecks(input, result);
  const match = checks.find((c) => c.id === body.check_id);

  if (!match) return badRequest(`Prüfung ${body.check_id} liegt für diese Abrechnung aktuell nicht vor`);
  if (match.severity !== "warning") return badRequest(`Nur Warnungen werden quittiert (${body.check_id} ist ${match.severity})`);

  const { data, error } = await supabase
    .from("check_acknowledgements")
    .insert({ tenant_id: tenantId, settlement_id: id, check_id: body.check_id, user_id: user.id, note: body.note ?? null })
    .select("id, check_id, user_id, note, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
