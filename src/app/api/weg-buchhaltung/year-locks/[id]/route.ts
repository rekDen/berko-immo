import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// PATCH /api/weg-buchhaltung/year-locks/[id]
// Body: { reason }
// Entsperrt ein gesperrtes Buchungsjahr (B8.8: nur mit Begründung, protokolliert).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  if (!body.reason || typeof body.reason !== "string" || body.reason.trim().length === 0) {
    return badRequest("Pflichtfeld: reason");
  }

  const { data: lock, error: readErr } = await supabase
    .from("year_locks").select("id, unlocked_at").eq("id", id).single();
  if (readErr || !lock) return badRequest("Jahressperre nicht gefunden");
  if (lock.unlocked_at) return badRequest("Diese Jahressperre ist bereits aufgehoben");

  const { data, error } = await supabase
    .from("year_locks")
    .update({ unlocked_at: new Date().toISOString(), unlocked_by: user.id, unlock_reason: body.reason })
    .eq("id", id)
    .select("id, year, locked_at, locked_by, settlement_id, unlocked_at, unlocked_by, unlock_reason")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
