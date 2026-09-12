import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const anthropic = new Anthropic();

// POST /api/weg-settlement/heating-imports/[id]/explain
// K3 (hausgeldabrechnung-spec.md Kapitel 9): Textentwurf für die
// Heizkosten-Überleitungsdifferenz (C07) auf Basis aggregierter Zahlen — keine
// Eigentümerdaten werden übermittelt (nur Objektname, Jahr, Messdienst und
// drei Centbeträge). Reiner Vorschlag: der Text wird nur zurückgegeben, nie
// selbst in `heating_imports.reconciliation_note` geschrieben — das
// Speichern bleibt eine bewusste Aktion des Verwalters (PATCH/POST der
// bestehenden Routen), wie es Kapitel 9 für jede KI-Ausgabe verlangt.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { data: imp, error: impErr } = await supabase
    .from("heating_imports")
    .select("id, property_id, year, provider, total_amount, cost_type_id, properties ( name )")
    .eq("id", id)
    .single();
  if (impErr || !imp) return badRequest("Heizkostenimport nicht gefunden");

  const { data: units } = await supabase
    .from("heating_import_units")
    .select("heating, hot_water")
    .eq("import_id", id);
  const perUnitSum = (units ?? []).reduce((s, u) => s + u.heating + u.hot_water, 0);

  const { data: bankAccounts } = await supabase
    .from("community_bank_accounts").select("id").eq("property_id", imp.property_id);
  const bankAccountIds = (bankAccounts ?? []).map((b) => b.id);
  const yearStart = `${imp.year}-01-01`;
  const yearEnd = `${imp.year}-12-31`;

  const { data: bookings } = bankAccountIds.length
    ? await supabase
        .from("transactions")
        .select("amount")
        .in("bank_account_id", bankAccountIds)
        .eq("cost_type_id", imp.cost_type_id)
        .eq("status", "confirmed")
        .gte("booking_date", yearStart)
        .lte("booking_date", yearEnd)
    : { data: [] };
  // Heizkosten sind stets eine Ausgaben-Kostenart — Bankbetrag (negativ) auf
  // positiven Kostenbetrag normalisiert, gleiche Konvention wie server-load.ts.
  const actualPaid = (bookings ?? []).reduce((s, b) => s - (b.amount as number), 0);

  const messdienstTotal = imp.total_amount as number;
  const perUnitMismatch = perUnitSum - messdienstTotal;
  const difference = actualPaid - messdienstTotal;

  if (difference === 0 && perUnitMismatch === 0) {
    return NextResponse.json({ text: "" }); // nichts zu erklären
  }

  const propertyName = (imp.properties as unknown as { name: string } | null)?.name ?? "das Objekt";
  const eur = (cents: number) => (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system:
        "Du entwirfst für einen WEG-Verwalter einen kurzen, sachlichen Erläuterungstext (2-3 Sätze, Deutsch) " +
        "für die Heizkosten-Überleitungsdifferenz in einer Jahresabrechnung. Du kennst den tatsächlichen Grund " +
        "nicht — nenne plausible, allgemein übliche Ursachen (z. B. abweichender Abrechnungszeitraum des " +
        "Messdienstes gegenüber dem Kalenderjahr, Voraus-/Endabrechnung, Zeitversatz zwischen Zahlung und " +
        "Abrechnungsstellung) als Entwurf, den der Verwalter vor Verwendung prüft und bei Bedarf durch den " +
        "tatsächlichen Grund ersetzt. Erfinde keine konkreten Fakten (keine Namen, keine Daten, keine Beträge " +
        "außer den gegebenen). Gib ausschließlich den Fließtext zurück, keine Überschrift, keine Anführungszeichen.",
      messages: [
        {
          role: "user",
          content:
            `Objekt: ${propertyName}\nJahr: ${imp.year}\nMessdienst: ${imp.provider}\n` +
            `Gesamtbetrag laut Messdienst: ${eur(messdienstTotal)}\n` +
            `Summe der Einheitenbeträge laut Messdienst-Import: ${eur(perUnitSum)}` +
            (perUnitMismatch !== 0 ? ` (Abweichung ${eur(perUnitMismatch)})` : "") + "\n" +
            `Tatsächlich gezahlte Heizkosten (Buchhaltung, Kalenderjahr): ${eur(actualPaid)}\n` +
            `Überleitungsdifferenz (gezahlt − Messdienst-Gesamtbetrag): ${eur(difference)}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Textvorschlag fehlgeschlagen" }, { status: 500 });
  }
}
