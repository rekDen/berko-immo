import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { runChecks } from "@/lib/weg-settlement/checks";
import { parseSettlementInput } from "@/lib/weg-settlement/serialize";
import { resolveOwnerId } from "@/lib/weg-buchhaltung/receivable-posting";
import type { SettlementResult } from "@/lib/weg-settlement/types";

const STATUS_ORDER = ["draft", "review", "final", "resolved"] as const;

// GET /api/weg-settlement/settlements/[id]
// Liefert die gespeicherte Abrechnung inkl. frisch berechneter Prüfungen
// (Kapitel 8.2) — Prüfungen selbst werden nicht persistiert, sondern aus dem
// unveränderlichen Snapshot on-the-fly neu ermittelt (deterministisch).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { data: settlement, error } = await supabase.from("settlements").select().eq("id", id).single();
  if (error || !settlement) return badRequest("Abrechnung nicht gefunden");

  const { data: units } = await supabase
    .from("settlement_units")
    .select("unit_id, addressee_owner_id, costs, income, advances_due, balance, units ( unit_number )")
    .eq("settlement_id", id);

  const { data: comments } = await supabase
    .from("settlement_comments").select("id, author_id, text, created_at").eq("settlement_id", id).order("created_at");

  const { data: acknowledgements } = await supabase
    .from("check_acknowledgements").select("id, check_id, user_id, note, created_at").eq("settlement_id", id);

  let checks: ReturnType<typeof runChecks> = [];
  if (settlement.input_snapshot && settlement.result_snapshot) {
    const input = parseSettlementInput(settlement.input_snapshot);
    // Sicherer Cast: runChecks() liest aus SettlementResult nur Felder, die beim
    // JSON-Roundtrip unverändert bleiben (keine Decimal-Felder wie `exactShare`).
    const result = settlement.result_snapshot as SettlementResult;
    checks = runChecks(input, result);
  }

  return NextResponse.json({ settlement, units, comments, acknowledgements, checks });
}

// PATCH /api/weg-settlement/settlements/[id]
// Body: { status: 'review'|'final'|'resolved'|'superseded', resolution_date? }
// Statusübergänge nach Kapitel 8.1. `final` nur ohne offene blockierende
// Prüfung und mit quittierten Warnungen; koppelt an die Jahressperre der
// Buchhaltung (B9). `resolved` schreibt den Adressaten zum Beschlussdatum
// fest und legt die Abrechnungsspitzen als Receivables an (B7.1, kind
// 'settlement_balance').
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  if (!body.status) return badRequest("Pflichtfeld: status");

  const { data: settlement, error: readErr } = await supabase.from("settlements").select().eq("id", id).single();
  if (readErr || !settlement) return badRequest("Abrechnung nicht gefunden");

  if (body.status === "superseded") {
    if (settlement.status === "resolved") return badRequest("Eine bereits beschlossene Abrechnung kann nicht als überholt markiert werden");
    const { data: updated, error } = await supabase.from("settlements").update({ status: "superseded" }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  const currentIdx = STATUS_ORDER.indexOf(settlement.status as (typeof STATUS_ORDER)[number]);
  const targetIdx = STATUS_ORDER.indexOf(body.status);
  if (targetIdx === -1 || targetIdx !== currentIdx + 1) {
    return badRequest(`Ungültiger Statusübergang: ${settlement.status} -> ${body.status}`);
  }

  if (body.status === "review") {
    const { data: updated, error } = await supabase.from("settlements").update({ status: "review" }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  if (body.status === "final") {
    if (!settlement.input_snapshot || !settlement.result_snapshot) return badRequest("Abrechnung hat keinen Snapshot");
    const input = parseSettlementInput(settlement.input_snapshot);
    const result = settlement.result_snapshot as SettlementResult;
    const checks = runChecks(input, result);

    const blocking = checks.filter((c) => c.severity === "blocking");
    if (blocking.length > 0) {
      return badRequest(`Finalisierung nicht möglich — ${blocking.length} blockierende Prüfung(en) offen: ${blocking.map((c) => c.id).join(", ")}`);
    }

    const { data: acks } = await supabase.from("check_acknowledgements").select("check_id").eq("settlement_id", id);
    const acknowledgedIds = new Set((acks ?? []).map((a) => a.check_id));
    const unacknowledgedWarnings = checks.filter((c) => c.severity === "warning" && !acknowledgedIds.has(c.id));
    if (unacknowledgedWarnings.length > 0) {
      return badRequest(`Finalisierung nicht möglich — unquittierte Warnung(en): ${unacknowledgedWarnings.map((c) => c.id).join(", ")}`);
    }

    // Jahressperre koppeln (B9): keine unbestätigten Buchungen im Jahr auf
    // einem Konto dieses Objekts. Dieselbe Vorbedingung wie
    // POST /api/weg-buchhaltung/year-locks, hier dupliziert, um diese Route
    // nicht anzufassen (bereits getestet).
    const { data: bankAccounts } = await supabase.from("community_bank_accounts").select("id").eq("property_id", settlement.property_id);
    const { data: unconfirmed } = await supabase
      .from("transactions").select("id")
      .in("bank_account_id", (bankAccounts ?? []).map((b) => b.id))
      .eq("status", "suggested")
      .gte("booking_date", `${settlement.year}-01-01`).lte("booking_date", `${settlement.year}-12-31`)
      .limit(1);
    if ((unconfirmed ?? []).length > 0) {
      return badRequest("Jahressperre nicht möglich — es gibt noch unbestätigte Buchungen mit Buchungstag im Jahr (BC04)");
    }

    const { data: existingLock } = await supabase
      .from("year_locks").select("id").eq("property_id", settlement.property_id).eq("year", settlement.year).is("unlocked_at", null).maybeSingle();
    if (!existingLock) {
      const { error: lockErr } = await supabase.from("year_locks").insert({
        tenant_id: tenantId, property_id: settlement.property_id, year: settlement.year, locked_by: user.id, settlement_id: id,
      });
      if (lockErr) return NextResponse.json({ error: lockErr.message }, { status: 500 });
    }

    const { data: updated, error } = await supabase
      .from("settlements").update({ status: "final", finalized_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  if (body.status === "resolved") {
    if (!body.resolution_date) return badRequest("Pflichtfeld: resolution_date");

    const { data: settlementUnits } = await supabase.from("settlement_units").select("id, unit_id, balance").eq("settlement_id", id);
    for (const su of settlementUnits ?? []) {
      const addresseeOwnerId = await resolveOwnerId(supabase, su.unit_id, body.resolution_date);
      await supabase.from("settlement_units").update({ addressee_owner_id: addresseeOwnerId }).eq("id", su.id);
      if (addresseeOwnerId && su.balance !== 0) {
        await supabase.from("receivables").insert({
          tenant_id: tenantId, property_id: settlement.property_id, unit_id: su.unit_id, owner_id: addresseeOwnerId,
          kind: "settlement_balance", amount: su.balance, due_date: body.resolution_date, created_by: user.id,
        });
      }
    }

    const { data: updated, error } = await supabase
      .from("settlements")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolution_date: body.resolution_date })
      .eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  }

  return badRequest(`Unbekannter Status: ${body.status}`);
}
