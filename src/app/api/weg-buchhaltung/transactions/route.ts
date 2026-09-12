import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { postJournalEntryForTransaction } from "@/lib/weg-buchhaltung/posting";
import { applyPaymentToReceivables, resolveOwnerId } from "@/lib/weg-buchhaltung/receivable-posting";

const RECEIVABLE_KINDS = new Set(["advance_payment", "special_levy_payment"]);

const KINDS = ["advance_payment", "special_levy_payment", "expense", "income", "internal_transfer", "reserve_expense"];

// GET /api/weg-buchhaltung/transactions?property_id=...
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data: bankAccounts, error: bankErr } = await supabase
    .from("community_bank_accounts")
    .select("id")
    .eq("property_id", propertyId);
  if (bankErr) return NextResponse.json({ error: bankErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from("transactions")
    .select(`
      id, bank_account_id, booking_date, amount, kind, purpose, status, source,
      cost_type_id, unit_id, journal_entry_id,
      cost_types ( name ),
      units!transactions_unit_id_fkey ( unit_number ),
      community_bank_accounts ( label )
    `)
    .in("bank_account_id", (bankAccounts ?? []).map((b) => b.id))
    .order("booking_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/weg-buchhaltung/transactions
// Body: { bank_account_id, booking_date, amount, kind, cost_type_id?, counter_account_id?,
//         unit_id?, owner_id?, direct_unit_id?, special_levy_id?, purpose?, resolution_ref?,
//         status? ('suggested'|'confirmed', default 'confirmed') }
// Bei status = 'confirmed' wird sofort der ausgeglichene Buchungssatz erzeugt (5.8.3).
// Erfordert cost_type_id ODER counter_account_id, wenn direkt bestätigt wird.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.bank_account_id || !body.booking_date || body.amount === undefined || body.amount === null || !body.kind) {
    return badRequest("Pflichtfelder: bank_account_id, booking_date, amount, kind");
  }
  if (!Number.isInteger(body.amount)) return badRequest("amount muss ein ganzzahliger Cent-Betrag sein (mit Vorzeichen)");
  if (!KINDS.includes(body.kind)) return badRequest(`kind muss einer von ${KINDS.join(", ")} sein`);

  const status = body.status === "suggested" ? "suggested" : "confirmed";

  if (status === "confirmed" && !body.cost_type_id && !body.counter_account_id) {
    return badRequest("Für eine bestätigte Buchung ist cost_type_id oder counter_account_id erforderlich");
  }

  const { data: bankAccount, error: bankErr } = await supabase
    .from("community_bank_accounts")
    .select("id, property_id, ledger_account_id")
    .eq("id", body.bank_account_id)
    .single();
  if (bankErr || !bankAccount) return badRequest("Bankkonto nicht gefunden");

  // Für Hausgeld-/Sonderumlagenzahlungen ohne explizit übergebenen Eigentümer:
  // Schuldner laut Ownership zum Buchungstag auflösen (B7.1/B7.4), damit der
  // Ausgleich gegen die Sollstellungen (unten) greifen kann.
  let ownerId: string | null = body.owner_id ?? null;
  if (!ownerId && body.unit_id && RECEIVABLE_KINDS.has(body.kind)) {
    ownerId = await resolveOwnerId(supabase, body.unit_id, body.booking_date);
  }

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      bank_account_id: body.bank_account_id,
      booking_date: body.booking_date,
      amount: body.amount,
      kind: body.kind,
      cost_type_id: body.cost_type_id ?? null,
      unit_id: body.unit_id ?? null,
      owner_id: ownerId,
      direct_unit_id: body.direct_unit_id ?? null,
      special_levy_id: body.special_levy_id ?? null,
      purpose: body.purpose ?? null,
      resolution_ref: body.resolution_ref ?? null,
      status,
      source: "manual",
    })
    .select()
    .single();
  if (txErr || !tx) return NextResponse.json({ error: txErr?.message ?? "Buchung konnte nicht angelegt werden" }, { status: 500 });

  if (status === "suggested") {
    return NextResponse.json(tx, { status: 201 });
  }

  let counterLedgerAccountId: string = body.counter_account_id ?? "";
  if (body.cost_type_id) {
    const { data: costType, error: ctErr } = await supabase
      .from("cost_types").select("ledger_account_id").eq("id", body.cost_type_id).single();
    if (ctErr || !costType) {
      // Keine DELETE-RLS-Policy auf transactions (bewusst, Finanzbelege) —
      // auf 'suggested' zurücksetzen statt zu löschen.
      await supabase.from("transactions").update({ status: "suggested" }).eq("id", tx.id);
      return badRequest("Kostenart nicht gefunden");
    }
    counterLedgerAccountId = costType.ledger_account_id;
  }

  try {
    await postJournalEntryForTransaction(supabase, {
      tenantId, propertyId: bankAccount.property_id, transactionId: tx.id,
      bankLedgerAccountId: bankAccount.ledger_account_id, counterLedgerAccountId,
      amount: body.amount, bookingDate: body.booking_date,
      description: body.purpose || body.kind,
      costTypeId: body.cost_type_id ?? null, unitId: body.unit_id ?? null, ownerId: ownerId,
    });
  } catch (e) {
    // Buchung ohne gültigen Buchungssatz nicht als 'confirmed' stehen lassen.
    // Keine DELETE-RLS-Policy auf transactions (bewusst, Finanzbelege) —
    // auf 'suggested' zurücksetzen statt zu löschen.
    await supabase.from("transactions").update({ status: "suggested" }).eq("id", tx.id);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Buchungssatz fehlgeschlagen" }, { status: 500 });
  }

  let receivablesNote: string | undefined;
  if (RECEIVABLE_KINDS.has(body.kind) && body.amount > 0 && ownerId) {
    try {
      const result = await applyPaymentToReceivables(supabase, {
        tenantId, propertyId: bankAccount.property_id, transactionId: tx.id,
        ownerId, amount: body.amount, userId: user.id,
        explicitSpecialLevyId: body.special_levy_id ?? null, unitId: body.unit_id ?? null,
      });
      if (result.allocated < body.amount) {
        receivablesNote = "Zahlung übersteigt die offenen Sollstellungen — Restbetrag bleibt vorerst ungebunden (B7.6.3)";
      }
    } catch (e) {
      receivablesNote = `Ausgleich der Sollstellungen fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannter Fehler"}`;
    }
  }

  const { data: final } = await supabase.from("transactions").select().eq("id", tx.id).single();
  return NextResponse.json(receivablesNote ? { ...final, receivables_note: receivablesNote } : final, { status: 201 });
}
