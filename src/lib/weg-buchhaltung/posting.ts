import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Erzeugt aus einer bestätigten Buchung den ausgeglichenen Buchungssatz
 * (weg-buchhaltung-spec.md 5.8.3): Bankkonto ./. Gegenkonto (Kostenart oder
 * frei gewähltes Konto). Muss aufgerufen werden, NACHDEM die Transaction
 * bereits gespeichert ist — journal_entries.source_transaction_id ist eine
 * plain (nicht-deferrable) FK auf transactions(id).
 *
 * amount > 0 (Zufluss): Bankkonto Soll, Gegenkonto Haben.
 * amount < 0 (Abfluss): Bankkonto Haben, Gegenkonto Soll.
 *
 * Verknüpft am Ende transactions.journal_entry_id mit dem erzeugten Buchungssatz.
 * Wirft bei Fehlern — der Aufrufer entscheidet, ob/wie zurückgerollt wird
 * (kein DB-Transaktions-RPC verfügbar, siehe hausgeldabrechnung-plan.md Q6).
 */
export async function postJournalEntryForTransaction(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    propertyId: string;
    transactionId: string;
    bankLedgerAccountId: string;
    counterLedgerAccountId: string;
    amount: number;
    bookingDate: string;
    description: string;
    costTypeId?: string | null;
    unitId?: string | null;
    ownerId?: string | null;
  }
): Promise<string> {
  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .insert({
      tenant_id: opts.tenantId,
      property_id: opts.propertyId,
      date: opts.bookingDate,
      description: opts.description,
      source_transaction_id: opts.transactionId,
    })
    .select("id")
    .single();
  if (entryErr || !entry) throw new Error(entryErr?.message ?? "Buchungssatz konnte nicht angelegt werden");

  const abs = Math.abs(opts.amount);
  const bankLine = opts.amount > 0
    ? { account_id: opts.bankLedgerAccountId, debit: abs }
    : { account_id: opts.bankLedgerAccountId, credit: abs };
  const counterLine = opts.amount > 0
    ? { account_id: opts.counterLedgerAccountId, credit: abs }
    : { account_id: opts.counterLedgerAccountId, debit: abs };

  const { error: linesErr } = await supabase.from("journal_entry_lines").insert([
    { tenant_id: opts.tenantId, journal_entry_id: entry.id, ...bankLine },
    {
      tenant_id: opts.tenantId,
      journal_entry_id: entry.id,
      ...counterLine,
      cost_type_id: opts.costTypeId ?? null,
      unit_id: opts.unitId ?? null,
      owner_id: opts.ownerId ?? null,
    },
  ]);
  if (linesErr) {
    // Best-effort — journal_entries hat bewusst keine DELETE-Policy (append-only
    // Ledger, 5.8), dieser Aufruf entfernt also i. d. R. nichts und der leere
    // journal_entries-Kopf bleibt als Waise stehen. Unschädlich (0 Zeilen,
    // keine Verknüpfung von einer confirmed Transaction aus), aber kein
    // vollständiger Rollback — bekannte Einschränkung ohne DB-Transaktions-RPC.
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    throw new Error(linesErr.message);
  }

  const { error: linkErr } = await supabase
    .from("transactions")
    .update({ journal_entry_id: entry.id })
    .eq("id", opts.transactionId);
  if (linkErr) throw new Error(linkErr.message);

  return entry.id;
}
