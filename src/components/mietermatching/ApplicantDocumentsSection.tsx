"use client";

import { useState } from "react";
import { FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { inputCls, cardCls } from "./shared";
import { DOC_TYPE_LABELS, type ApplicantDocType } from "@/lib/mietermatching/scoring";

export interface ApplicantDocExtraction {
  net_income_cents?: number;
  employment_type?: string;
  household_size?: number;
  schufa_classification?: "none_negative" | "soft_negative" | "hard_negative";
}

export interface ApplicantDocumentRow {
  id: string;
  doc_type: ApplicantDocType;
  extraction_status: "pending" | "extracted" | "failed";
  extracted_data: ApplicantDocExtraction | null;
  created_at: string;
  documents: { id: string; title: string; file_name: string; storage_path: string } | null;
}

// Bewerberunterlagen (Spec §2.3): Upload + optionaler KI-Vorschlag (K1-
// Muster). Ein Vorschlag wird nie automatisch übernommen — erst der Klick
// auf "Übernehmen" füllt das Bewerber-Formular, gespeichert wird dort
// separat über den regulären "Speichern"-Button.
export function ApplicantDocumentsSection({
  applicantId, unitId, documents, onChanged, onApply, onError,
}: {
  applicantId: string; unitId: string; documents: ApplicantDocumentRow[];
  onChanged: () => void; onApply: (extraction: ApplicantDocExtraction) => void; onError: (msg: string) => void;
}) {
  const [docType, setDocType] = useState<ApplicantDocType>("income_proof");
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const storagePath = `${unitId}/unit/mietermatching/${crypto.randomUUID()}.${ext}`;
      const { error: storageErr } = await supabase.storage.from("documents").upload(storagePath, file, { contentType: file.type });
      if (storageErr) { onError(storageErr.message); return; }
      const res = await fetch("/api/mietermatching/applicant-documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant_id: applicantId, doc_type: docType, storage_path: storagePath,
          file_name: file.name, file_size: file.size, mime_type: file.type || null,
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "Upload fehlgeschlagen" })); onError(err.error); return; }
      onChanged();
    } finally {
      setUploading(false);
    }
  }

  async function extract(docId: string) {
    setExtractingId(docId);
    const res = await fetch(`/api/mietermatching/applicant-documents/${docId}/extract`, { method: "POST" });
    if (res.ok) {
      onChanged();
    } else {
      const err = await res.json().catch(() => ({ error: "KI-Erkennung fehlgeschlagen" }));
      onError(err.error);
    }
    setExtractingId(null);
  }

  async function remove(docId: string) {
    const res = await fetch(`/api/mietermatching/applicant-documents/${docId}`, { method: "DELETE" });
    if (res.ok) onChanged();
    else {
      const err = await res.json().catch(() => ({ error: "Löschen fehlgeschlagen" }));
      onError(err.error);
    }
  }

  return (
    <div className={`${cardCls} p-5`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Unterlagen
      </h3>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={docType} onChange={(e) => setDocType(e.target.value as ApplicantDocType)} className={inputCls}>
          {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 cursor-pointer transition-colors">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Datei hochladen
          <input
            type="file" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
          />
        </label>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Noch keine Unterlagen hochgeladen.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{d.documents?.file_name ?? "–"}</p>
                  <p className="text-xs text-gray-400">{DOC_TYPE_LABELS[d.doc_type]}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => extract(d.id)} disabled={extractingId === d.id}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-400 disabled:opacity-50"
                  >
                    {extractingId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    KI-Vorschlag
                  </button>
                  <button onClick={() => remove(d.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {d.extraction_status === "extracted" && d.extracted_data && (
                <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-800/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                    {d.extracted_data.net_income_cents !== undefined && <span>Einkommen: {(d.extracted_data.net_income_cents / 100).toFixed(2)} €</span>}
                    {d.extracted_data.employment_type && <span>Beschäftigung: {d.extracted_data.employment_type}</span>}
                    {d.extracted_data.household_size !== undefined && <span>HH-Größe: {d.extracted_data.household_size}</span>}
                    {d.extracted_data.schufa_classification && <span>SCHUFA: {d.extracted_data.schufa_classification}</span>}
                  </div>
                  <button
                    onClick={() => onApply(d.extracted_data!)}
                    className="text-xs px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                  >
                    Übernehmen
                  </button>
                </div>
              )}
              {d.extraction_status === "failed" && <p className="mt-2 text-xs text-red-500">KI-Erkennung fehlgeschlagen.</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
