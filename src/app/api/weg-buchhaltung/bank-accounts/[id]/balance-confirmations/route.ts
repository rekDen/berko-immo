import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/weg-buchhaltung/bank-accounts/[id]/balance-confirmations
// Body: { date, balance } — balance in Cents. Kontoauszugssaldo zu einem Stichtag (Spec 5.2).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id: bankAccountId } = await params;

  const body = await request.json();
  if (!body.date || body.balance === undefined || body.balance === null) {
    return badRequest("Pflichtfelder: date, balance");
  }
  if (!Number.isInteger(body.balance)) return badRequest("balance muss ein ganzzahliger Cent-Betrag sein");

  const { data, error } = await supabase
    .from("balance_confirmations")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      bank_account_id: bankAccountId,
      date: body.date,
      balance: body.balance,
      source: "manual",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
