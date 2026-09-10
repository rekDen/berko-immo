"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Upload, FileText, X, Loader2, CheckCircle2,
  AlertCircle, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PropertyTabBar from "@/components/dms/PropertyTabBar";

type Category = {
  id: string;
  code: string;
  group_code: string;
  name_de: string;
  level: string;
};

type Property = {
  id: string;
  name: string;
};

type FileEntry = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

const MAX_FILES = 100;
const MAX_SIZE = 50 * 1024 * 1024;

export default function BulkUploadPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [uploading, setUploading] = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [propRes, catRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/document-categories`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function addFiles(incoming: File[]) {
    const valid = incoming
      .filter((f) => f.size <= MAX_SIZE)
      .slice(0, MAX_FILES - files.length);
    setFiles((prev) => [
      ...prev,
      ...valid.map((file) => ({ file, status: "pending" as const })),
    ]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
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
  }

  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const allDone = files.length > 0 && files.every((f) => f.status === "done" || f.status === "error");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar
        propertyId={propertyId}
        propertyName={property?.name ?? "Laden…"}
      />

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
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
          <span className="text-gray-600 dark:text-gray-300">Upload</span>
        </nav>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Dokumente hochladen
        </h2>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed transition-colors cursor-pointer
            ${
              dragOver
                ? "border-orange-500 bg-orange-50 dark:bg-orange-500/5"
                : "border-gray-300 bg-white hover:border-gray-400 dark:bg-gray-900 dark:border-gray-700 dark:hover:border-gray-600"
            }`}
          onClick={() =>
            document.getElementById("file-input")?.click()
          }
        >
          <Upload
            className={`w-8 h-8 ${
              dragOver
                ? "text-orange-500"
                : "text-gray-400 dark:text-gray-500"
            }`}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dateien hierher ziehen oder klicken
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Max. {MAX_FILES} Dateien, je max. 50 MB
          </p>
          <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Kategorie *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={uploading}
              className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2.5
                dark:bg-gray-900 dark:border-gray-800 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50"
            >
              <option value="">Kategorie wählen…</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.group_code.replace(/_/g, " ")} &raquo; {cat.name_de}
                </option>
              ))}
            </select>
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
              className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2.5
                dark:bg-gray-900 dark:border-gray-800 dark:text-white
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50"
            />
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {files.length} Datei{files.length !== 1 ? "en" : ""}
              </span>
              {allDone && (
                <span className="text-xs text-gray-400">
                  {doneCount} erfolgreich
                  {errorCount > 0 ? `, ${errorCount} fehlgeschlagen` : ""}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50 max-h-80 overflow-y-auto">
              {files.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  {entry.status === "pending" && (
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  {entry.status === "uploading" && (
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />
                  )}
                  {entry.status === "done" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                  {entry.status === "error" && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {entry.file.name}
                    </p>
                    {entry.error && (
                      <p className="text-xs text-red-500">{entry.error}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {(entry.file.size / 1024).toFixed(0)} KB
                  </span>
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
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {allDone ? (
            <button
              onClick={() =>
                router.push(`/objekte/${propertyId}/dokumente`)
              }
              className="px-6 py-3 rounded-xl text-sm font-medium transition-colors
                bg-orange-500 text-white hover:bg-orange-600"
            >
              Zur Übersicht
            </button>
          ) : (
            <button
              onClick={handleUpload}
              disabled={uploading || !categoryId || files.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors
                bg-orange-500 text-white hover:bg-orange-600
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? "Wird hochgeladen…" : "Hochladen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
