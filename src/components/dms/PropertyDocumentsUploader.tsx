"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Combobox from "@/components/Combobox";

type Category = {
  id: string;
  code: string;
  group_code: string;
  name_de: string;
  level: string;
};

type FileEntry = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

const MAX_SIZE = 50 * 1024 * 1024;

type Props = {
  propertyId: string;
  onUploaded?: () => void;
};

export default function PropertyDocumentsUploader({ propertyId, onUploaded }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pageDragActive, setPageDragActive] = useState(false);

  useEffect(() => {
    fetch("/api/document-categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Category[]) => {
        const propertyCats = all.filter((c) => c.level === "property" && c.code.includes("."));
        setCategories(propertyCats);
        const fallback =
          propertyCats.find((c) => c.code === "OBJEKTVERWALTUNG.BANK") ?? propertyCats[0];
        if (fallback) setCategoryId(fallback.id);
      });
  }, []);

  // Page-weite Drag-Erkennung — egal wo der User ablegt, die Datei landet hier
  useEffect(() => {
    let dragCounter = 0;

    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragCounter++;
      setPageDragActive(true);
    }
    function onDragLeave() {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setPageDragActive(false);
    }
    function onDragOver(e: DragEvent) {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      dragCounter = 0;
      setPageDragActive(false);
      const dropped = Array.from(e.dataTransfer.files);
      addFiles(dropped);
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) => f.size <= MAX_SIZE);
    setFiles((prev) => [...prev, ...valid.map((file) => ({ file, status: "pending" as const }))]);
  }, []);

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  function openFilePicker() {
    document.getElementById(`property-file-input-${propertyId}`)?.click();
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
      const storagePath = `${propertyId}/property/${categoryId}/${crypto.randomUUID()}.${ext}`;

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
          level: "property",
          property_id: propertyId,
          title: entry.file.name.replace(/\.[^.]+$/, ""),
          storage_path: storagePath,
          file_name: entry.file.name,
          file_size: entry.file.size,
          mime_type: entry.file.type || null,
          fiscal_year: fiscalYear ? parseInt(fiscalYear) : null,
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
    setTimeout(() => {
      setFiles((prev) => prev.filter((f) => f.status !== "done"));
      onUploaded?.();
    }, 1500);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-3">
      {/* Drop-Zone (immer sichtbar, eingeklappt wenn keine Dateien) */}
      <button
        type="button"
        onClick={openFilePicker}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-all cursor-pointer
          ${dragOver || pageDragActive
            ? "border-orange-500 bg-orange-50 dark:bg-orange-500/5 py-8"
            : "border-gray-300 hover:border-gray-400 bg-white dark:bg-gray-900 dark:border-gray-700 dark:hover:border-gray-600"}`}
      >
        <Upload className={`w-5 h-5 flex-shrink-0 ${dragOver || pageDragActive ? "text-orange-500" : "text-gray-400"}`} />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {pageDragActive
            ? "Dateien hier ablegen"
            : "Klicken zum Auswählen oder Dateien hierher ziehen — max. 50 MB pro Datei"}
        </span>
      </button>
      <input
        id={`property-file-input-${propertyId}`}
        type="file"
        multiple
        className="hidden"
        onChange={onFileInput}
      />

      {files.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Kategorie *
              </label>
              <Combobox
                value={categoryId}
                onChange={setCategoryId}
                options={categories.map((cat) => ({
                  value: cat.id,
                  label: `${cat.group_code.replace(/_/g, " ")} » ${cat.name_de}`,
                }))}
                placeholder="Kategorie suchen…"
                disabled={uploading}
                allowClear={false}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Wirtschaftsjahr
              </label>
              <input
                type="number"
                placeholder={`z.B. ${new Date().getFullYear()}`}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                disabled={uploading}
                className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-60 overflow-y-auto">
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
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

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {files.filter((f) => f.status === "pending").length} ausstehend
            </span>
            <button
              onClick={handleUpload}
              disabled={uploading || !categoryId || files.every((f) => f.status !== "pending")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? "Wird hochgeladen…" : "Hochladen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
