import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescoreApplicant, type ApplicantRow } from "@/lib/mietermatching/rescoring";

// DELETE /api/mietermatching/applicant-documents/[id]
// Entfernt die Verknüpfungszeile, soft-deleted das zugrunde liegende
// documents-Objekt und die Datei aus dem Storage (wie /api/documents/[id]),
// dann Score-Neuberechnung (Dokument zählt danach nicht mehr für
// "Vollständigkeit der Unterlagen").
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const { data: applicantDoc, error: readErr } = await supabase
    .from("applicant_document")
    .select("id, applicant_id, document_id, documents ( storage_path )")
    .eq("id", id)
    .single();
  if (readErr || !applicantDoc) return badRequest("Unterlage nicht gefunden");

  const { error: delErr } = await supabase.from("applicant_document").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const admin = createAdminClient();
  await admin.from("documents").update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", applicantDoc.document_id).eq("tenant_id", tenantId);
  const storagePath = (applicantDoc.documents as unknown as { storage_path: string } | null)?.storage_path;
  if (storagePath) await admin.storage.from("documents").remove([storagePath]);

  const { data: applicant } = await supabase
    .from("applicant")
    .select("id, unit_id, net_income, employment_type, household_size, desired_move_in, schufa_result, status")
    .eq("id", applicantDoc.applicant_id)
    .single();

  let matchResult = null;
  if (applicant) {
    try {
      matchResult = await rescoreApplicant(supabase, tenantId, applicant as ApplicantRow);
    } catch {
      // Löschung ist bereits erfolgt; ein Fehler bei der Score-Neuberechnung wird nicht rückgängig gemacht.
    }
  }

  return NextResponse.json({ ok: true, match_result: matchResult });
}
