import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const VALID_TYPES = ['upload','supabase_storage','supabase_table','gdrive','dropbox','webdav','imap'] as const;

// GET /api/ingestion/sources
export async function GET(_request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { data, error } = await supabase
    .from("ingestion_sources")
    .select("*, ingest_documents(count)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/ingestion/sources  { source_type, name, config?, sync_interval_minutes? }
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.source_type || !body.name) return badRequest("Pflichtfelder: source_type, name");
  if (!VALID_TYPES.includes(body.source_type)) return badRequest("Ungültiger source_type");

  const { data, error } = await supabase
    .from("ingestion_sources")
    .insert({
      tenant_id:             tenantId,
      source_type:           body.source_type,
      name:                  body.name,
      config:                body.config ?? {},
      credential_ref:        body.credential_ref ?? null,
      sync_interval_minutes: body.sync_interval_minutes ?? 15,
      status:                "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
