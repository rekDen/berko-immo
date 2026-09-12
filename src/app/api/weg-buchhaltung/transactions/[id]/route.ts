import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { postJournalEntryForTransaction } from "@/lib/weg-buchhaltung/posting";
import { applyPaymentToReceivables, resolveOwnerId } from "@/lib/weg-buchhaltung/receivable-posting";

const RECEIVABLE_KINDS = new Set(["advance_payment", "special_levy_payment"]);

// PATCH /api/weg-buchhaltung/transactions/[id]
// Body: { cost_type_id?, counter_account_id?, unit_id?, owner_id?, purpose?, confirm?: boolean }
// Ordnet eine vorgeschlagene Buchung zu und/oder bestätigt sie (SUGGESTED -> CONFIRMED,
// harte Regel 0.3.3: die Bestätigung ist immer eine menschliche Handlung, nie automatisch).
// Bereits bestätigte Buchungen (mit Buchungssatz) sind hier nicht mehr änderbar —
// eine Korrektur läuft über eine neue, gegenläufige Buchung (Spec 5.8, append-only Ledger).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const body = await request.json();

  const { data: tx, error: txReadErr } = await supabase
    .from("transactions")
    .select("id, bank_account_id, amount, booking_date, purpose, kind, status, cost_type_id, unit_id, owner_id, special_levy_id, community_bank_accounts ( property_id, ledger_account_id )")
    .eq("id", id)
    .single();
  if (txReadErr || !tx) return badRequest("Buchung nicht gefunden");

  if (tx.status === "confirmed") {
    return badRequest("Bestätigte Buchungen können nicht mehr geändert werden — Korrektur über eine neue Buchung");
  }

  const assignment: Record<string, unknown> = {};
  for (const field of ["cost_type_id", "unit_id", "owner_id", "purpose", "document_id", "labor_amount", "par35a_category"]) {
    if (field in body) assignment[field] = body[field];
  }
  if (Object.keys(assignment).length > 0) {
    const { error: updErr } = await supabase.from("transactions").update(assignment).eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  if (!body.confirm) {
    const { data: updated } = await supabase.from("transactions").select().eq("id", id).single();
    return NextResponse.json(updated);
  }

  const costTypeId = (assignment.cost_type_id as string | undefined) ?? tx.cost_type_id;
  const counterAccountId = body.counter_account_id as string | undefined;
  if (!costTypeId && !counterAccountId) {
    return badRequest("Zum Bestätigen ist cost_type_id oder counter_account_id erforderlich");
  }

  let counterLedgerAccountId = counterAccountId ?? "";
  if (costTypeId) {
    const { data: costType, error: ctErr } = await supabase
      .from("cost_types").select("ledger_account_id").eq("id", costTypeId).single();
    if (ctErr || !costType) return badRequest("Kostenart nicht gefunden");
    counterLedgerAccountId = costType.ledger_account_id;
  }

  const bankInfo = tx.community_bank_accounts as unknown as { property_id: string; ledger_account_id: string };

  const finalUnitId = (assignment.unit_id as string | undefined) ?? tx.unit_id;
  let finalOwnerId = (assignment.owner_id as string | undefined) ?? tx.owner_id;

  // Für Hausgeld-/Sonderumlagenzahlungen ohne explizit zugeordneten Eigentümer:
  // Schuldner laut Ownership zum Buchungstag auflösen (B7.1/B7.4), damit der
  // Ausgleich gegen die Sollstellungen (unten) greifen kann.
  if (!finalOwnerId && finalUnitId && RECEIVABLE_KINDS.has(tx.kind)) {
    finalOwnerId = await resolveOwnerId(supabase, finalUnitId, tx.booking_date);
    if (finalOwnerId) assignment.owner_id = finalOwnerId;
  }

  // Status muss VOR journal_entry_id auf 'confirmed' stehen — die Check-Constraint
  // "status = 'confirmed' or journal_entry_id is null" verbietet sonst den
  // Zwischenzustand (suggested + journal_entry_id gesetzt), den
  // postJournalEntryForTransaction beim Verknüpfen erzeugen würde.
  const { error: statusErr } = await supabase
    .from("transactions")
    .update({ status: "confirmed", ...(assignment.owner_id ? { owner_id: assignment.owner_id } : {}) })
    .eq("id", id);
  if (statusErr) return NextResponse.json({ error: statusErr.message }, { status: 500 });

  try {
    await postJournalEntryForTransaction(supabase, {
      tenantId, propertyId: bankInfo.property_id, transactionId: id,
      bankLedgerAccountId: bankInfo.ledger_account_id, counterLedgerAccountId,
      amount: tx.amount, bookingDate: tx.booking_date,
      description: (assignment.purpose as string) ?? tx.purpose ?? tx.kind,
      costTypeId: costTypeId ?? null,
      unitId: finalUnitId,
      ownerId: finalOwnerId,
    });
  } catch (e) {
    // Buchungssatz fehlgeschlagen — Bestätigung zurücknehmen, damit keine
    // 'confirmed'-Buchung ohne Buchungssatz übrig bleibt.
    await supabase.from("transactions").update({ status: "suggested" }).eq("id", id);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Buchungssatz fehlgeschlagen" }, { status: 500 });
  }

  let receivablesNote: string | undefined;

  if (RECEIVABLE_KINDS.has(tx.kind) && tx.amount > 0 && finalOwnerId) {
    try {
      const result = await applyPaymentToReceivables(supabase, {
        tenantId, propertyId: bankInfo.property_id, transactionId: id,
        ownerId: finalOwnerId, amount: tx.amount, userId: user.id,
        explicitSpecialLevyId: tx.special_levy_id ?? null, unitId: finalUnitId ?? null,
      });
      if (result.allocated < tx.amount) {
        receivablesNote = "Zahlung übersteigt die offenen Sollstellungen — Restbetrag bleibt vorerst ungebunden (B7.6.3)";
      }
    } catch (e) {
      // Buchungssatz steht bereits (append-only, kein Rollback dafür) — der
      // Ausgleich ist ein separater Schritt, der bei Bedarf manuell nachgeholt
      // werden kann. Fehler wird zurückgemeldet, blockiert aber die Bestätigung
      // der Buchung selbst nicht mehr (die ist bereits gültig gebucht).
      receivablesNote = `Ausgleich der Sollstellungen fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannter Fehler"}`;
    }
  }

  const { data: confirmed, error: confirmErr } = await supabase.from("transactions").select().eq("id", id).single();
  if (confirmErr) return NextResponse.json({ error: confirmErr.message }, { status: 500 });

  return NextResponse.json(receivablesNote ? { ...confirmed, receivables_note: receivablesNote } : confirmed);
}
