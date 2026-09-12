"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, FileDown, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cardCls } from "./shared";

type SettlementDocument = {
  id: string;
  level: "property" | "unit";
  title: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  uploaded_at: string;
  document_categories: { name_de: string } | null;
};

export function DocumentsPanel({
  settlementId, canGenerate, onError,
}: {
  settlementId: string; canGenerate: boolean; onError: (msg: string) => void;
}) {
  const [documents, setDocuments] = useState<SettlementDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/weg-settlement/settlements/${settlementId}/documents`);
    if (res.ok) setDocuments(await res.json());
    setLoading(false);
  }, [settlementId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGenerating(true);
    const res = await fetch(`/api/weg-settlement/settlements/${settlementId}/documents`, { method: "POST" });
    if (res.ok) load(); else {
      const err = await res.json().catch(() => ({ error: "Fehler bei der PDF-Erzeugung" }));
      onError(err.error);
    }
    setGenerating(false);
  }

  async function open(doc: SettlementDocument) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Dokumente
        </h4>
        {canGenerate && (
          <button
            onClick={generate} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Dokumente erzeugen
          </button>
        )}
      </div>

      {!canGenerate && documents.length === 0 && (
        <p className="text-xs text-gray-400">Dokumente können erst ab Status „Final&rdquo; erzeugt werden — der Snapshot muss eingefroren sein.</p>
      )}

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : documents.length === 0 ? (
        canGenerate && <p className="text-sm text-gray-400">Noch keine Dokumente erzeugt.</p>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Dokument</th>
                <th className="px-4 py-2 font-medium">Kategorie</th>
                <th className="px-4 py-2 font-medium">Erzeugt</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-t border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{d.title}</td>
                  <td className="px-4 py-2 text-gray-500">{d.document_categories?.name_de ?? "–"}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{new Date(d.uploaded_at).toLocaleString("de-DE")}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => open(d)} className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                      Öffnen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
