import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-buchhaltung/accounts?property_id=...
// Kontenplan eines Objekts — u. a. als Gegenkonto-Auswahl für freie Buchungen
// (Spec 5.8.4: Umbuchungen/Korrekturen ohne zugrunde liegende Kostenart).
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data, error } = await supabase
    .from("accounts")
    .select("id, code, name, kind")
    .eq("property_id", propertyId)
    .is("closed_at", null)
    .order("code");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
