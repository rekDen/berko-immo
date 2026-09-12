import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const CODE_BASE: Record<"expense" | "income", number> = { expense: 4000, income: 8000 };

// GET /api/weg-buchhaltung/cost-types?property_id=...
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data, error } = await supabase
    .from("cost_types")
    .select("id, name, direction, allocation_key_id, is_heating, allows_direct_charge, apportionable, betrkv_no, resolution_ref, ledger_account_id, accounts ( code, name )")
    .eq("property_id", propertyId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/weg-buchhaltung/cost-types
// Body: { property_id, name, direction, allocation_key_id?, is_heating?, allows_direct_charge?,
//         apportionable?, betrkv_no?, resolution_ref? }
// Legt automatisch das zugehörige Erfolgskonto im Kontenplan an (Spec 5.8.1).
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.name || !body.direction) {
    return badRequest("Pflichtfelder: property_id, name, direction");
  }
  if (body.direction !== "expense" && body.direction !== "income") {
    return badRequest("direction muss 'expense' oder 'income' sein");
  }
  if (body.betrkv_no !== undefined && body.betrkv_no !== null && (body.betrkv_no < 1 || body.betrkv_no > 17)) {
    return badRequest("betrkv_no muss zwischen 1 und 17 liegen");
  }

  // Nächsten freien Kontocode im passenden Nummernkreis ermitteln (4000er
  // Aufwand, 8000er Ertrag) — einfache, deterministische Vergabe je Objekt.
  const { data: existingAccounts, error: acctReadErr } = await supabase
    .from("accounts")
    .select("code")
    .eq("property_id", body.property_id)
    .eq("kind", body.direction);
  if (acctReadErr) return NextResponse.json({ error: acctReadErr.message }, { status: 500 });

  const base = CODE_BASE[body.direction as "expense" | "income"];
  const usedCodes = new Set((existingAccounts ?? []).map((a) => parseInt(a.code, 10)).filter((n) => !isNaN(n)));
  let nextCode = base;
  while (usedCodes.has(nextCode)) nextCode += 10;

  const { data: account, error: acctErr } = await supabase
    .from("accounts")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      code: String(nextCode),
      name: body.name,
      kind: body.direction,
    })
    .select("id")
    .single();
  if (acctErr || !account) return NextResponse.json({ error: acctErr?.message ?? "Konto konnte nicht angelegt werden" }, { status: 500 });

  const { data: costType, error: ctErr } = await supabase
    .from("cost_types")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      name: body.name,
      direction: body.direction,
      allocation_key_id: body.allocation_key_id ?? null,
      is_heating: body.is_heating ?? false,
      allows_direct_charge: body.allows_direct_charge ?? false,
      apportionable: body.apportionable ?? false,
      betrkv_no: body.betrkv_no ?? null,
      resolution_ref: body.resolution_ref ?? null,
      ledger_account_id: account.id,
    })
    .select("id, name, direction, allocation_key_id, is_heating, allows_direct_charge, apportionable, betrkv_no, resolution_ref, ledger_account_id, accounts ( code, name )")
    .single();

  if (ctErr) {
    // Bestes Bemühen, das verwaiste Konto wieder zu entfernen — keine
    // DB-Transaktion über zwei Tabellen hinweg via supabase-js verfügbar.
    await supabase.from("accounts").delete().eq("id", account.id);
    return NextResponse.json({ error: ctErr.message }, { status: 500 });
  }

  return NextResponse.json(costType, { status: 201 });
}
