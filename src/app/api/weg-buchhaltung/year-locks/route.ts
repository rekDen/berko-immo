import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-buchhaltung/year-locks?property_id=...
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data, error } = await supabase
    .from("year_locks")
    .select("id, year, locked_at, locked_by, settlement_id, unlocked_at, unlocked_by, unlock_reason")
    .eq("property_id", propertyId)
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/weg-buchhaltung/year-locks
// Body: { property_id, year }
// Sperrt ein Buchungsjahr (B9). Vorbedingung (minimal, s. hausgeldabrechnung-plan.md
// Abschnitt 9): keine unbestätigte Buchung mit Buchungstag im Jahr auf einem
// Bankkonto dieses Objekts (BC04/BC05-Äquivalent). Die volle Saldenketten-
// prüfung (B5.6/BC01) setzt eine BankStatement-Kette voraus, die dieses
// Modul bewusst nicht nachbaut (s. Plan Abschnitt 9.4) — insofern ist diese
// Sperre eine Teilprüfung, kein vollständiges B9.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.year) return badRequest("Pflichtfelder: property_id, year");
  if (!Number.isInteger(body.year)) return badRequest("year muss eine ganze Zahl sein");

  const { data: bankAccounts, error: bankErr } = await supabase
    .from("community_bank_accounts").select("id").eq("property_id", body.property_id);
  if (bankErr) return NextResponse.json({ error: bankErr.message }, { status: 500 });

  const { data: unconfirmed, error: unconfirmedErr } = await supabase
    .from("transactions")
    .select("id")
    .in("bank_account_id", (bankAccounts ?? []).map((b) => b.id))
    .eq("status", "suggested")
    .gte("booking_date", `${body.year}-01-01`)
    .lte("booking_date", `${body.year}-12-31`)
    .limit(1);
  if (unconfirmedErr) return NextResponse.json({ error: unconfirmedErr.message }, { status: 500 });

  if ((unconfirmed ?? []).length > 0) {
    return badRequest("Es gibt noch unbestätigte Buchungen mit Buchungstag im Jahr — Jahressperre nicht möglich (BC04)");
  }

  const { data, error } = await supabase
    .from("year_locks")
    .insert({ tenant_id: tenantId, property_id: body.property_id, year: body.year, locked_by: user.id })
    .select("id, year, locked_at, locked_by, settlement_id, unlocked_at, unlocked_by, unlock_reason")
    .single();

  if (error) {
    if (error.message.includes("uq_year_locks_active")) {
      return badRequest("Dieses Jahr ist für dieses Objekt bereits gesperrt");
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
