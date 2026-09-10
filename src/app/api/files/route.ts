import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

// GET /api/files?folder_id=<id|root>   Dateien eines Ordners
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const folderId = request.nextUrl.searchParams.get("folder_id");

  let query = supabase
    .from("files")
    .select("id, folder_id, name, storage_path, file_size, mime_type, created_at, updated_at")
    .order("name", { ascending: true });

  if (folderId === "root" || folderId === null) query = query.is("folder_id", null);
  else query = query.eq("folder_id", folderId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
