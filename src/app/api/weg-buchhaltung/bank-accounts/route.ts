import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-buchhaltung/bank-accounts?property_id=...
// Bankkonten der Gemeinschaft inkl. Kontenabstimmung (Spec 5.12):
// Anfangsbestand (ältester Kontoauszugssaldo) + Σ Buchungen dazwischen
// = rechnerischer Endbestand, verglichen mit dem jüngsten Kontoauszugssaldo.
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data: accounts, error: accErr } = await supabase
    .from("community_bank_accounts")
    .select("id, property_id, iban, bic, kind, label, ledger_account_id")
    .eq("property_id", propertyId)
    .is("closed_at", null)
    .order("kind");
  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  try {
    const result = await Promise.all(
      (accounts ?? []).map(async (acc) => {
        const { data: confirmations, error: confErr } = await supabase
          .from("balance_confirmations")
          .select("date, balance")
          .eq("bank_account_id", acc.id)
          .order("date", { ascending: true });
        if (confErr) throw new Error(confErr.message);

        if (!confirmations || confirmations.length === 0) {
          return { ...acc, reconciliation: null };
        }

        const opening = confirmations[0];
        const latest = confirmations[confirmations.length - 1];

        if (confirmations.length === 1) {
          return {
            ...acc,
            reconciliation: {
              opening, latest, movementsSum: null, computedClosing: null, difference: null,
            },
          };
        }

        // Bewegungen aus dem Kontenplan lesen (Buchungszeilen auf dem
        // Bestandskonto dieses Bankkontos), nicht aus `transactions` — ein
        // freier Buchungssatz (5.8.4, z. B. eine Umbuchung) hat keine
        // zugehörige Transaction und würde sonst hier fehlen. Bankkonten
        // sind debit-normal: Bewegung = Σ debit − Σ credit im Zeitraum.
        const { data: entries, error: entriesErr } = await supabase
          .from("journal_entries")
          .select("id")
          .eq("property_id", acc.property_id)
          .gt("date", opening.date)
          .lte("date", latest.date);
        if (entriesErr) throw new Error(entriesErr.message);

        const { data: lines, error: linesErr } = await supabase
          .from("journal_entry_lines")
          .select("debit, credit")
          .eq("account_id", acc.ledger_account_id)
          .in("journal_entry_id", (entries ?? []).map((e) => e.id));
        if (linesErr) throw new Error(linesErr.message);

        const movementsSum = (lines ?? []).reduce((sum, l) => sum + (l.debit ?? 0) - (l.credit ?? 0), 0);
        const computedClosing = opening.balance + movementsSum;

        return {
          ...acc,
          reconciliation: {
            opening, latest, movementsSum, computedClosing,
            difference: computedClosing - latest.balance,
          },
        };
      })
    );

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, { status: 500 });
  }
}
