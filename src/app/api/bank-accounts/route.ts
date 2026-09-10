import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/bank-accounts
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.contact_id || !body.iban || !body.account_holder) {
    return badRequest("Pflichtfelder: contact_id, iban, account_holder");
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      contact_id: body.contact_id,
      iban: body.iban,
      bic: body.bic ?? null,
      account_holder: body.account_holder,
      sepa_mandate_reference: body.sepa_mandate_reference ?? null,
      sepa_mandate_date: body.sepa_mandate_date ?? null,
      sepa_mandate_status: body.sepa_mandate_status ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
