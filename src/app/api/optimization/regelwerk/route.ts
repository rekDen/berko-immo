import { NextRequest, NextResponse } from "next/server";
import { unauthorized, withAuth } from "@/lib/supabase/api";
import { filterGueltig } from "@/lib/optimization/constraints";
import type { Regel } from "@/lib/optimization/types";

// GET /api/optimization/regelwerk?gemeinde=<uuid>&datum=YYYY-MM-DD
// Liefert das zum Stichtag gültige Regelset einer Gemeinde.
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const gemeinde = searchParams.get("gemeinde");
  const datum = searchParams.get("datum") ?? new Date().toISOString().split("T")[0];

  let query = supabase
    .from("regelwerk")
    .select("id, gemeinde_id, regel_code, parameter, gueltig_von, gueltig_bis, quelle");
  if (gemeinde) query = query.eq("gemeinde_id", gemeinde);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(filterGueltig((data ?? []) as Regel[], datum));
}
