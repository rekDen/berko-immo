import { NextResponse } from "next/server";
import { unauthorized, withAuth } from "@/lib/supabase/api";

// GET /api/optimization/massnahme-typen — Maßnahmen-Katalog (Stammdaten)
export async function GET() {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { data, error } = await supabase
    .from("massnahme_typ")
    .select("code, kategorie, klasse, label, param_schema, constraint_codes")
    .order("kategorie", { ascending: true })
    .order("label", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
