import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

type CommitRow = {
  bookingDate: string; amount: number; purpose: string | null; counterpartyIban: string | null;
  counterpartyName?: string | null;
  counterpartyBic?: string | null; endToEndId?: string | null; mandateId?: string | null;
  bankRef?: string | null;
  bankTxCode?: { domainCode: string | null; familyCode: string | null; subFamilyCode: string | null; proprietaryCode: string | null } | null;
  returnReasonCode?: string | null; isReversal?: boolean; batchParentId?: string | null;
  needsManualSplit?: boolean; dedupKey?: string | null; raw?: unknown;
  isDuplicate: boolean; include: boolean;
  costTypeId?: string | null; unitId?: string | null; ownerId?: string | null;
};

type CommitStatement = {
  bankAccountId: string; rows: CommitRow[];
  openingBalance?: number | null; closingBalance?: number | null; closingDate?: string | null;
  saldenketteWarnings?: { code: string; reason: string; expected: number; actual: number }[];
};

type RejectedStatement = { iban: string | null; reason: string; sourceFileName?: string };

// POST /api/weg-buchhaltung/bank-accounts/[id]/import/commit
// Body: { fileName, format, fileHash, statements: CommitStatement[] }
// Übernimmt die (ggf. vom Anwender editierte) Vorschau aus .../import/preview,
// je Gruppe auf das dort aufgelöste Bankkonto (nicht mehr blind auf [id] in
// der URL — MB2/BC02). Legt ausschließlich status = 'suggested'-Buchungen an
// (harte Regel 0.3.3 — kein Import bestätigt sich selbst), rows mit
// include=false werden übersprungen. Bei bekanntem Schlusssaldo je Gruppe
// wird automatisch eine BalanceConfirmation mit Quelle 'import' angelegt.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id: bankAccountId } = await params;

  const { data: urlBankAccount, error: bankErr } = await supabase
    .from("community_bank_accounts")
    .select("id, property_id")
    .eq("id", bankAccountId)
    .single();
  if (bankErr || !urlBankAccount) return badRequest("Bankkonto nicht gefunden");

  const body = await request.json();
  const { fileName, format, fileHash, statements, rejectedStatements } = body as {
    fileName?: string; format?: string; fileHash?: string; statements?: CommitStatement[];
    rejectedStatements?: RejectedStatement[];
  };
  if (!fileName || !format || !Array.isArray(statements)) {
    return badRequest("Pflichtfelder: fileName, format, statements");
  }
  if (format !== "csv" && format !== "camt053") return badRequest("format muss 'csv' oder 'camt053' sein");

  // Jede Gruppe kann in der Vorschau auf ein anderes Konto derselben Property
  // aufgelöst worden sein (mehrere Stmt-Elemente/IBANs in einer Datei) — hier
  // absichern, dass kein Client ein Konto einer anderen Property unterschiebt.
  const groupAccountIds = [...new Set(statements.map((s) => s.bankAccountId))];
  if (groupAccountIds.length > 0) {
    const { data: groupAccounts } = await supabase
      .from("community_bank_accounts")
      .select("id, property_id")
      .in("id", groupAccountIds);
    const validIds = new Set((groupAccounts ?? []).filter((a) => a.property_id === urlBankAccount.property_id).map((a) => a.id as string));
    if (groupAccountIds.some((id) => !validIds.has(id))) {
      return badRequest("Mindestens ein Konto in statements gehört nicht zu dieser Property");
    }
  }

  if (fileHash) {
    const { data: existingImport } = await supabase
      .from("bank_statement_imports")
      .select("id")
      .eq("file_hash", fileHash)
      .maybeSingle();
    if (existingImport) {
      return NextResponse.json({ alreadyImported: true, importId: existingImport.id });
    }
  }

  const allRows = statements.flatMap((s) => s.rows);
  const toImportCount = allRows.filter((r) => r.include).length;
  const duplicateCount = allRows.filter((r) => r.isDuplicate).length;
  const involvedAccountIds = [...new Set(statements.map((s) => s.bankAccountId))];

  const { data: importRun, error: importErr } = await supabase
    .from("bank_statement_imports")
    .insert({
      tenant_id: tenantId,
      // Nur gesetzt, wenn die ganze Datei genau einem Konto zugeordnet wurde
      // (der historisch einkontobezogene Regelfall) — sonst bleibt es leer,
      // Details je Konto stehen in statement_summary.
      bank_account_id: involvedAccountIds.length === 1 ? involvedAccountIds[0] : null,
      file_name: fileName,
      file_hash: fileHash ?? null,
      format,
      imported_by: user.id,
      row_count: allRows.length,
      created_count: toImportCount,
      duplicate_count: duplicateCount,
      rejected_statements: rejectedStatements ?? [],
      warnings: statements.flatMap((s) => s.saldenketteWarnings ?? []),
      statement_summary: statements.map((s) => ({
        bankAccountId: s.bankAccountId,
        rowCount: s.rows.length,
        createdCount: s.rows.filter((r) => r.include).length,
        openingBalance: s.openingBalance ?? null,
        closingBalance: s.closingBalance ?? null,
        closingDate: s.closingDate ?? null,
      })),
    })
    .select("id")
    .single();
  if (importErr || !importRun) {
    return NextResponse.json({ error: importErr?.message ?? "Import-Lauf konnte nicht angelegt werden" }, { status: 500 });
  }

  const createdTransactions = [];
  for (const statement of statements) {
    const toImport = statement.rows.filter((r) => r.include);
    if (toImport.length === 0) continue;

    const { data: created, error: txErr } = await supabase
      .from("transactions")
      .insert(
        toImport.map((r) => ({
          tenant_id: tenantId,
          bank_account_id: statement.bankAccountId,
          booking_date: r.bookingDate,
          amount: r.amount,
          // Ein Zufluss, dem eine Einheit zugeordnet ist (per Stufe 1/2/3
          // oder manuell), ist eine Hausgeldzahlung — nur so greifen später
          // der Sollstellungsausgleich (B7.6) und die Ist-Zuführung zur
          // Rücklage (B7.7). Ohne Einheit bleibt es eine allgemeine Einnahme.
          kind: r.amount >= 0 ? (r.unitId ? "advance_payment" : "income") : "expense",
          cost_type_id: r.costTypeId ?? null,
          unit_id: r.unitId ?? null,
          owner_id: r.ownerId ?? null,
          purpose: r.purpose,
          counterparty_iban: r.counterpartyIban,
          counterparty_name: r.counterpartyName ?? null,
          counterparty_bic: r.counterpartyBic ?? null,
          end_to_end_id: r.endToEndId ?? null,
          mandate_id: r.mandateId ?? null,
          bank_ref: r.bankRef ?? null,
          bank_tx_code_domain: r.bankTxCode?.domainCode ?? null,
          bank_tx_code_family: r.bankTxCode?.familyCode ?? null,
          bank_tx_code_subfamily: r.bankTxCode?.subFamilyCode ?? null,
          bank_tx_code_proprietary: r.bankTxCode?.proprietaryCode ?? null,
          return_reason_code: r.returnReasonCode ?? null,
          is_reversal: r.isReversal ?? false,
          batch_parent_id: r.batchParentId ?? null,
          needs_manual_split: r.needsManualSplit ?? false,
          dedup_key: r.dedupKey ?? null,
          raw: r.raw ?? null,
          status: "suggested",
          source: "bank_import",
          import_id: importRun.id,
        }))
      )
      .select();
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    createdTransactions.push(...(created ?? []));

    if (statement.closingBalance != null && statement.closingDate) {
      await supabase
        .from("balance_confirmations")
        .upsert(
          {
            tenant_id: tenantId,
            bank_account_id: statement.bankAccountId,
            date: statement.closingDate,
            balance: statement.closingBalance,
            source: "import",
          },
          { onConflict: "bank_account_id,date" },
        );
    }
  }

  return NextResponse.json(
    { importId: importRun.id, created: createdTransactions.length, transactions: createdTransactions },
    { status: 201 },
  );
}
