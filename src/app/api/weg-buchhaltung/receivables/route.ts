import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-buchhaltung/receivables?property_id=...&unit_id=...&status=...
// Kontoblatt-Grundlage (B7.8): Sollstellungen einer Einheit/eines Objekts.
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");
  const unitId = request.nextUrl.searchParams.get("unit_id");
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("receivables")
    .select("id, unit_id, owner_id, kind, amount, components, due_date, period_month, status, cancelled_reason, units ( unit_number ), contacts ( first_name, last_name, company_name )")
    .eq("property_id", propertyId)
    .order("due_date");

  if (unitId) query = query.eq("unit_id", unitId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
