import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

type Params = { params: Promise<{ id: string }> };

// GET /api/ingestion/sources/:id/tables
// Gibt alle Tabellennamen zurück, die für diese Quelle in ingest_documents eingetragen sind.
// external_id hat das Format "schema.table:row:N" — wir extrahieren den Tabellenteil.
export async function GET(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data, error } = await supabase
    .from("ingest_documents")
    .select("external_id, status")
    .eq("source_id", id)
    .not("external_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tabellennamen aus external_id extrahieren und gruppieren
  const tableMap = new Map<string, { total: number; indexed: number; failed: number }>();
  for (const doc of data ?? []) {
    // Format: "public.properties:row:0"
    const tableName = (doc.external_id as string).split(":")[0];
    if (!tableName) continue;
    const entry = tableMap.get(tableName) ?? { total: 0, indexed: 0, failed: 0 };
    entry.total++;
    if (doc.status === "indexed") entry.indexed++;
    if (doc.status === "failed")  entry.failed++;
    tableMap.set(tableName, entry);
  }

  const tables = [...tableMap.entries()]
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(tables);
}
