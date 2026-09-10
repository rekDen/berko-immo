import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

type Params = { params: Promise<{ id: string }> };

// GET /api/documents/batches/:id
export async function GET(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  const { data: batch, error: batchError } = await supabase
    .from("document_batches")
    .select("*")
    .eq("id", id)
    .single();

  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 404 });

  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id, title, file_name, file_size, uploaded_at, deleted_at")
    .eq("batch_id", id)
    .order("uploaded_at", { ascending: true });

  if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 });

  return NextResponse.json({ ...batch, documents: docs });
}

// DELETE /api/documents/batches/:id — komplette Sendung rückgängig machen
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const now = new Date().toISOString();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("batch_id", id)
    .is("deleted_at", null);

  if (docs && docs.length > 0) {
    const { error: deleteDocsError } = await supabase
      .from("documents")
      .update({ deleted_at: now, deleted_by: user.id })
      .eq("batch_id", id)
      .is("deleted_at", null);

    if (deleteDocsError) {
      return NextResponse.json({ error: deleteDocsError.message }, { status: 500 });
    }

    const paths = docs.map((d) => d.storage_path);
    if (paths.length > 0) {
      await supabase.storage.from("documents").remove(paths);
    }
  }

  const { error: batchError } = await supabase
    .from("document_batches")
    .update({ status: "draft" as const })
    .eq("id", id);

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deleted_documents: docs?.length ?? 0,
  });
}
