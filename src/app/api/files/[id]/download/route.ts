import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

// GET /api/files/:id/download   → kurzlebige, signierte Download-URL
export async function GET(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;

  // RLS-gescopter Read stellt Tenant-Zugehörigkeit sicher
  const { data: file, error } = await supabase
    .from("files")
    .select("storage_path, name")
    .eq("id", id)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from("documents")
    .createSignedUrl(file.storage_path, 60, { download: file.name });

  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message ?? "Signierung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, name: file.name });
}
