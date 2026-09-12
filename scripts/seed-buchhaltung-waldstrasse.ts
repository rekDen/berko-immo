/**
 * B1-Seed: Kontenplan + Beispielbuchungen für WEG Waldstraße 82 (Köhler-Tenant).
 * Testet dabei auch die Ausgeglichenheits-Invariante (Trigger auf journal_entry_lines).
 *
 * Ausführen: npx tsx scripts/seed-buchhaltung-waldstrasse.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomUUID } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const id = () => randomUUID();

async function main() {
  console.log("Suche WEG Waldstraße 82 (Köhler-Tenant)…\n");

  const { data: property, error: propErr } = await admin
    .from("properties")
    .select("id, tenant_id, name")
    .eq("name", "WEG Waldstraße 82")
    .single();
  if (propErr || !property) throw new Error(`Objekt nicht gefunden: ${propErr?.message}`);
  const { id: propertyId, tenant_id: tenantId } = property;
  console.log(`Objekt: ${property.name} [${propertyId}]\n`);

  const { data: units, error: unitsErr } = await admin
    .from("units")
    .select("id, unit_number, mea")
    .eq("property_id", propertyId)
    .order("unit_number");
  if (unitsErr || !units?.length) throw new Error(`Einheiten nicht gefunden: ${unitsErr?.message}`);
  console.log(`${units.length} Einheiten gefunden.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // KONTENPLAN
  // ════════════════════════════════════════════════════════════════════════

  const a = {
    bank: id(), reserve: id(), receivables: id(), payables: id(),
    hausmeister: id(), versicherung: id(), verwaltung: id(), instandhaltung: id(), zinsen: id(),
  };

  const accounts = [
    { id: a.bank, tenant_id: tenantId, property_id: propertyId, code: "1000", name: "Bankkonto Bewirtschaftung", kind: "asset" },
    { id: a.reserve, tenant_id: tenantId, property_id: propertyId, code: "1100", name: "Rücklagenkonto", kind: "asset" },
    { id: a.receivables, tenant_id: tenantId, property_id: propertyId, code: "1200", name: "Forderungen gegen Eigentümer", kind: "asset" },
    { id: a.payables, tenant_id: tenantId, property_id: propertyId, code: "2000", name: "Verbindlichkeiten", kind: "liability" },
    { id: a.hausmeister, tenant_id: tenantId, property_id: propertyId, code: "4000", name: "Hausmeisterkosten", kind: "expense" },
    { id: a.versicherung, tenant_id: tenantId, property_id: propertyId, code: "4010", name: "Versicherung", kind: "expense" },
    { id: a.verwaltung, tenant_id: tenantId, property_id: propertyId, code: "4020", name: "Verwaltervergütung", kind: "expense" },
    { id: a.instandhaltung, tenant_id: tenantId, property_id: propertyId, code: "4030", name: "Instandhaltung", kind: "expense" },
    { id: a.zinsen, tenant_id: tenantId, property_id: propertyId, code: "8000", name: "Zinserträge", kind: "income" },
  ];

  {
    const { error } = await admin.from("accounts").insert(accounts);
    if (error) throw new Error(`Kontenplan: ${error.message}`);
  }
  console.log(`${accounts.length} Konten angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // BANKKONTEN DER GEMEINSCHAFT + KONTOAUSZUGSSALDEN
  // ════════════════════════════════════════════════════════════════════════

  const bankAccounts = [
    { id: id(), tenant_id: tenantId, property_id: propertyId, iban: "DE97860555590098760001", bic: "WELADE8LXXX", kind: "operating", label: "Bewirtschaftungskonto", ledger_account_id: a.bank },
    { id: id(), tenant_id: tenantId, property_id: propertyId, iban: "DE64860555590098760002", bic: "WELADE8LXXX", kind: "reserve", label: "Rücklagenkonto", ledger_account_id: a.reserve },
  ];
  const bankOperatingId = bankAccounts[0].id;

  {
    const { error } = await admin.from("community_bank_accounts").insert(bankAccounts);
    if (error) throw new Error(`Bankkonten: ${error.message}`);
  }
  console.log(`${bankAccounts.length} Bankkonten der Gemeinschaft angelegt.\n`);

  {
    const { error } = await admin.from("balance_confirmations").insert([
      { id: id(), tenant_id: tenantId, bank_account_id: bankAccounts[0].id, date: "2025-12-31", balance: 340000, source: "manual" },
      { id: id(), tenant_id: tenantId, bank_account_id: bankAccounts[1].id, date: "2025-12-31", balance: 1250000, source: "manual" },
    ]);
    if (error) throw new Error(`Kontoauszugssalden: ${error.message}`);
  }
  console.log("Kontoauszugssalden zum 31.12.2025 erfasst.\n");

  // ════════════════════════════════════════════════════════════════════════
  // VERTEILERSCHLÜSSEL (MEA) + KOSTENARTEN
  // ════════════════════════════════════════════════════════════════════════

  const keyId = id();
  {
    const { error } = await admin.from("allocation_keys").insert({
      id: keyId, tenant_id: tenantId, property_id: propertyId, name: "MEA", type: "co_ownership",
    });
    if (error) throw new Error(`Verteilerschlüssel: ${error.message}`);
  }

  const keyValues = units.map((u) => ({
    id: id(), tenant_id: tenantId, key_id: keyId, unit_id: u.id,
    value: u.mea, valid_from: "2026-01-01",
  }));
  {
    const { error } = await admin.from("allocation_key_values").insert(keyValues);
    if (error) throw new Error(`Schlüsselwerte: ${error.message}`);
  }
  console.log(`Verteilerschlüssel MEA mit ${keyValues.length} Werten angelegt.\n`);

  const costTypes = [
    { id: id(), tenant_id: tenantId, property_id: propertyId, name: "Hausmeister", direction: "expense", allocation_key_id: keyId, is_heating: false, allows_direct_charge: false, apportionable: true, betrkv_no: 14, ledger_account_id: a.hausmeister },
    { id: id(), tenant_id: tenantId, property_id: propertyId, name: "Versicherung", direction: "expense", allocation_key_id: keyId, is_heating: false, allows_direct_charge: false, apportionable: true, betrkv_no: 13, ledger_account_id: a.versicherung },
    { id: id(), tenant_id: tenantId, property_id: propertyId, name: "Verwaltervergütung", direction: "expense", allocation_key_id: keyId, is_heating: false, allows_direct_charge: false, apportionable: false, ledger_account_id: a.verwaltung },
    { id: id(), tenant_id: tenantId, property_id: propertyId, name: "Instandhaltung", direction: "expense", allocation_key_id: keyId, is_heating: false, allows_direct_charge: true, apportionable: false, ledger_account_id: a.instandhaltung },
    { id: id(), tenant_id: tenantId, property_id: propertyId, name: "Zinserträge", direction: "income", allocation_key_id: keyId, is_heating: false, allows_direct_charge: false, apportionable: false, ledger_account_id: a.zinsen },
  ];
  {
    const { error } = await admin.from("cost_types").insert(costTypes);
    if (error) throw new Error(`Kostenarten: ${error.message}`);
  }
  console.log(`${costTypes.length} Kostenarten angelegt.\n`);
  const [hausmeisterCt, , , instandhaltungCt] = costTypes;

  // ════════════════════════════════════════════════════════════════════════
  // WIRTSCHAFTSPLAN
  // ════════════════════════════════════════════════════════════════════════

  const planId = id();
  {
    const { error } = await admin.from("economic_plans").insert({
      id: planId, tenant_id: tenantId, property_id: propertyId, year: 2026, resolution_date: "2025-11-15",
    });
    if (error) throw new Error(`Wirtschaftsplan: ${error.message}`);
  }

  const totalMea = units.reduce((sum, u) => sum + Number(u.mea), 0);
  const totalMonthlyOperatingCents = 240000; // 2.400 € Bewirtschaftung gesamt/Monat
  const totalMonthlyReserveCents = 80000;    // 800 € Rücklagenzuführung gesamt/Monat

  const planAdvances = units.map((u) => {
    const share = Number(u.mea) / totalMea;
    return {
      id: id(), tenant_id: tenantId, plan_id: planId, unit_id: u.id,
      monthly_operating: Math.round(totalMonthlyOperatingCents * share),
      monthly_reserve: Math.round(totalMonthlyReserveCents * share),
      valid_from: "2026-01-01",
    };
  });
  {
    const { error } = await admin.from("plan_advances").insert(planAdvances);
    if (error) throw new Error(`Vorschüsse: ${error.message}`);
  }
  console.log(`Wirtschaftsplan 2026 mit ${planAdvances.length} Vorschüssen angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // BEISPIELBUCHUNGEN (Transaction + automatisch erzeugter Buchungssatz)
  // ════════════════════════════════════════════════════════════════════════

  async function postSimpleTransaction(opts: {
    bookingDate: string; amountCents: number; kind: string; costTypeAccountId: string; purpose: string;
  }) {
    const txId = id();
    const entryId = id();

    // 1) Transaction zuerst anlegen (ohne journal_entry_id — die plain FK von
    //    journal_entries.source_transaction_id verlangt, dass die Buchung
    //    bereits existiert, bevor der Buchungssatz darauf verweisen kann).
    const { error: txErr } = await admin.from("transactions").insert({
      id: txId, tenant_id: tenantId, bank_account_id: bankOperatingId,
      booking_date: opts.bookingDate, amount: -opts.amountCents, kind: opts.kind,
      cost_type_id: costTypes.find((c) => c.ledger_account_id === opts.costTypeAccountId)!.id,
      purpose: opts.purpose, status: "confirmed", source: "manual",
    });
    if (txErr) throw new Error(`Buchung: ${txErr.message}`);

    // 2) Buchungssatz anlegen, verweist jetzt gültig auf die Transaction.
    const { error: entryErr } = await admin.from("journal_entries").insert({
      id: entryId, tenant_id: tenantId, property_id: propertyId,
      date: opts.bookingDate, description: opts.purpose, source_transaction_id: txId,
    });
    if (entryErr) throw new Error(`Buchungssatz: ${entryErr.message}`);

    // 3) Beide Zeilen in EINEM Insert, damit die deferred Ausgeglichenheits-
    //    Prüfung erst nach beiden Zeilen greift (Batch-Insert = eine Transaktion).
    const { error: linesErr } = await admin.from("journal_entry_lines").insert([
      { id: id(), tenant_id: tenantId, journal_entry_id: entryId, account_id: a.bank, credit: opts.amountCents },
      { id: id(), tenant_id: tenantId, journal_entry_id: entryId, account_id: opts.costTypeAccountId, debit: opts.amountCents },
    ]);
    if (linesErr) throw new Error(`Buchungszeilen: ${linesErr.message}`);

    // 4) Transaction mit dem erzeugten Buchungssatz verknüpfen.
    const { error: linkErr } = await admin.from("transactions").update({ journal_entry_id: entryId }).eq("id", txId);
    if (linkErr) throw new Error(`Verknüpfung Buchung↔Buchungssatz: ${linkErr.message}`);

    return { txId, entryId };
  }

  await postSimpleTransaction({
    bookingDate: "2026-02-10", amountCents: 24700, kind: "expense",
    costTypeAccountId: a.hausmeister, purpose: "Hausmeister Februar 2026",
  });
  await postSimpleTransaction({
    bookingDate: "2026-03-05", amountCents: 92000, kind: "expense",
    costTypeAccountId: a.instandhaltung, purpose: "Reparatur Dachrinne",
  });
  console.log("2 Beispielbuchungen mit ausgeglichenem Buchungssatz angelegt.\n");

  // ════════════════════════════════════════════════════════════════════════
  // VERIFIKATION: unausgeglichener Buchungssatz wird abgelehnt
  // ════════════════════════════════════════════════════════════════════════

  console.log("Teste Ausgeglichenheits-Invariante (erwartet: Fehler vom DB-Trigger)…");
  const badEntryId = id();
  const { error: badEntryErr } = await admin.from("journal_entries").insert({
    id: badEntryId, tenant_id: tenantId, property_id: propertyId,
    date: "2026-03-10", description: "TEST — sollte fehlschlagen",
  });
  if (badEntryErr) throw new Error(`Unerwarteter Fehler beim Anlegen des Test-Buchungssatzes: ${badEntryErr.message}`);

  const { error: badLineErr } = await admin.from("journal_entry_lines").insert({
    id: id(), tenant_id: tenantId, journal_entry_id: badEntryId, account_id: a.hausmeister, debit: 10000,
    // keine Gegenbuchung — Σ debit (100 €) ≠ Σ credit (0 €)
  });

  if (badLineErr) {
    console.log(`✅ Erwarteter Fehler erhalten: ${badLineErr.message}`);
  } else {
    console.log("❌ FEHLER: Die unausgeglichene Buchung wurde NICHT abgelehnt — Trigger greift nicht!");
    process.exitCode = 1;
  }

  // Aufräumen: Den Test-Buchungssatz-Kopf wieder entfernen (die Zeile wurde
  // ja gerade nicht gespeichert), damit kein leerer journal_entry zurückbleibt.
  await admin.from("journal_entries").delete().eq("id", badEntryId);

  console.log("\n════════════════════════════════════════════════");
  console.log("B1-Seed abgeschlossen.");
  console.log("════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Unerwarteter Fehler:", err);
  process.exit(1);
});
