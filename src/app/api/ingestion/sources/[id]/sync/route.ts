import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

type Params = { params: Promise<{ id: string }> };

// POST /api/ingestion/sources/:id/sync  — stellt Sync-Auftrag in extract_queue
// Der Worker pollt die Queue und holt neue/geänderte Dateien.
// Wir setzen last_synced_at auf null damit der Scheduler sofort aufgreift.
export async function POST(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { error } = await supabase
    .from("ingestion_sources")
    .update({ last_synced_at: null, status: "active" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Sync wird beim nächsten Scheduler-Lauf ausgeführt" });
}
