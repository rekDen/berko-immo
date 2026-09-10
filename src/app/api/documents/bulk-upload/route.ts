import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/documents/bulk-upload
// Body: { name, property_id, category_id, level, fiscal_year?, batch_type?, items: [{ title, storage_path, file_name, file_size?, mime_type?, unit_id?, contract_id? }] }
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { name, property_id, category_id, level, fiscal_year, batch_type, items } = body;

  if (!name || !property_id || !category_id || !level) {
    return badRequest("Pflichtfelder: name, property_id, category_id, level");
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return badRequest("Mindestens ein Dokument erforderlich (items)");
  }

  const { data: batch, error: batchError } = await supabase
    .from("document_batches")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      name,
      batch_type: batch_type ?? "mass_upload",
      target_category_id: category_id,
      target_level: level,
      status: "processing",
    })
    .select()
    .single();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  const documents = items.map((item: {
    title: string;
    storage_path: string;
    file_name: string;
    file_size?: number;
    mime_type?: string;
    file_hash?: string;
    unit_id?: string;
    contract_id?: string;
  }) => ({
    tenant_id: tenantId,
    created_by: user.id,
    uploaded_by: user.id,
    category_id,
    level,
    property_id,
    unit_id: item.unit_id ?? null,
    contract_id: item.contract_id ?? null,
    title: item.title,
    storage_path: item.storage_path,
    file_name: item.file_name,
    file_size: item.file_size ?? null,
    mime_type: item.mime_type ?? null,
    file_hash: item.file_hash ?? null,
    fiscal_year: fiscal_year ?? null,
    batch_id: batch.id,
    markers: [],
    internal_only: false,
  }));

  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .insert(documents)
    .select("id, title, file_name");

  if (docsError) {
    await supabase
      .from("document_batches")
      .update({ status: "partially_failed" })
      .eq("id", batch.id);

    return NextResponse.json({ error: docsError.message, batch_id: batch.id }, { status: 500 });
  }

  await supabase
    .from("document_batches")
    .update({ status: "completed" })
    .eq("id", batch.id);

  return NextResponse.json({
    batch_id: batch.id,
    uploaded: docs?.length ?? 0,
    documents: docs,
  }, { status: 201 });
}
