import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { extractApplicantDocument } from "@/lib/mietermatching/extract-applicant-document";
import type { ApplicantDocType } from "@/lib/mietermatching/scoring";

// POST /api/mietermatching/applicant-documents/[id]/extract
// KI-Vorschlag aus einer einzelnen Bewerberunterlage (K1-Muster, s.
// weg-buchhaltung/extract-invoice). Reiner Vorschlag: wird hier nur
// zurückgegeben und im applicant_document-Cache abgelegt, nie automatisch
// in den Bewerber-Datensatz übernommen — das passiert erst über explizites
// "Übernehmen" (Client) + "Speichern" (PATCH /applicants/[id]).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { data: applicantDoc, error: adErr } = await supabase
    .from("applicant_document")
    .select("id, doc_type, documents ( storage_path, mime_type, file_name )")
    .eq("id", id)
    .single();
  if (adErr || !applicantDoc) return badRequest("Unterlage nicht gefunden");

  const doc = applicantDoc.documents as unknown as { storage_path: string; mime_type: string | null; file_name: string };
  const { data: blob, error: dlErr } = await supabase.storage.from("documents").download(doc.storage_path);
  if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message ?? "Unterlage konnte nicht geladen werden" }, { status: 500 });

  try {
    const extraction = await extractApplicantDocument(blob, doc.mime_type, doc.file_name, applicantDoc.doc_type as ApplicantDocType);

    await supabase.from("applicant_document")
      .update({ extraction_status: "extracted", extracted_data: extraction })
      .eq("id", id);

    return NextResponse.json(extraction);
  } catch (e) {
    await supabase.from("applicant_document").update({ extraction_status: "failed" }).eq("id", id);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bewerberdaten-Erkennung fehlgeschlagen" }, { status: 500 });
  }
}
