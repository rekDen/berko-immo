"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Download, Eye, Trash2, FileText,
  Loader2, ArrowUpDown, Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PropertyTabBar from "@/components/dms/PropertyTabBar";
import DocumentPreviewModal from "@/components/dms/DocumentPreviewModal";

type Document = {
  id: string;
  title: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string;
  uploaded_at: string;
  fiscal_year: number | null;
  markers: string[];
  document_categories: {
    id: string;
    code: string;
    group_code: string;
    name_de: string;
    level: string;
  } | null;
};

type Property = {
  id: string;
  name: string;
};

type SortKey = "newest" | "oldest" | "az";

function formatSize(bytes: number | null): string {
  if (!bytes) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentListPage() {
  const { propertyId, categoryId } = useParams<{
    propertyId: string;
    categoryId: string;
  }>();

  const [property, setProperty] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const [fiscalYear, setFiscalYear] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const categoryName =
    documents[0]?.document_categories?.name_de ?? "Dokumente";
  const groupCode =
    documents[0]?.document_categories?.group_code ?? "";

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      property_id: propertyId,
      category_id: categoryId,
    });
    if (fiscalYear) params.set("fiscal_year", fiscalYear);

    const [propRes, docRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/documents?${params}`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (docRes.ok) setDocuments(await docRes.json());
    setLoading(false);
  }, [propertyId, categoryId, fiscalYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete(docId: string) {
    if (!confirm("Dokument wirklich löschen?")) return;
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (res.ok) setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  async function handleDownload(doc: Document) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name;
      a.click();
    }
  }

  const sorted = [...documents].sort((a, b) => {
    if (sortKey === "oldest")
      return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
    if (sortKey === "az") return a.title.localeCompare(b.title, "de");
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });

  const fiscalYears = [
    ...new Set(documents.map((d) => d.fiscal_year).filter(Boolean)),
  ].sort((a, b) => (b as number) - (a as number));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar
        propertyId={propertyId}
        propertyName={property?.name ?? "Laden…"}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Link
            href="/objekte"
            className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Objekte
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link
            href={`/objekte/${propertyId}/dokumente`}
            className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {property?.name ?? "…"}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 dark:text-gray-300">{categoryName}</span>
        </nav>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {fiscalYears.length > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 bg-white px-3 py-2
                  dark:bg-gray-900 dark:border-gray-800 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                <option value="">Alle Jahre</option>
                {fiscalYears.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-sm rounded-lg border border-gray-200 bg-white px-3 py-2
                dark:bg-gray-900 dark:border-gray-800 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="newest">Neueste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
              <option value="az">A–Z</option>
            </select>
          </div>
        </div>

        {/* Document list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <FileText className="w-12 h-12 mb-3" />
            <p className="text-sm">Keine Dokumente in dieser Kategorie</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Titel
                  </th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 hidden sm:table-cell">
                    Größe
                  </th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 hidden md:table-cell">
                    Hinzugefügt
                  </th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 hidden lg:table-cell">
                    Marker
                  </th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30
                      cursor-pointer transition-colors"
                    onClick={() => setPreviewDocId(doc.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                            {doc.title}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {doc.file_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {new Date(doc.uploaded_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {doc.markers?.map((m) => (
                          <span
                            key={m}
                            className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600
                              dark:bg-orange-500/15 dark:text-orange-400"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-1 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setPreviewDocId(doc.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                            dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                          title="Vorschau"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                            dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                          title="Herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                            dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
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
