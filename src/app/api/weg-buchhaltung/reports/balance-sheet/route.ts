import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { computeBalanceSheet } from "@/lib/weg-buchhaltung/ledger";

// GET /api/weg-buchhaltung/reports/balance-sheet?property_id=...&as_of=YYYY-MM-DD
// Bilanz (Bestandskonten) zu einem Stichtag (weg-buchhaltung-spec.md B7).
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  const asOf = request.nextUrl.searchParams.get("as_of") ?? new Date().toISOString().slice(0, 10);
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data: accounts, error: accErr } = await supabase
    .from("accounts")
    .select("id, code, name, kind")
    .eq("property_id", propertyId);
  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  const { data: entries, error: entriesErr } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("property_id", propertyId)
    .lte("date", asOf);
  if (entriesErr) return NextResponse.json({ error: entriesErr.message }, { status: 500 });

  const { data: lines, error: linesErr } = await supabase
    .from("journal_entry_lines")
    .select("account_id, debit, credit")
    .in("journal_entry_id", (entries ?? []).map((e) => e.id));
  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 });

  const report = computeBalanceSheet(
    (accounts ?? []).map((a) => ({ id: a.id, code: a.code, name: a.name, kind: a.kind })),
    (lines ?? []).map((l) => ({ accountId: l.account_id, debit: l.debit, credit: l.credit }))
  );

  return NextResponse.json({ asOf, ...report });
}
