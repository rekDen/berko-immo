import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { parseCsv } from "@/lib/weg-buchhaltung/import/csv";
import { parseCamt053 } from "@/lib/weg-buchhaltung/import/camt053";
import { markDuplicates } from "@/lib/weg-buchhaltung/import/duplicates";
import { computeFileHash } from "@/lib/weg-buchhaltung/import/file-hash";
import { extractCamt053Files } from "@/lib/weg-buchhaltung/import/zip";
import { checkSaldenkette, type SaldenketteWarning } from "@/lib/weg-buchhaltung/import/saldenkette";
import { applyMatchingRules } from "@/lib/weg-buchhaltung/import/matching";
import {
  computeStage2IncomingSuggestions, computeStage2OutgoingSuggestion,
  type HeuristicOwnerCandidate,
} from "@/lib/weg-buchhaltung/matching-heuristic";
import { suggestCostTypeStage3, type Stage3CostTypeCandidate } from "@/lib/weg-buchhaltung/matching-ai";
import type { CsvMapping, NormalizedStatement, RowWithStage3 } from "@/lib/weg-buchhaltung/import/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

function wrapCsvAsStatement(rows: ReturnType<typeof parseCsv>, accountIban: string | null): NormalizedStatement {
  return {
    iban: accountIban,
    externalId: null,
    schemaVersion: "unknown",
    openingBalance: null,
    closingBalance: null,
    closingDate: null,
    rejectedEntries: [],
    entries: rows.map((r) => ({
      ...r,
      valueDate: null,
      currency: "EUR",
      counterpartyBic: null,
      endToEndId: null,
      mandateId: null,
      bankRef: null,
      bankTxCode: null,
      returnReasonCode: null,
      isReversal: false,
      batchParentId: null,
      needsManualSplit: false,
      raw: r,
    })),
  };
}

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
// amountColumn, purposeColumn?, counterpartyIbanColumn?, counterpartyNameColumn?,
// dateFormat, decimalSeparator, delimiter?
// Reine Vorschau — schreibt NICHTS in die Datenbank (harte Regel 0.3.2).
// MB2: eine CAMT.053-Datei (oder ein ZIP mehrerer Dateien) kann mehrere
// Auszüge/Konten (Stmt-Elemente) enthalten; jeder Auszug wird über seine
// IBAN einem Bankkonto der Property zugeordnet (unbekannte IBAN → BC02,
// Auszug abgelehnt, andere Auszüge derselben Datei laufen weiter). [id] in
// der URL bleibt Auth-/Property-Scope und das feste Ziel für CSV-Importe
// (CSV enthält keine IBAN).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id: bankAccountId } = await params;

  const { data: bankAccount, error: bankErr } = await supabase
    .from("community_bank_accounts")
    .select("id, property_id, iban")
    .eq("id", bankAccountId)
    .single();
  if (bankErr || !bankAccount) return badRequest("Bankkonto nicht gefunden");

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const format = form.get("format") as string | null;
  if (!file || !format) return badRequest("Pflichtfelder: file, format");
  if (format !== "csv" && format !== "camt053") return badRequest("format muss 'csv' oder 'camt053' sein");

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const fileHash = computeFileHash(fileBytes);

  const { data: existingImport } = await supabase
    .from("bank_statement_imports")
    .select("id")
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (existingImport) {
    return NextResponse.json({ alreadyImported: true, importId: existingImport.id });
  }

  // { statement, sourceFileName } — sourceFileName nur bei ZIP-Uploads mit
  // mehreren Dateien informativ für die Ablehnungsmeldung relevant.
  let parsedStatements: { statement: NormalizedStatement; sourceFileName?: string }[];
  try {
    if (format === "camt053") {
      const isZip = file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip";
      if (isZip) {
        const xmlFiles = await extractCamt053Files(fileBytes.buffer as ArrayBuffer);
        if (xmlFiles.length === 0) return badRequest("ZIP-Archiv enthält keine XML-Dateien");
        parsedStatements = xmlFiles.flatMap(({ fileName, xml }) =>
          parseCamt053(xml).map((statement) => ({ statement, sourceFileName: fileName })),
        );
      } else {
        const content = new TextDecoder("utf-8").decode(fileBytes);
        parsedStatements = parseCamt053(content).map((statement) => ({ statement, sourceFileName: file.name }));
      }
    } else {
      const content = new TextDecoder("utf-8").decode(fileBytes);
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
      const rows = parseCsv(content, mapping);
      parsedStatements = [{ statement: wrapCsvAsStatement(rows, bankAccount.iban as string | null) }];
    }
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden");
  }

  // Alle Bankkonten der Property laden, um jeden Auszug per IBAN aufzulösen (BC02).
  const { data: propertyAccounts } = await supabase
    .from("community_bank_accounts")
    .select("id, iban, label")
    .eq("property_id", bankAccount.property_id);
  const accountByIban = new Map(
    (propertyAccounts ?? []).map((a) => [normalizeIban(a.iban as string), { id: a.id as string, label: a.label as string }]),
  );

  type ResolvedGroup = {
    bankAccountId: string; iban: string | null; label: string; statement: NormalizedStatement;
  };
  const resolvedGroups: ResolvedGroup[] = [];
  const rejectedStatements: { iban: string | null; reason: string; sourceFileName?: string }[] = [];

  for (const { statement, sourceFileName } of parsedStatements) {
    if (format === "csv") {
      resolvedGroups.push({ bankAccountId, iban: bankAccount.iban as string | null, label: "", statement });
      continue;
    }
    const resolved = statement.iban ? accountByIban.get(normalizeIban(statement.iban)) : undefined;
    if (!resolved) {
      rejectedStatements.push({ iban: statement.iban, reason: "Unbekannte IBAN", sourceFileName });
      continue;
    }
    resolvedGroups.push({ bankAccountId: resolved.id, iban: statement.iban, label: resolved.label, statement });
  }

  if (resolvedGroups.length === 0) {
    return NextResponse.json({
      statements: [], rejectedStatements, summary: { total: 0, duplicates: 0 }, fileHash,
    });
  }

  const involvedAccountIds = [...new Set(resolvedGroups.map((g) => g.bankAccountId))];

  const { data: existingTx } = await supabase
    .from("transactions")
    .select("bank_account_id, dedup_key")
    .in("bank_account_id", involvedAccountIds)
    .not("dedup_key", "is", null);
  const existingKeysByAccount = new Map<string, Set<string>>();
  for (const t of existingTx ?? []) {
    const accId = t.bank_account_id as string;
    if (!existingKeysByAccount.has(accId)) existingKeysByAccount.set(accId, new Set());
    existingKeysByAccount.get(accId)!.add(t.dedup_key as string);
  }

  const { data: rules } = await supabase
    .from("matching_rules")
    .select("id, pattern, target_unit_id, target_owner_id, target_cost_type_id")
    .eq("property_id", bankAccount.property_id)
    .eq("active", true);
  const matchingRuleInputs = (rules ?? []).map((r) => ({
    id: r.id as string,
    pattern: r.pattern as { iban?: string; purposeContains?: string },
    targetUnitId: r.target_unit_id as string | null,
    targetOwnerId: r.target_owner_id as string | null,
    targetCostTypeId: r.target_cost_type_id as string | null,
  }));

  const { data: costTypeRows } = await supabase
    .from("cost_types").select("id, name, direction").eq("property_id", bankAccount.property_id);
  const costTypeCandidates: Stage3CostTypeCandidate[] = (costTypeRows ?? []).map((c) => ({
    id: c.id as string, name: c.name as string, direction: c.direction as "expense" | "income",
  }));
  const costTypeNameById = new Map(costTypeCandidates.map((c) => [c.id, c.name]));

  // Stufe 1 (Regeln) je Gruppe anwenden — Regeln/Kostenarten sind property-, nicht kontoweit.
  const stage1Groups = resolvedGroups.map((group) => {
    const withDuplicates = markDuplicates(
      group.statement.entries, group.iban, existingKeysByAccount.get(group.bankAccountId) ?? new Set(),
    );
    const withSuggestions = applyMatchingRules(withDuplicates, matchingRuleInputs);
    return { group, rows: withSuggestions };
  });

  // Stufe 2 (Heuristik) — Eigentümer-/Gegenpartei-Kandidaten einmal property-
  // weit laden (nicht je Gruppe), nur wenn tatsächlich unaufgelöste Zeilen vorliegen.
  const allUnresolved = stage1Groups.flatMap(({ rows }) =>
    rows.filter((r) => !r.isDuplicate && !r.matchedRuleId && !r.suggestedOwnerId && !r.suggestedCostTypeId),
  );
  const hasUnresolvedIncoming = allUnresolved.some((r) => r.amount > 0);
  const ownerCandidates = hasUnresolvedIncoming ? await loadOwnerCandidates(supabase, bankAccount.property_id) : [];

  const outgoingIbans = [...new Set(
    allUnresolved.filter((r) => r.amount < 0 && r.counterpartyIban).map((r) => r.counterpartyIban as string),
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

  // Letzten bekannten Schlusssaldo je betroffenem Konto laden (Saldenkette, B5.6).
  const previousClosingByAccount = new Map<string, number | null>();
  if (format === "camt053") {
    for (const accId of involvedAccountIds) {
      const group = resolvedGroups.find((g) => g.bankAccountId === accId);
      let query = supabase
        .from("balance_confirmations")
        .select("balance, date")
        .eq("bank_account_id", accId)
        .order("date", { ascending: false })
        .limit(1);
      if (group?.statement.closingDate) query = query.lt("date", group.statement.closingDate);
      const { data: prevBalance } = await query.maybeSingle();
      previousClosingByAccount.set(accId, (prevBalance?.balance as number | undefined) ?? null);
    }
  }

  const responseStatements = await Promise.all(
    stage1Groups.map(async ({ group, rows }) => {
      const withStage2 = rows.map((row) => {
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

      // B8.2 Stufe 3 (KI) — nur für Zeilen ohne Stufe-2-Vorschlag. Bewusst
      // keine Eigentümerdaten übermittelt (s. matching-ai.ts).
      const withStage3: RowWithStage3[] = await Promise.all(
        withStage2.map(async (row): Promise<RowWithStage3> => {
          const hasStage2Suggestion = row.stage2OwnerSuggestions.length > 0 || row.stage2CostTypeSuggestion !== null;
          const isUnresolved = !row.isDuplicate && !row.matchedRuleId && !row.suggestedOwnerId && !row.suggestedCostTypeId;
          if (!isUnresolved || hasStage2Suggestion || costTypeCandidates.length === 0) {
            return { ...row, stage3CostTypeSuggestion: null };
          }
          const suggestion = await suggestCostTypeStage3(
            { purpose: row.purpose, amountCents: row.amount, counterpartyName: row.amount < 0 ? row.counterpartyName : null },
            costTypeCandidates,
          );
          if (!suggestion) return { ...row, stage3CostTypeSuggestion: null };
          return {
            ...row,
            stage3CostTypeSuggestion: {
              costTypeId: suggestion.costTypeId,
              costTypeName: costTypeNameById.get(suggestion.costTypeId) ?? suggestion.costTypeId,
              confidence: suggestion.confidence,
              reasoning: suggestion.reasoning,
            },
          };
        }),
      );

      const saldenketteWarnings: SaldenketteWarning[] =
        format === "camt053"
          ? checkSaldenkette({
              previousClosingBalance: previousClosingByAccount.get(group.bankAccountId) ?? null,
              statementOpeningBalance: group.statement.openingBalance,
              statementClosingBalance: group.statement.closingBalance,
              entryAmounts: group.statement.entries.map((e) => e.amount),
            })
          : [];

      return {
        bankAccountId: group.bankAccountId,
        iban: group.iban,
        label: group.label,
        rows: withStage3,
        openingBalance: group.statement.openingBalance,
        closingBalance: group.statement.closingBalance,
        closingDate: group.statement.closingDate,
        rejectedEntries: group.statement.rejectedEntries,
        saldenketteWarnings,
      };
    }),
  );

  const total = responseStatements.reduce((sum, s) => sum + s.rows.length, 0);
  const duplicates = responseStatements.reduce((sum, s) => sum + s.rows.filter((r) => r.isDuplicate).length, 0);

  return NextResponse.json({
    statements: responseStatements,
    rejectedStatements,
    summary: { total, duplicates },
    fileHash,
  });
}
