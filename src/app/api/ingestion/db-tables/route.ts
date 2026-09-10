import { NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

export interface DbTable {
  table_name: string;
  text_columns: string[];
  row_estimate: number;
  indexed_count: number;
  total_chunks: number;
  source_id: string | null;
  last_indexed_at: string | null;
}

// GET /api/ingestion/db-tables
// Gibt alle public-Tabellen mit Textspalten zurück (via get_ingestion_tables()),
// angereichert mit Indexierungsstatus aus ingest_documents.
export async function GET() {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  // 1. Alle Tabellen mit Textspalten aus information_schema (via RPC)
  const { data: tables, error: tErr } = await supabase.rpc("get_ingestion_tables");
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  // 2. Indexierungsstatus je Tabelle aus ingest_documents
  //    external_id Format: "public.tablename:row:N"
  const { data: docs } = await supabase
    .from("ingest_documents")
    .select("external_id, status, source_id, updated_at")
    .eq("source_type", "supabase_table")
    .eq("tenant_id", tenantId);

  // Gruppieren nach Tabellenname
  const statusMap = new Map<string, {
    indexed: number;
    source_id: string | null;
    last_indexed_at: string | null;
  }>();

  for (const doc of docs ?? []) {
    const raw = (doc.external_id as string | null) ?? "";
    const tablePart = raw.split(":")[0]; // "public.tablename"
    const name = tablePart.includes(".") ? tablePart.split(".")[1] : tablePart;
    if (!name) continue;

    const cur = statusMap.get(name) ?? { indexed: 0, source_id: null, last_indexed_at: null };
    if (doc.status === "indexed") cur.indexed++;
    cur.source_id = cur.source_id ?? doc.source_id;
    if (!cur.last_indexed_at || (doc.updated_at && doc.updated_at > cur.last_indexed_at)) {
      cur.last_indexed_at = doc.updated_at;
    }
    statusMap.set(name, cur);
  }

  const result: DbTable[] = (tables ?? []).map((t: { table_name: string; text_columns: string[]; row_estimate: number }) => {
    const st = statusMap.get(t.table_name);
    return {
      table_name:      t.table_name,
      text_columns:    t.text_columns,
      row_estimate:    t.row_estimate,
      indexed_count:   st?.indexed ?? 0,
      total_chunks:    0,
      source_id:       st?.source_id ?? null,
      last_indexed_at: st?.last_indexed_at ?? null,
    };
  });

  return NextResponse.json(result);
}
