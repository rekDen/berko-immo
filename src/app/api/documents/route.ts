import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/documents?property_id=xxx&category_id=yyy&level=property&fiscal_year=2024
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { searchParams } = request.nextUrl;
  const propertyId = searchParams.get("property_id");
  const unitId = searchParams.get("unit_id");
  const contractId = searchParams.get("contract_id");
  const categoryId = searchParams.get("category_id");
  const level = searchParams.get("level");
  const fiscalYear = searchParams.get("fiscal_year");
  const batchId = searchParams.get("batch_id");
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("documents")
    .select(`
      *,
      document_categories ( id, code, group_code, name_de, name_en, name_ru, level )
    `)
    .order("uploaded_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (propertyId) query = query.eq("property_id", propertyId);
  if (unitId) query = query.eq("unit_id", unitId);
  if (contractId) query = query.eq("contract_id", contractId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (level) query = query.eq("level", level);
  if (fiscalYear) query = query.eq("fiscal_year", parseInt(fiscalYear));
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json([]);

  // Uploader-Profile + Marker-Details nachladen (Admin-Client umgeht RLS auf profiles)
  const admin = createAdminClient();
  const uploaderIds = [...new Set(data.map((d) => d.uploaded_by).filter(Boolean))];
  const markerIds = [...new Set(data.flatMap((d) => d.markers ?? []))];

  const [profilesRes, markersRes] = await Promise.all([
    uploaderIds.length
      ? admin.from("profiles").select("id, name").in("id", uploaderIds)
      : Promise.resolve({ data: [] }),
    markerIds.length
      ? admin.from("document_markers").select("id, name, color").in("id", markerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const markerMap = new Map((markersRes.data ?? []).map((m) => [m.id, m]));

  const enriched = data.map((d) => ({
    ...d,
    uploaded_by_name: d.uploaded_by ? profileMap.get(d.uploaded_by)?.name ?? null : null,
    marker_details: (d.markers ?? []).map((id: string) => markerMap.get(id)).filter(Boolean),
  }));

  return NextResponse.json(enriched);
}

// POST /api/documents
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.category_id || !body.title || !body.storage_path || !body.file_name) {
    return badRequest("Pflichtfelder: category_id, title, storage_path, file_name");
  }
  if (!body.level) {
    return badRequest("Pflichtfeld: level (property/unit/contract)");
  }
  if (body.level === "property" && !body.property_id) {
    return badRequest("property_id erforderlich für property-Level");
  }
  if (body.level === "unit" && !body.unit_id) {
    return badRequest("unit_id erforderlich für unit-Level");
  }
  if (body.level === "contract" && !body.contract_id) {
    return badRequest("contract_id erforderlich für contract-Level");
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      uploaded_by: user.id,
      category_id: body.category_id,
      level: body.level,
      property_id: body.property_id ?? null,
      unit_id: body.unit_id ?? null,
      contract_id: body.contract_id ?? null,
      title: body.title,
      description: body.description ?? null,
      storage_path: body.storage_path,
      file_name: body.file_name,
      file_size: body.file_size ?? null,
      mime_type: body.mime_type ?? null,
      file_hash: body.file_hash ?? null,
      fiscal_year: body.fiscal_year ?? null,
      markers: body.markers ?? [],
      internal_only: body.internal_only ?? false,
      batch_id: body.batch_id ?? null,
    })
    .select(`
      *,
      document_categories ( id, code, name_de, name_en, name_ru )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
