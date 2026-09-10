"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Download, FileText, Image, File } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Document = {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string;
  uploaded_at: string;
  fiscal_year: number | null;
  markers: string[];
  document_categories: {
    name_de: string;
    group_code: string;
  } | null;
};

type Props = {
  documentId: string;
  onClose: () => void;
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentPreviewModal({ documentId, onClose }: Props) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/documents/${documentId}`);
    if (res.ok) {
      const data = await res.json();
      setDoc(data);

      const supabase = createClient();
      const { data: urlData } = await supabase.storage
        .from("documents")
        .createSignedUrl(data.storage_path, 300);
      if (urlData?.signedUrl) setPreviewUrl(urlData.signedUrl);
    }
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleDownload() {
    if (!doc || !previewUrl) return;
    await fetch(`/api/documents/${documentId}`, {
      method: "GET",
      headers: { "x-action": "download" },
    });
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = doc.file_name;
    a.click();
  }

  const isPdf = doc?.mime_type === "application/pdf";
  const isImage = doc?.mime_type?.startsWith("image/");

  const categoryPath = doc?.document_categories
    ? `${doc.document_categories.group_code.replace(/_/g, " ")} » ${doc.document_categories.name_de}`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] mx-4 flex rounded-2xl overflow-hidden
          bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4
          bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate pr-4">
            {doc?.title ?? "Laden…"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
              dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 pt-16">
          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 overflow-auto">
            {loading ? (
              <div className="w-16 h-16 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
            ) : isPdf && previewUrl ? (
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-lg border border-gray-200 dark:border-gray-800"
                title={doc?.title}
              />
            ) : isImage && previewUrl ? (
              <img
                src={previewUrl}
                alt={doc?.title}
                className="max-w-full max-h-full object-contain rounded-lg"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
                <File className="w-12 h-12" />
                <p className="text-sm">Keine Vorschau verfügbar</p>
                <p className="text-xs">{doc?.file_name}</p>
              </div>
            )}
          </div>

          {/* Properties panel */}
          <div className="w-80 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 p-6 overflow-y-auto">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : doc ? (
              <div className="space-y-5">
                <PropertyRow label="Titel" value={doc.title} />
                <PropertyRow label="Kategorie" value={categoryPath} />
                <PropertyRow label="Größe" value={formatSize(doc.file_size)} />
                <PropertyRow label="Dateiname" value={doc.file_name} />
                <PropertyRow
                  label="Hinzugefügt"
                  value={new Date(doc.uploaded_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                />
                {doc.fiscal_year && (
                  <PropertyRow label="Wirtschaftsjahr" value={String(doc.fiscal_year)} />
                )}
                {doc.description && (
                  <PropertyRow label="Beschreibung" value={doc.description} />
                )}

                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 w-full mt-6 px-4 py-3 rounded-xl
                    text-sm font-medium border-2 transition-colors
                    border-orange-500 text-orange-600 hover:bg-orange-50
                    dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-500/10"
                >
                  <Download className="w-4 h-4" />
                  Herunterladen
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-800 dark:text-gray-200 break-words">
        {value}
      </dd>
    </div>
  );
}
