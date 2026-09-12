import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

type CommitRow = {
  bookingDate: string; amount: number; purpose: string | null; counterpartyIban: string | null;
  isDuplicate: boolean; include: boolean;
  costTypeId?: string | null; unitId?: string | null; ownerId?: string | null;
};

// POST /api/weg-buchhaltung/bank-accounts/[id]/import/commit
// Body: { fileName, format, rows: CommitRow[] }
// Übernimmt die (ggf. vom Anwender editierte) Vorschau aus .../import/preview.
// Legt ausschließlich status = 'suggested'-Buchungen an (harte Regel 0.3.3 —
// kein Import bestätigt sich selbst), rows mit include=false werden übersprungen.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id: bankAccountId } = await params;

  const body = await request.json();
  const { fileName, format, rows } = body as { fileName?: string; format?: string; rows?: CommitRow[] };
  if (!fileName || !format || !Array.isArray(rows)) {
    return badRequest("Pflichtfelder: fileName, format, rows");
  }
  if (format !== "csv" && format !== "camt053") return badRequest("format muss 'csv' oder 'camt053' sein");

  const toImport = rows.filter((r) => r.include);
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;

  const { data: importRun, error: importErr } = await supabase
    .from("bank_statement_imports")
    .insert({
      tenant_id: tenantId,
      bank_account_id: bankAccountId,
      file_name: fileName,
      format,
      imported_by: user.id,
      row_count: rows.length,
      created_count: toImport.length,
      duplicate_count: duplicateCount,
    })
    .select("id")
    .single();
  if (importErr || !importRun) {
    return NextResponse.json({ error: importErr?.message ?? "Import-Lauf konnte nicht angelegt werden" }, { status: 500 });
  }

  if (toImport.length === 0) {
    return NextResponse.json({ importId: importRun.id, created: 0, transactions: [] }, { status: 201 });
  }

  const { data: created, error: txErr } = await supabase
    .from("transactions")
    .insert(
      toImport.map((r) => ({
        tenant_id: tenantId,
        bank_account_id: bankAccountId,
        booking_date: r.bookingDate,
        amount: r.amount,
        kind: r.amount >= 0 ? "income" : "expense",
        cost_type_id: r.costTypeId ?? null,
        unit_id: r.unitId ?? null,
        owner_id: r.ownerId ?? null,
        purpose: r.purpose,
        counterparty_iban: r.counterpartyIban,
        status: "suggested",
        source: "bank_import",
        import_id: importRun.id,
      }))
    )
    .select();
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ importId: importRun.id, created: created.length, transactions: created }, { status: 201 });
}
