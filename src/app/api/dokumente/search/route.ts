import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

// GET /api/dokumente/search?q=   Namenssuche über Ordner + Dateien des Mandanten
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ folders: [], files: [] });

  const pattern = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;

  const [foldersRes, filesRes] = await Promise.all([
    supabase
      .from("folders")
      .select("id, parent_id, name, updated_at")
      .ilike("name", pattern)
      .order("name")
      .limit(50),
    supabase
      .from("files")
      .select("id, folder_id, name, mime_type, file_size, updated_at")
      .ilike("name", pattern)
      .order("name")
      .limit(50),
  ]);

  if (foldersRes.error) return NextResponse.json({ error: foldersRes.error.message }, { status: 500 });
  if (filesRes.error) return NextResponse.json({ error: filesRes.error.message }, { status: 500 });

  return NextResponse.json({ folders: foldersRes.data ?? [], files: filesRes.data ?? [] });
}
