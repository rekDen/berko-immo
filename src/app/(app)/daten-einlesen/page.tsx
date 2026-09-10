"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, Database, Cloud, RefreshCw, Trash2, Plus, AlertCircle,
  CheckCircle, Clock, Loader, XCircle, RotateCcw, HardDrive,
  FolderOpen, Search, ChevronDown, ChevronUp, X, Sparkles,
  Mail, Building2, Users, FileSignature, ClipboardList, CalendarClock,
  TrendingUp, Files, ExternalLink, ScanText,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type SourceType = "upload" | "supabase_storage" | "supabase_table" | "gdrive" | "dropbox" | "webdav" | "imap";
type DocStatus = "pending" | "extracting" | "chunking" | "embedding" | "indexed" | "failed" | "unsupported";

interface IngestionSource {
  id: string;
  source_type: SourceType;
  name: string;
  config: Record<string, unknown>;
  status: "active" | "paused" | "error";
  last_synced_at: string | null;
  sync_interval_minutes: number;
  ingest_documents: { count: number }[];
}

interface IngestDoc {
  id: string;
  title: string | null;
  source_type: SourceType;
  status: DocStatus;
  error_message: string | null;
  created_at: string;
  mime_type: string | null;
  ingestion_sources: { name: string; source_type: SourceType } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<SourceType, string> = {
  upload: "Datei-Upload",
  supabase_storage: "Supabase Storage",
  supabase_table: "Supabase-Tabelle",
  gdrive: "Google Drive",
  dropbox: "Dropbox",
  webdav: "WebDAV / NAS",
  imap: "E-Mail (IMAP)",
};

const SOURCE_ICONS: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  supabase_storage: Database,
  supabase_table: Database,
  gdrive: Cloud,
  dropbox: Cloud,
  webdav: HardDrive,
  imap: Cloud,
};

const STATUS_COLOR: Record<DocStatus, string> = {
  pending:     "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  extracting:  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  chunking:    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  embedding:   "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  indexed:     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failed:      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  unsupported: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const STATUS_LABELS: Record<DocStatus, string> = {
  pending:     "Ausstehend",
  extracting:  "Extrahiere",
  chunking:    "Chunking",
  embedding:   "Embedding",
  indexed:     "Indexiert",
  failed:      "Fehler",
  unsupported: "Nicht unterstützt",
};

const STATUS_ICON: Record<DocStatus, React.ComponentType<{ className?: string }>> = {
  pending:     Clock,
  extracting:  Loader,
  chunking:    Loader,
  embedding:   Loader,
  indexed:     CheckCircle,
  failed:      XCircle,
  unsupported: AlertCircle,
};

function fmt(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(date));
}

// ─── Supabase-DB-Panel (fest in Quellen-Tab) ────────────────────────────────

interface DbTable {
  table_name: string;
  text_columns: string[];
  row_estimate: number;
  indexed_count: number;
  source_id: string | null;
  last_indexed_at: string | null;
}

interface IndexProgress {
  done: number;
  total: number;
  table: string | null;
  chunks: number;
  error: string | null;
}

function SupabaseDbPanel() {
  const [tables, setTables]     = useState<DbTable[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/ingestion/db-tables");
    if (res.ok) setTables(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleIndexAll() {
    setSyncing(true);
    setProgress({ done: 0, total: 0, table: null, chunks: 0, error: null });
    let totalChunks = 0;
    try {
      const res = await fetch("/api/ingestion/index-tables", { method: "POST" });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // NDJSON-Stream lesen: eine JSON-Zeile pro Ereignis
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";       // letzte (evtl. unvollständige) Zeile behalten

        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "start") {
            setProgress({ done: 0, total: ev.total, table: null, chunks: 0, error: null });
          } else if (ev.type === "table") {
            totalChunks += ev.chunks ?? 0;
            setProgress({ done: ev.done, total: ev.total, table: ev.table, chunks: totalChunks, error: null });
          } else if (ev.type === "done") {
            setProgress((p) => p ? { ...p, done: p.total, table: null, chunks: ev.totalChunks ?? totalChunks } : p);
          } else if (ev.type === "error") {
            setProgress((p) => ({ done: p?.done ?? 0, total: p?.total ?? 0, table: null, chunks: totalChunks, error: ev.error }));
          }
        }
      }
    } catch (e) {
      setProgress((p) => ({
        done: p?.done ?? 0, total: p?.total ?? 0, table: null, chunks: totalChunks,
        error: e instanceof Error ? e.message : "Indexierung fehlgeschlagen",
      }));
    } finally {
      setSyncing(false);
      load();
      // Fortschritt kurz stehen lassen, dann ausblenden (Fehler bleibt sichtbar)
      setTimeout(() => setProgress((p) => (p?.error ? p : null)), 4000);
    }
  }

  const indexedCount = tables.filter((t) => t.indexed_count > 0).length;
  const totalCount   = tables.length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <Database className="w-5 h-5 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Supabase-Datenbank</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {loading ? "Lade Tabellen…" : `${indexedCount} / ${totalCount} Tabellen indexiert`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            Integriert
          </span>
          <button
            onClick={handleIndexAll}
            disabled={syncing || loading}
            title="Alle Tabellen (neu) indexieren"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {syncing
              ? <Loader className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Indexieren
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Fortschritt beim Indexieren */}
      {progress && (
        <div className="px-4 pb-4 -mt-1">
          {progress.error ? (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400
              bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Indexierung fehlgeschlagen: {progress.error}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span className="truncate">
                  {syncing
                    ? progress.table
                      ? `Indexiere: ${progress.table}`
                      : "Starte Indexierung…"
                    : "Fertig"}
                </span>
                <span className="flex-shrink-0 tabular-nums">
                  {progress.total > 0 ? `${progress.done} / ${progress.total} Tabellen` : "…"}
                  {progress.chunks > 0 && ` · ${progress.chunks} Chunks`}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : (syncing ? 5 : 100)}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabellen-Grid */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader className="w-3.5 h-3.5 animate-spin" /> Lade…
            </div>
          ) : tables.length === 0 ? (
            <p className="text-xs text-gray-400">Keine indexierbaren Tabellen gefunden.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tables.map((t) => {
                const isIndexed = t.indexed_count > 0;
                return (
                  <div
                    key={t.table_name}
                    title={`Spalten: ${t.text_columns.join(", ")}\nca. ${t.row_estimate} Zeilen`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                      isIndexed
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {isIndexed
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      : <Database className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    }
                    <span className={`font-medium truncate ${
                      isIndexed ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
                    }`}>
                      {t.table_name}
                    </span>
                    {t.row_estimate > 0 && (
                      <span className="ml-auto text-gray-400 flex-shrink-0">
                        ~{t.row_estimate > 999 ? `${(t.row_estimate / 1000).toFixed(0)}k` : t.row_estimate}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Ältere SourceTableList bleibt als Fallback für manuelle Quellen
function SourceTableList({ sourceId, synced }: { sourceId: string; synced: boolean }) {
  const [tables, setTbls] = useState<{ name: string; total: number; indexed: number; failed: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ingestion/sources/${sourceId}/tables`)
      .then((r) => r.json())
      .then((d) => setTbls(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [sourceId]);

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
      <Loader className="w-3.5 h-3.5 animate-spin" /> Lade Tabellen…
    </div>
  );

  if (!synced || tables.length === 0) return (
    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
      {synced ? "Noch keine Tabellen indexiert." : "Noch nicht synchronisiert."}
    </div>
  );

  return (
    <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap gap-2">
        {tables.map((t) => {
          const label = t.name.includes(".") ? t.name.split(".").pop()! : t.name;
          const allIndexed = t.indexed === t.total;
          const hasFailed  = t.failed > 0;
          return (
            <div
              key={t.name}
              title={`${t.indexed}/${t.total} indexiert`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                hasFailed
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                  : allIndexed
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              <Database className="w-3 h-3 flex-shrink-0" />
              {label}
              <span className={`ml-0.5 opacity-70`}>
                {t.indexed}/{t.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add Source Dialog ────────────────────────────────────────────────────────

function AddSourceDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [step, setStep] = useState<"type" | "config">("type");
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const TYPE_OPTIONS: { type: SourceType; label: string; desc: string }[] = [
    { type: "supabase_storage", label: "Supabase Storage", desc: "Bucket oder Ordner indexieren" },
    { type: "gdrive",           label: "Google Drive",     desc: "OAuth2 — Ordner auswählen" },
    { type: "dropbox",          label: "Dropbox",          desc: "OAuth2 — Ordner auswählen" },
    { type: "webdav",           label: "WebDAV / NAS",     desc: "Host, Pfad und Credentials" },
    { type: "supabase_table",   label: "Supabase DB (alle Tabellen)", desc: "Alle Tabellen automatisch indexieren" },
  ];

  const CONFIG_FIELDS: Record<SourceType, { key: string; label: string; placeholder?: string; type?: string }[]> = {
    supabase_storage: [
      { key: "bucket", label: "Bucket-Name", placeholder: "documents" },
      { key: "folder", label: "Ordner (optional)", placeholder: "berichte/2024" },
    ],
    gdrive: [
      { key: "folder_id", label: "Drive-Ordner-ID", placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" },
      { key: "access_token", label: "Access Token (temporär)", type: "password" },
    ],
    dropbox: [
      { key: "folder_path", label: "Dropbox-Pfad", placeholder: "/Dokumente/Berichte" },
      { key: "access_token", label: "Access Token", type: "password" },
    ],
    webdav: [
      { key: "host", label: "Host (URL)", placeholder: "https://nas.firma.de" },
      { key: "path", label: "Pfad", placeholder: "/dokumente" },
      { key: "username", label: "Benutzername" },
      { key: "password", label: "Passwort", type: "password" },
    ],
    supabase_table: [
      { key: "exclude", label: "Tabellen ausschließen (kommasep., optional)", placeholder: "emails,logs,events" },
    ],
    upload:  [],
    imap:    [],
  };

  async function handleSave() {
    if (!sourceType || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      // supabase_table: exclude-Feld als Array serialisieren
      const serializedConfig: Record<string, unknown> = { ...config };
      if (sourceType === "supabase_table" && typeof config.exclude === "string") {
        serializedConfig.exclude = config.exclude
          .split(",").map((s) => s.trim()).filter(Boolean);
      }

      const res = await fetch("/api/ingestion/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_type: sourceType, name: name.trim(), config: serializedConfig }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Neue Quelle hinzufügen</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === "type" ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">Welche Art von Quelle soll indexiert werden?</p>
              <div className="grid grid-cols-1 gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = SOURCE_ICONS[opt.type];
                  return (
                    <button
                      key={opt.type}
                      onClick={() => { setSourceType(opt.type); setStep("config"); }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700
                        hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors"
                    >
                      <Icon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`z.B. „${sourceType ? SOURCE_LABELS[sourceType] : ''} — Berichte"`}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {sourceType && CONFIG_FIELDS[sourceType].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                  <input
                    type={field.type ?? "text"}
                    value={config[field.key] ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {step === "config" && (
          <div className="flex items-center gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setStep("type")}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Zurück
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Quelle speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

// Phasen-Modell für die Upload-Fortschrittsanzeige
type UpStage = "upload" | "text" | "ingest";
type UpStatus = "running" | "done" | "error";
interface UpFile {
  name: string;
  sizeMB: number;
  stage: UpStage;
  status: UpStatus;
  isOcr: boolean;
  skipped?: boolean;
  error?: string;
  stageStartedAt: number;
}

const UP_STEPS: { key: UpStage; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "upload", Icon: Upload },
  { key: "text",   Icon: ScanText },
  { key: "ingest", Icon: Database },
];
const UP_ORDER: UpStage[] = ["upload", "text", "ingest"];
const UP_WEIGHT: Record<UpStage, number> = { upload: 0.15, text: 0.65, ingest: 0.2 };

function stepLabel(key: UpStage, isOcr: boolean): string {
  if (key === "upload") return "Upload";
  if (key === "text")   return isOcr ? "OCR-Texterkennung" : "Texterkennung";
  return "Ingestion";
}

// Geschätzte Sekunden je Phase (OCR skaliert mit Dateigröße)
function stageEstimates(u: UpFile): Record<UpStage, number> {
  return {
    upload: Math.max(1, u.sizeMB * 0.5),
    text:   u.isOcr ? Math.max(5, u.sizeMB * 6) : 2,
    ingest: 3,
  };
}

function upProgress(u: UpFile, now: number): { pct: number; eta: number } {
  if (u.status === "done")  return { pct: 1, eta: 0 };
  if (u.status === "error") return { pct: 0, eta: 0 };
  const est = stageEstimates(u);
  const idx = UP_ORDER.indexOf(u.stage);
  let base = 0;
  for (let i = 0; i < idx; i++) base += UP_WEIGHT[UP_ORDER[i]];
  const stageEl = Math.max(0, (now - u.stageStartedAt) / 1000);
  const within  = Math.min(0.95, stageEl / est[u.stage]);
  const pct = Math.min(0.98, base + UP_WEIGHT[u.stage] * within);
  let eta = Math.max(0, est[u.stage] - stageEl);
  for (let i = idx + 1; i < UP_ORDER.length; i++) eta += est[UP_ORDER[i]];
  return { pct, eta: Math.ceil(eta) };
}

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UpFile[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Ticker für Restzeit/Balken, solange etwas läuft
  useEffect(() => {
    if (!uploads.some((u) => u.status === "running")) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [uploads]);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const t0 = Date.now();
    setUploads(arr.map((f) => ({
      name: f.name,
      sizeMB: f.size / (1024 * 1024),
      stage: "upload",
      status: "running",
      isOcr: false,
      stageStartedAt: t0,
    })));

    const update = (i: number, patch: Partial<UpFile>) =>
      setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, ...patch } : u)));

    await Promise.all(arr.map(async (file, i) => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/ingestion/upload", { method: "POST", body: fd });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.type === "phase") {
              if (ev.phase === "extract")     update(i, { stage: "text", isOcr: false, stageStartedAt: Date.now() });
              else if (ev.phase === "ocr")    update(i, { stage: "text", isOcr: true,  stageStartedAt: Date.now() });
              else if (ev.phase === "ingest") update(i, { stage: "ingest", stageStartedAt: Date.now() });
            } else if (ev.type === "done") {
              if (ev.status === "failed") update(i, { status: "error", error: ev.error ?? "Verarbeitung fehlgeschlagen" });
              else update(i, { status: "done", skipped: ev.status === "skipped" });
            } else if (ev.type === "error") {
              update(i, { status: "error", error: ev.error ?? "Fehler" });
            }
          }
        }
      } catch (e) {
        update(i, { status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }));

    onUploaded();
    // Erfolgreiche Einträge nach 4 s ausblenden, Fehler sichtbar lassen
    setTimeout(() => setUploads((prev) => prev.filter((u) => u.status === "error")), 4000);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed
          cursor-pointer transition-colors
          ${dragging
            ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          }`}
      >
        <Upload className="w-8 h-8 text-gray-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Dateien hierher ziehen oder klicken
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            PDF, DOCX, XLSX, TXT, MD, HTML, EML — max. 50 MB pro Datei
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.txt,.md,.html,.eml"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-3">
          {uploads.map((u, i) => {
            const { pct, eta } = upProgress(u, now);
            const curIdx = UP_ORDER.indexOf(u.stage);
            return (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
                {/* Kopf: Name + Status/Restzeit */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">{u.name}</span>
                  <span className="text-xs flex-shrink-0">
                    {u.status === "done" ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {u.skipped ? "Bereits indexiert" : "Abgeschlossen"}
                      </span>
                    ) : u.status === "error" ? (
                      <span className="text-red-500 font-medium">Fehler</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                        {eta > 0 ? `noch ca. ${eta}s` : "fast fertig …"}
                      </span>
                    )}
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                {u.status !== "error" && (
                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out ${
                        u.status === "done"
                          ? "bg-green-500"
                          : "bg-gradient-to-r from-indigo-500 to-violet-500"
                      }`}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                )}

                {/* Phasen-Stepper */}
                <div className="flex items-center">
                  {UP_STEPS.map((s, si) => {
                    const state =
                      u.status === "done" ? "done"
                      : u.status === "error"
                        ? (si < curIdx ? "done" : si === curIdx ? "error" : "pending")
                        : (si < curIdx ? "done" : si === curIdx ? "active" : "pending");
                    const Icon = s.Icon;
                    return (
                      <div key={s.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            state === "done"   ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                            : state === "active" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300"
                            : state === "error"  ? "bg-red-100 dark:bg-red-900/40 text-red-500"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-400"
                          }`}>
                            {state === "done" ? <CheckCircle className="w-5 h-5" />
                              : state === "error" ? <XCircle className="w-5 h-5" />
                              : state === "active" ? <Loader className="w-5 h-5 animate-spin" />
                              : <Icon className="w-4 h-4" />}
                            {state === "active" && (
                              <span className="absolute inset-0 rounded-full ring-2 ring-indigo-400 animate-ping opacity-50" />
                            )}
                          </div>
                          <span className={`text-[11px] leading-tight text-center ${
                            state === "pending" ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-300"
                          }`}>
                            {stepLabel(s.key, u.isOcr)}
                          </span>
                        </div>
                        {si < UP_STEPS.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-1 -mt-4 rounded ${
                            si < curIdx || u.status === "done"
                              ? "bg-green-400"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {u.status === "error" && u.error && (
                  <p className="mt-2 text-xs text-red-500">{u.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Such-Animation (läuft während der semantischen Suche) ─────────────────────

const SEARCH_SOURCES = [
  { key: "emails",    label: "E-Mails",             Icon: Mail,          tint: "sky" },
  { key: "objekte",   label: "Objekte",             Icon: Building2,     tint: "indigo" },
  { key: "kontakte",  label: "Kontakte",            Icon: Users,         tint: "violet" },
  { key: "vertraege", label: "Verträge",            Icon: FileSignature, tint: "amber" },
  { key: "vorgaenge", label: "Vorgänge",            Icon: ClipboardList, tint: "rose" },
  { key: "fristen",   label: "Fristen & Termine",   Icon: CalendarClock, tint: "emerald" },
  { key: "bestand",   label: "Bestandsentwicklung", Icon: TrendingUp,    tint: "cyan" },
  { key: "dokumente", label: "Alle Dokumente",      Icon: Files,         tint: "blue" },
] as const;

const TINT: Record<string, { bg: string; text: string; ring: string }> = {
  sky:     { bg: "bg-sky-100 dark:bg-sky-900/40",         text: "text-sky-600 dark:text-sky-300",         ring: "ring-sky-400" },
  indigo:  { bg: "bg-indigo-100 dark:bg-indigo-900/40",   text: "text-indigo-600 dark:text-indigo-300",   ring: "ring-indigo-400" },
  violet:  { bg: "bg-violet-100 dark:bg-violet-900/40",   text: "text-violet-600 dark:text-violet-300",   ring: "ring-violet-400" },
  amber:   { bg: "bg-amber-100 dark:bg-amber-900/40",     text: "text-amber-600 dark:text-amber-300",     ring: "ring-amber-400" },
  rose:    { bg: "bg-rose-100 dark:bg-rose-900/40",       text: "text-rose-600 dark:text-rose-300",       ring: "ring-rose-400" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-400" },
  cyan:    { bg: "bg-cyan-100 dark:bg-cyan-900/40",       text: "text-cyan-600 dark:text-cyan-300",       ring: "ring-cyan-400" },
  blue:    { bg: "bg-blue-100 dark:bg-blue-900/40",       text: "text-blue-600 dark:text-blue-300",       ring: "ring-blue-400" },
};

function SearchScanAnimation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s >= SEARCH_SOURCES.length ? s : s + 1));
    }, 550);
    return () => clearInterval(id);
  }, []);

  const total   = SEARCH_SOURCES.length;
  const pct     = Math.min(100, Math.round((step / total) * 100));
  const current = SEARCH_SOURCES[Math.min(step, total - 1)];
  const finalizing = step >= total;

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/50
      bg-gradient-to-br from-indigo-50 via-white to-violet-50
      dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/40 p-6">
      {/* Sweep-Overlay */}
      <div className="scan-sweep pointer-events-none absolute inset-0" />

      {/* Kopf */}
      <div className="relative flex items-center gap-3 mb-5">
        <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
          <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500
            flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            Akturio durchsucht deinen Wissensbestand
          </p>
          <p className="text-sm text-indigo-600 dark:text-indigo-300 flex items-center">
            {finalizing ? "Ergebnisse werden zusammengestellt" : `Durchsuche ${current.label}`}
            <span className="inline-flex gap-0.5 ml-1.5">
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </p>
        </div>
        <span className="ml-auto text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0">
          {Math.min(step, total)} / {total}
        </span>
      </div>

      {/* Gesamtfortschritt */}
      <div className="relative h-1.5 w-full rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden mb-5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Quellen-Grid */}
      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SEARCH_SOURCES.map((s, i) => {
          const t = TINT[s.tint];
          const state = i < step ? "done" : i === step ? "scan" : "pending";
          const Icon = s.Icon;
          return (
            <div
              key={s.key}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-300
                ${state === "scan"
                  ? `${t.bg} border-transparent ring-2 ${t.ring} scale-[1.03] shadow-md`
                  : state === "done"
                    ? "bg-white/70 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700"
                    : "bg-white/40 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-50"}`}
            >
              <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center ${t.bg} ${t.text}`}>
                <Icon className={`w-5 h-5 ${state === "scan" ? "animate-pulse" : ""}`} />
                {state === "scan" && (
                  <span className={`absolute inset-0 rounded-xl ring-2 ${t.ring} animate-ping opacity-60`} />
                )}
                {state === "done" && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-white dark:bg-gray-900">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </span>
                )}
              </div>
              <span className={`text-xs font-medium leading-tight ${
                state === "pending" ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-200"
              }`}>
                {s.label}
              </span>
              <div className="h-4 flex items-center justify-center">
                {state === "scan" && <Loader className={`w-3.5 h-3.5 animate-spin ${t.text}`} />}
                {state === "done" && (
                  <span className="text-[10px] font-medium text-green-600 dark:text-green-400">geprüft</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "quellen" | "upload" | "dokumente";

export default function DatenEinlesenPage() {
  const [tab, setTab] = useState<Tab>("upload");
  const [sources, setSources] = useState<IngestionSource[]>([]);
  const [docs, setDocs] = useState<IngestDoc[]>([]);
  const [statusFilter, setStatusFilter] = useState<DocStatus | "">("");
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ content: string; rrf_score: number; section_title?: string; search_mode?: string; title?: string; link?: string | null; source_type?: string }[]>([]);
  const [searchMode, setSearchMode] = useState<"hybrid" | "fts" | null>(null);
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const supabase = createClient();

  const loadSources = useCallback(async () => {
    const res = await fetch("/api/ingestion/sources");
    if (res.ok) setSources(await res.json());
  }, []);

  const loadDocs = useCallback(async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/ingestion/documents?${params}`);
    if (res.ok) setDocs(await res.json());
  }, [statusFilter]);

  useEffect(() => {
    loadSources();
    loadDocs();

    // Supabase Realtime für Live-Status-Updates
    const channel = supabase
      .channel("ingest-docs")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ingest_documents" },
        () => loadDocs()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadSources, loadDocs, supabase]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function handleSync(sourceId: string) {
    await fetch(`/api/ingestion/sources/${sourceId}/sync`, { method: "POST" });
    setTimeout(loadDocs, 1000);
  }

  async function handleDeleteSource(sourceId: string) {
    if (!confirm("Quelle und alle verknüpften Dokumente löschen?")) return;
    await fetch(`/api/ingestion/sources/${sourceId}`, { method: "DELETE" });
    loadSources();
    loadDocs();
  }

  async function handleRetry(docId: string) {
    await fetch(`/api/ingestion/documents/${docId}/retry`, { method: "POST" });
    loadDocs();
  }

  async function handleSearch() {
    if (!searchQ.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSearchMode(null);
    setSearchAnswer(null);
    const started = Date.now();
    try {
      const res = await fetch(`/api/ingestion/search?q=${encodeURIComponent(searchQ)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results ?? []);
        setSearchMode(data.search_mode ?? null);
        setSearchAnswer(data.answer ?? null);
      }
    } finally {
      // Mindestlaufzeit, damit die Such-Animation die Quellen sichtbar durchläuft
      const MIN_MS = 2600;
      const elapsed = Date.now() - started;
      if (elapsed < MIN_MS) await new Promise((r) => setTimeout(r, MIN_MS - elapsed));
      setSearching(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "upload", label: "Datei-Upload" },
    { key: "quellen", label: "Quellen" },
    { key: "dokumente", label: "Dokumente" },
  ];

  const statusCounts = docs.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daten einlesen</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Dokumente, Dateien und Datenquellen für die KI-Suche indexieren
        </p>
      </div>

      {/* KI-Suche */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4" />
          Semantische Suche im Wissensindex
        </h2>
        <div className="flex gap-2">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Frage oder Stichwort eingeben …"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
              focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQ.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600
              hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Suchen
          </button>
        </div>

        {searching && <SearchScanAnimation />}

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-4">
            {/* Claude-Antwort (RAG) */}
            {searchAnswer && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                    KI-Antwort
                  </span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {searchAnswer}
                </p>
              </div>
            )}

            {/* Quellen-Chips + Treffer */}
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                searchMode === "hybrid"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}>
                {searchMode === "hybrid" ? "Semantische Suche (Vektor + FTS)" : "Volltextsuche (FTS)"}
              </span>
              <span className="text-xs text-gray-400">{searchResults.length} Quellen</span>
            </div>
            <div className="space-y-2">
              {searchResults.map((r, i) => {
                const label = r.title ?? r.section_title ?? `Quelle ${i + 1}`;
                return (
                  <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40
                        text-indigo-600 dark:text-indigo-300 text-[11px] font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {r.link ? (
                        <Link
                          href={r.link}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline
                            inline-flex items-center gap-1 min-w-0"
                        >
                          <span className="truncate">{label}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </Link>
                      ) : (
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{label}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-4">
                      {r.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {searchResults.length === 0 && searchMode !== null && !searching && (
          <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
            Keine Treffer — erst Tabellen indexieren (Quellen → Indexieren).
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t.label}
              {t.key === "dokumente" && docs.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700
                  text-gray-600 dark:text-gray-400 rounded-full">
                  {docs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Upload ── */}
          {tab === "upload" && (
            <div className="xl">
              <UploadZone onUploaded={() => { loadDocs(); setTab("dokumente"); }} />
            </div>
          )}

          {/* ── Quellen ── */}
          {tab === "quellen" && (
            <div className="space-y-4">
              {/* Supabase-Datenbank — immer sichtbar, keine manuelle Konfiguration nötig */}
              <SupabaseDbPanel />

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Weitere Quellen
                </p>
                <button
                  onClick={() => setShowAddSource(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                    text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Quelle hinzufügen
                </button>
              </div>

              {/* OAuth-Shortcuts */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => alert("Google Drive OAuth — noch nicht implementiert. Credentials in Supabase Vault hinterlegen.")}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700
                    hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Cloud className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Google Drive</p>
                    <p className="text-xs text-gray-500">OAuth verbinden</p>
                  </div>
                </button>
                <button
                  onClick={() => alert("Dropbox OAuth — noch nicht implementiert. Credentials in Supabase Vault hinterlegen.")}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700
                    hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center">
                    <Cloud className="w-4 h-4 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Dropbox</p>
                    <p className="text-xs text-gray-500">OAuth verbinden</p>
                  </div>
                </button>
              </div>

              {sources.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Noch keine Quellen konfiguriert</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((src) => {
                    const Icon = SOURCE_ICONS[src.source_type];
                    const docCount = src.ingest_documents?.[0]?.count ?? 0;
                    const isDbSource  = src.source_type === "supabase_table";
                    const isExpanded  = expandedSource === src.id;
                    return (
                      <div
                        key={src.id}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                      >
                        {/* Kopfzeile der Quelle */}
                        <div className="flex items-center gap-4 p-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          src.status === "error"
                            ? "bg-red-50 dark:bg-red-900/30"
                            : src.status === "paused"
                              ? "bg-gray-100 dark:bg-gray-700"
                              : "bg-indigo-50 dark:bg-indigo-900/30"
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            src.status === "error" ? "text-red-500"
                            : src.status === "paused" ? "text-gray-400"
                            : "text-indigo-500"
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{src.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {SOURCE_LABELS[src.source_type]} · {docCount} Dokumente · Zuletzt: {fmt(src.last_synced_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            src.status === "active"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : src.status === "error"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          }`}>
                            {src.status === "active" ? "Aktiv" : src.status === "paused" ? "Pausiert" : "Fehler"}
                          </span>
                          <button
                            onClick={() => handleSync(src.id)}
                            title="Jetzt synchronisieren"
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSource(src.id)}
                            title="Quelle entfernen"
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isDbSource && (
                            <button
                              onClick={() => setExpandedSource(isExpanded ? null : src.id)}
                              title={isExpanded ? "Tabellen ausblenden" : "Tabellen anzeigen"}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />
                              }
                            </button>
                          )}
                        </div>
                        </div>{/* Ende Kopfzeile */}

                        {/* Tabellen-Liste für supabase_table */}
                        {isDbSource && isExpanded && (
                          <SourceTableList
                            sourceId={src.id}
                            synced={src.last_synced_at !== null}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Dokumente ── */}
          {tab === "dokumente" && (
            <div className="space-y-4">
              {/* Status-Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setStatusFilter("")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === ""
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  Alle ({docs.length})
                </button>
                {(Object.keys(STATUS_LABELS) as DocStatus[]).map((s) => (
                  statusCounts[s] ? (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        statusFilter === s ? STATUS_COLOR[s] + " ring-2 ring-offset-1 ring-indigo-400" : STATUS_COLOR[s]
                      }`}
                    >
                      {STATUS_LABELS[s]} ({statusCounts[s]})
                    </button>
                  ) : null
                ))}
              </div>

              {docs.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <Database className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Noch keine Dokumente indexiert</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => {
                    const StatusIcon = STATUS_ICON[doc.status];
                    const isExpanded = expandedDoc === doc.id;
                    const isProcessing = ["extracting", "chunking", "embedding"].includes(doc.status);
                    return (
                      <div
                        key={doc.id}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                      >
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                        >
                          <StatusIcon className={`w-4 h-4 flex-shrink-0 ${
                            isProcessing ? "animate-spin text-indigo-500"
                            : doc.status === "indexed" ? "text-green-500"
                            : doc.status === "failed" ? "text-red-500"
                            : "text-gray-400"
                          }`} />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {doc.title ?? doc.id}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {SOURCE_LABELS[doc.source_type]} · {fmt(doc.created_at)}
                            </p>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLOR[doc.status]}`}>
                            {STATUS_LABELS[doc.status]}
                          </span>

                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          }
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-2">
                            {doc.error_message && (
                              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400
                                bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span className="font-mono text-xs">{doc.error_message}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                              <span>ID: {doc.id}</span>
                              {doc.mime_type && <span>· {doc.mime_type}</span>}
                              {doc.ingestion_sources && <span>· Quelle: {doc.ingestion_sources.name}</span>}
                            </div>
                            {(doc.status === "failed" || doc.status === "unsupported") && (
                              <button
                                onClick={() => handleRetry(doc.id)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                                  text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20
                                  hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Erneut versuchen
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddSource && (
        <AddSourceDialog
          onClose={() => setShowAddSource(false)}
          onAdded={loadSources}
        />
      )}
    </div>
  );
}
