import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { rescoreApplicant, type ApplicantRow } from "@/lib/mietermatching/rescoring";
import type { ApplicantDocType } from "@/lib/mietermatching/scoring";

// Kategorien aus scripts/migration-mietermatching-mm2.sql (level='unit',
// eigene Gruppe statt der bestehenden vertragsbezogenen MIETER_DOKUMENTE-
// Gruppe — ein Bewerber hat noch keinen Mietvertrag).
const CATEGORY_BY_DOC_TYPE: Record<ApplicantDocType, string> = {
  income_proof: "dc000000-0000-0000-0015-000000000001",
  schufa: "dc000000-0000-0000-0015-000000000002",
  self_disclosure: "dc000000-0000-0000-0015-000000000003",
  other: "dc000000-0000-0000-0015-000000000004",
};

// GET /api/mietermatching/applicant-documents?applicant_id=...
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const applicantId = request.nextUrl.searchParams.get("applicant_id");
  if (!applicantId) return badRequest("Pflichtparameter: applicant_id");

  const { data, error } = await supabase
    .from("applicant_document")
    .select("id, doc_type, extraction_status, extracted_data, created_at, documents ( id, title, file_name, storage_path )")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/mietermatching/applicant-documents
// Body: { applicant_id, doc_type, storage_path, file_name, file_size?, mime_type? }
// Die Datei liegt zu diesem Zeitpunkt schon im Storage-Bucket "documents"
// (Client-Upload, wie bei K1/TransactionsSection). Legt eine `documents`-
// Zeile (level='unit', Kategorie nach doc_type) und die Verknüpfungszeile
// `applicant_document` an, danach Score-Neuberechnung — schon der Upload
// selbst zählt für "Vollständigkeit der Unterlagen" (scoring.ts).
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { applicant_id, doc_type, storage_path, file_name } = body;
  if (!applicant_id || !doc_type || !storage_path || !file_name) {
    return badRequest("Pflichtfelder: applicant_id, doc_type, storage_path, file_name");
  }
  if (!(doc_type in CATEGORY_BY_DOC_TYPE)) return badRequest("Ungültiger doc_type");

  const { data: applicant, error: applicantErr } = await supabase
    .from("applicant").select("id, unit_id").eq("id", applicant_id).single();
  if (applicantErr || !applicant) return badRequest("Bewerber nicht gefunden");

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      tenant_id: tenantId,
      category_id: CATEGORY_BY_DOC_TYPE[doc_type as ApplicantDocType],
      level: "unit",
      unit_id: applicant.unit_id,
      title: (body.title as string | undefined) ?? file_name.replace(/\.[^.]+$/, ""),
      storage_path,
      file_name,
      file_size: body.file_size ?? null,
      mime_type: body.mime_type ?? null,
      internal_only: true,
      uploaded_by: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

  const { data: applicantDoc, error: adErr } = await supabase
    .from("applicant_document")
    .insert({
      tenant_id: tenantId,
      applicant_id,
      document_id: doc.id,
      doc_type,
      created_by: user.id,
    })
    .select("id, doc_type, extraction_status, extracted_data, created_at, documents ( id, title, file_name, storage_path )")
    .single();
  if (adErr) return NextResponse.json({ error: adErr.message }, { status: 500 });

  const { data: fullApplicant } = await supabase
    .from("applicant")
    .select("id, unit_id, net_income, employment_type, household_size, desired_move_in, schufa_result, status")
    .eq("id", applicant_id)
    .single();

  let matchResult = null;
  if (fullApplicant) {
    try {
      matchResult = await rescoreApplicant(supabase, tenantId, fullApplicant as ApplicantRow);
    } catch {
      // Dokument ist angelegt; ein Fehler bei der Score-Neuberechnung soll den Upload nicht rückgängig machen.
    }
  }

  return NextResponse.json({ ...applicantDoc, match_result: matchResult }, { status: 201 });
}
