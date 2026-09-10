"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Trash2, Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  code: string;
  group_code: string;
  name_de: string;
  level: string;
};

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string;
  uploaded_at: string;
  document_categories?: { name_de: string };
};

type FileEntry = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

const MAX_SIZE = 50 * 1024 * 1024;

type Props = {
  contractId: string;
};

export default function ContractDocuments({ contractId }: Props) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [docsRes, catRes] = await Promise.all([
      fetch(`/api/documents?contract_id=${contractId}&level=contract`),
      fetch("/api/document-categories"),
    ]);
    if (docsRes.ok) setDocuments(await docsRes.json());
    if (catRes.ok) {
      const all: Category[] = await catRes.json();
      const contractCats = all.filter((c) => c.level === "contract" && c.code.includes("."));
      setCategories(contractCats);
      // Default-Kategorie: VERTRAG_KORRESPONDENZ.ALLGEMEIN, falls vorhanden
      const fallback =
        contractCats.find((c) => c.code === "VERTRAG_KORRESPONDENZ.ALLGEMEIN") ??
        contractCats[0];
      if (fallback) setCategoryId(fallback.id);
    }
    setLoading(false);
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  function addFiles(incoming: File[]) {
    const valid = incoming.filter((f) => f.size <= MAX_SIZE);
    setFiles((prev) => [...prev, ...valid.map((file) => ({ file, status: "pending" as const }))]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  async function handleUpload() {
    if (!categoryId || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status !== "pending") continue;

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f))
      );

      const ext = entry.file.name.split(".").pop() ?? "bin";
      const storagePath = `contracts/${contractId}/${categoryId}/${crypto.randomUUID()}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, entry.file, { contentType: entry.file.type });

      if (storageErr) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: storageErr.message } : f
          )
        );
        continue;
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: categoryId,
          level: "contract",
          contract_id: contractId,
          title: entry.file.name.replace(/\.[^.]+$/, ""),
          storage_path: storagePath,
          file_name: entry.file.name,
          file_size: entry.file.size,
          mime_type: entry.file.type || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload fehlgeschlagen" }));
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: err.error } : f
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "done" } : f))
        );
      }
    }

    setUploading(false);
    // Erfolgreich hochgeladene Einträge nach 1.5s aus der Liste nehmen + Liste neu laden
    setTimeout(() => {
      setFiles((prev) => prev.filter((f) => f.status !== "done"));
      load();
    }, 1500);
  }

  async function handleDelete(doc: DocumentRow) {
    if (!confirm(`„${doc.title}" wirklich löschen?`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) load();
  }

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

  function formatSize(bytes: number | null): string {
    if (bytes == null) return "–";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Dokumente ({documents.length})
        </h3>
      </div>

      {/* Drop-Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById(`contract-file-input-${contractId}`)?.click()}
        className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer mb-4
          ${dragOver
            ? "border-orange-500 bg-orange-50 dark:bg-orange-500/5"
            : "border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600"}`}
      >
        <Upload className={`w-6 h-6 ${dragOver ? "text-orange-500" : "text-gray-400"}`} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Dateien hierher ziehen oder klicken
        </p>
        <p className="text-xs text-gray-400">Max. 50 MB pro Datei</p>
        <input
          id={`contract-file-input-${contractId}`}
          type="file"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Kategorie für neue Dateien
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={uploading}
              className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.group_code.replace(/_/g, " ")} » {cat.name_de}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50 max-h-60 overflow-y-auto">
              {files.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {entry.status === "pending" && <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  {entry.status === "uploading" && <Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />}
                  {entry.status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  {entry.status === "error" && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-700 dark:text-gray-300 truncate">{entry.file.name}</p>
                    {entry.error && <p className="text-xs text-red-500">{entry.error}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(entry.file.size)}</span>
                  {entry.status === "pending" && !uploading && (
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !categoryId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? "Wird hochgeladen…" : "Hochladen"}
          </button>
        </>
      )}

      {/* Liste der vorhandenen Dokumente */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : documents.length === 0 && files.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Noch keine Dokumente</p>
      ) : documents.length > 0 ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 mt-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-2.5 group">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {doc.title}
                </p>
                <p className="text-xs text-gray-400">
                  {doc.document_categories?.name_de ?? "—"}
                  <span className="mx-1">·</span>
                  {formatSize(doc.file_size)}
                  <span className="mx-1">·</span>
                  {new Date(doc.uploaded_at).toLocaleDateString("de-DE")}
                </p>
              </div>
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
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
