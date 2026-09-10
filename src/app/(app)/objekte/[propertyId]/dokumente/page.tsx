"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Search, Loader2, FileText, Download, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PropertyTabBar from "@/components/dms/PropertyTabBar";
import PropertyDocumentsUploader from "@/components/dms/PropertyDocumentsUploader";
import DocumentPreviewModal from "@/components/dms/DocumentPreviewModal";

type Property = {
  id: string;
  name: string;
};

type Marker = {
  id: string;
  name: string;
  color: string | null;
};

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string;
  fiscal_year: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  marker_details: Marker[];
  document_categories: {
    id: string;
    name_de: string;
    group_code: string;
  } | null;
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentOverviewPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [propRes, docsRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/documents?property_id=${propertyId}&limit=500`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (docsRes.ok) setDocuments(await docsRes.json());
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDownload(doc: DocumentRow) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) {
      alert("Download fehlgeschlagen");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(doc: DocumentRow) {
    if (!confirm(`„${doc.title}" wirklich löschen?`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) loadData();
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? documents.filter((d) =>
        [d.title, d.file_name, d.document_categories?.name_de, d.uploaded_by_name]
          .some((f) => f?.toLowerCase().includes(q))
      )
    : documents;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar
        propertyId={propertyId}
        propertyName={property?.name ?? "Laden…"}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Dokumente durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-gray-200 bg-white
              dark:bg-gray-900 dark:border-gray-800 dark:text-white
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        {/* Drag & Drop Upload */}
        <PropertyDocumentsUploader
          propertyId={propertyId}
          onUploaded={loadData}
        />

        {/* Tabelle */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <FileText className="w-12 h-12 mb-3" />
            <p className="text-sm">
              {q ? `Keine Treffer für „${search}"` : "Noch keine Dokumente hinterlegt"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Titel</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Kategorie</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Größe</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Erstellungsdatum</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Ersteller</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden xl:table-cell">Marker</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 group"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setPreviewDocId(doc.id)}
                        className="flex items-center gap-2 text-left text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 font-medium"
                      >
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </button>
                      {doc.fiscal_year && (
                        <span className="text-xs text-gray-400 ml-6">WJ {doc.fiscal_year}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {doc.document_categories?.name_de ?? "–"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {new Date(doc.uploaded_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {doc.uploaded_by_name ?? "–"}
                    </td>
                    <td className="px-4 py-2.5 hidden xl:table-cell">
                      {doc.marker_details.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {doc.marker_details.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: m.color ? `${m.color}20` : "#e5e7eb",
                                color: m.color ?? "#6b7280",
                              }}
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">–</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                          title="Herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewDocId && (
        <DocumentPreviewModal
          documentId={previewDocId}
          onClose={() => setPreviewDocId(null)}
        />
      )}
    </div>
  );
}
