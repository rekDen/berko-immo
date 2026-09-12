import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { parseCsv } from "@/lib/weg-buchhaltung/import/csv";
import { parseCamt053 } from "@/lib/weg-buchhaltung/import/camt053";
import { markDuplicates, purposeHash } from "@/lib/weg-buchhaltung/import/duplicates";
import { applyMatchingRules } from "@/lib/weg-buchhaltung/import/matching";
import {
  computeStage2IncomingSuggestions, computeStage2OutgoingSuggestion,
  type HeuristicOwnerCandidate,
} from "@/lib/weg-buchhaltung/matching-heuristic";
import type { CsvMapping, RowWithStage2 } from "@/lib/weg-buchhaltung/import/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// B8.2 Stufe 2 (Heuristik): lädt Eigentümer-Kandidaten der WEG mit den für
// die Bewertung nötigen Zahlen. Vereinfachung ggü. Spec: Eigentümerschaft und
// Wirtschaftsplan werden zum aktuellen Datum aufgelöst, nicht je Buchungstag
// der importierten Zeile — für einen Vorschlag (nie automatisch bestätigt)
// ausreichend genau, vermeidet aber eine Einzelabfrage je Zeile/Datum.
async function loadOwnerCandidates(supabase: SupabaseClient, propertyId: string): Promise<HeuristicOwnerCandidate[]> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: roles } = await supabase
    .from("contact_roles")
    .select("contact_id, unit_id, units!inner ( id, unit_number, property_id )")
    .eq("role", "owner")
    .eq("units.property_id", propertyId)
    .lte("valid_from", today)
    .or(`valid_to.is.null,valid_to.gte.${today}`);
  if (!roles || roles.length === 0) return [];

  const ownerIds = [...new Set(roles.map((r) => r.contact_id as string))];
  const unitIds = [...new Set(roles.map((r) => r.unit_id as string))];

  const [{ data: contacts }, { data: planAdvances }, { data: receivables }] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name, company_name").in("id", ownerIds),
    supabase
      .from("plan_advances").select("unit_id, monthly_operating, monthly_reserve, valid_from, valid_to")
      .in("unit_id", unitIds).lte("valid_from", today).or(`valid_to.is.null,valid_to.gte.${today}`),
    supabase.from("receivables").select("owner_id, amount").in("owner_id", ownerIds).in("status", ["open", "partial"]),
  ]);

  const contactById = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const advanceByUnit = new Map((planAdvances ?? []).map((p) => [p.unit_id as string, (p.monthly_operating as number) + (p.monthly_reserve as number)]));
  const receivablesByOwner = new Map<string, number>();
  for (const r of receivables ?? []) {
    receivablesByOwner.set(r.owner_id as string, (receivablesByOwner.get(r.owner_id as string) ?? 0) + (r.amount as number));
  }

  return roles.map((r): HeuristicOwnerCandidate => {
    const contact = contactById.get(r.contact_id as string);
    const unit = r.units as unknown as { unit_number: string };
    const ownerName = contact?.company_name ?? [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ?? "";
    return {
      ownerId: r.contact_id as string,
      unitId: r.unit_id as string,
      ownerName,
      unitNumber: unit?.unit_number ?? "",
      monthlyAdvanceCents: advanceByUnit.get(r.unit_id as string) ?? null,
      openReceivablesCents: receivablesByOwner.get(r.contact_id as string) ?? null,
    };
  });
}

// POST /api/weg-buchhaltung/bank-accounts/[id]/import/preview
// multipart/form-data: file, format ('csv'|'camt053'), + bei csv: dateColumn,
// amountColumn, purposeColumn?, counterpartyIbanColumn?, dateFormat, decimalSeparator, delimiter?
// Reine Vorschau — schreibt NICHTS in die Datenbank (harte Regel 0.3.2).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id: bankAccountId } = await params;

  const { data: bankAccount, error: bankErr } = await supabase
    .from("community_bank_accounts")
    .select("id, property_id")
    .eq("id", bankAccountId)
    .single();
  if (bankErr || !bankAccount) return badRequest("Bankkonto nicht gefunden");

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const format = form.get("format") as string | null;
  if (!file || !format) return badRequest("Pflichtfelder: file, format");
  if (format !== "csv" && format !== "camt053") return badRequest("format muss 'csv' oder 'camt053' sein");

  const content = await file.text();

  let parsed;
  try {
    if (format === "camt053") {
      parsed = parseCamt053(content);
    } else {
      const dateColumn = form.get("dateColumn") as string | null;
      const amountColumn = form.get("amountColumn") as string | null;
      if (!dateColumn || !amountColumn) return badRequest("Für CSV: dateColumn, amountColumn erforderlich");
      const mapping: CsvMapping = {
        dateColumn,
        amountColumn,
        purposeColumn: (form.get("purposeColumn") as string) || undefined,
        counterpartyIbanColumn: (form.get("counterpartyIbanColumn") as string) || undefined,
        counterpartyNameColumn: (form.get("counterpartyNameColumn") as string) || undefined,
        dateFormat: (form.get("dateFormat") as "iso" | "de") || "de",
        decimalSeparator: (form.get("decimalSeparator") as "," | ".") || ",",
        delimiter: (form.get("delimiter") as "," | ";") || ";",
      };
      parsed = parseCsv(content, mapping);
    }
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden");
  }

  const { data: existingTx, error: existingErr } = await supabase
    .from("transactions")
    .select("booking_date, amount, purpose")
    .eq("bank_account_id", bankAccountId);
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  const existingSignatures = (existingTx ?? []).map((t) => ({
    bookingDate: t.booking_date as string,
    amount: t.amount as number,
    purposeHash: purposeHash(t.purpose as string | null),
  }));

  const { data: rules, error: rulesErr } = await supabase
    .from("matching_rules")
    .select("id, pattern, target_unit_id, target_owner_id, target_cost_type_id")
    .eq("property_id", bankAccount.property_id)
    .eq("active", true);
  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 });

  const withDuplicates = markDuplicates(parsed, existingSignatures);
  const withSuggestions = applyMatchingRules(
    withDuplicates,
    (rules ?? []).map((r) => ({
      id: r.id,
      pattern: r.pattern as { iban?: string; purposeContains?: string },
      targetUnitId: r.target_unit_id,
      targetOwnerId: r.target_owner_id,
      targetCostTypeId: r.target_cost_type_id,
    }))
  );

  // ── B8.2 Stufe 2 (Heuristik) — nur für Zeilen ohne Stufe-1-Treffer ────────
  const unresolvedRows = withSuggestions.filter(
    (r) => !r.isDuplicate && !r.matchedRuleId && !r.suggestedOwnerId && !r.suggestedCostTypeId,
  );
  const hasUnresolvedIncoming = unresolvedRows.some((r) => r.amount > 0);
  const ownerCandidates = hasUnresolvedIncoming ? await loadOwnerCandidates(supabase, bankAccount.property_id) : [];

  const outgoingIbans = [...new Set(
    unresolvedRows.filter((r) => r.amount < 0 && r.counterpartyIban).map((r) => r.counterpartyIban as string),
  )];
  const priorBookingsByIban = new Map<string, { costTypeId: string | null }[]>();
  if (outgoingIbans.length > 0) {
    const { data: bankAccountsOfProperty } = await supabase
      .from("community_bank_accounts").select("id").eq("property_id", bankAccount.property_id);
    const propertyBankAccountIds = (bankAccountsOfProperty ?? []).map((b) => b.id as string);
    const { data: priorTx } = await supabase
      .from("transactions")
      .select("counterparty_iban, cost_type_id")
      .in("bank_account_id", propertyBankAccountIds)
      .in("counterparty_iban", outgoingIbans)
      .eq("status", "confirmed")
      .lt("amount", 0);
    for (const t of priorTx ?? []) {
      const iban = t.counterparty_iban as string;
      if (!priorBookingsByIban.has(iban)) priorBookingsByIban.set(iban, []);
      priorBookingsByIban.get(iban)!.push({ costTypeId: t.cost_type_id as string | null });
    }
  }

  const withStage2: RowWithStage2[] = withSuggestions.map((row): RowWithStage2 => {
    const isUnresolved = !row.isDuplicate && !row.matchedRuleId && !row.suggestedOwnerId && !row.suggestedCostTypeId;
    if (!isUnresolved) return { ...row, stage2OwnerSuggestions: [], stage2CostTypeSuggestion: null };

    if (row.amount > 0) {
      const stage2OwnerSuggestions = computeStage2IncomingSuggestions(
        { amountCents: row.amount, purpose: row.purpose, counterpartyName: row.counterpartyName },
        ownerCandidates,
      );
      return { ...row, stage2OwnerSuggestions, stage2CostTypeSuggestion: null };
    }

    const priorBookings = row.counterpartyIban ? priorBookingsByIban.get(row.counterpartyIban) ?? [] : [];
    const stage2CostTypeSuggestion = computeStage2OutgoingSuggestion(priorBookings);
    return { ...row, stage2OwnerSuggestions: [], stage2CostTypeSuggestion };
  });

  return NextResponse.json({
    rows: withStage2,
    summary: {
      total: withSuggestions.length,
      duplicates: withSuggestions.filter((r) => r.isDuplicate).length,
    },
  });
}
