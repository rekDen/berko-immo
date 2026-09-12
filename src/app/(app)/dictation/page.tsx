"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, Square, Loader2, Copy, Mail, Check,
  X, AlertCircle, RefreshCw, Trash2, ChevronDown,
  ChevronUp, Pencil, Clock, Save, Link2,
} from "lucide-react";
import Combobox from "@/components/Combobox";
import { contactDisplayName } from "@/types/crm";

// ─── Typen ────────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "recording" | "processing" | "done" | "error";

interface Dictation {
  id: string;
  title: string;
  raw_transcription: string;
  formatted_text: string;
  duration_seconds: number | null;
  created_at: string;
  linked_contact_id: string | null;
  linked_property_id: string | null;
  linked_ticket_id: string | null;
  linked_contract_id: string | null;
}

// ─── Konstanten ───────────────────────────────────────────────────────────────

const DIKTIERZEICHEN = [
  { command: "Komma", symbol: "," },
  { command: "Punkt", symbol: "." },
  { command: "Neue Zeile", symbol: "↵" },
  { command: "Neuer Absatz", symbol: "¶" },
  { command: "Doppelpunkt", symbol: ":" },
  { command: "Semikolon", symbol: ";" },
  { command: "Gedankenstrich", symbol: "—" },
  { command: "Ausrufezeichen", symbol: "!" },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function DictationPage() {
  const router = useRouter();

  // ── Aufnahme-State ───────────────────────────────────────────────────────────
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [rawText, setRawText] = useState("");
  const [formattedText, setFormattedText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [processingStep, setProcessingStep] = useState<"transcribe" | "format">("transcribe");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // ID des bearbeiteten Diktats

  // ── Kopieren / E-Mail ──────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── History ──────────────────────────────────────────────────────────────────
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [savingTitleId, setSavingTitleId] = useState<string | null>(null);

  // ── Verknüpfungen ──────────────────────────────────────────────────────────
  const [linksOpenId, setLinksOpenId] = useState<string | null>(null);
  const [linksSavingId, setLinksSavingId] = useState<string | null>(null);
  const [linkContacts, setLinkContacts] = useState<{ id: string; type: "natural_person" | "legal_entity"; first_name: string | null; last_name: string | null; company_name: string | null }[]>([]);
  const [linkProperties, setLinkProperties] = useState<{ id: string; name: string }[]>([]);
  const [linkTickets, setLinkTickets] = useState<{ id: string; title: string }[]>([]);
  const [linkContracts, setLinkContracts] = useState<{ id: string; type: string; contact_roles: { properties: { name: string } | null; contacts: { first_name: string | null; last_name: string | null; company_name: string | null; type: "natural_person" | "legal_entity" } } }[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Daten laden ──────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/dictations");
    if (res.ok) setDictations(await res.json());
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Audio verarbeiten ────────────────────────────────────────────────────────
  const processAudio = useCallback(async (blob: Blob, durationSec: number) => {
    setRecordingState("processing");
    setErrorMsg("");
    try {
      setProcessingStep("transcribe");
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const transRes = await fetch("/api/dictations/transcribe", { method: "POST", body: fd });
      if (!transRes.ok) throw new Error((await transRes.json()).error ?? "Transkription fehlgeschlagen");
      const { text } = await transRes.json();
      setRawText(text);

      setProcessingStep("format");
      const fmtRes = await fetch("/api/dictations/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: text }),
      });
      if (!fmtRes.ok) throw new Error((await fmtRes.json()).error ?? "Formatierung fehlgeschlagen");
      const { formatted } = await fmtRes.json();
      setFormattedText(formatted);
      setRecordingState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setRecordingState("error");
    }
  }, []);

  // ── Aufnahme starten ─────────────────────────────────────────────────────────
  async function handleStart() {
    setErrorMsg("");
    setRawText("");
    setFormattedText("");
    setDuration(0);
    setCopied(false);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("Mikrofonzugriff verweigert. Bitte Berechtigung erteilen.");
      setRecordingState("error");
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      processAudio(blob, Math.round((Date.now() - startTimeRef.current) / 1000));
    };

    recorder.start(250);
    startTimeRef.current = Date.now();
    setRecordingState("recording");
    timerRef.current = setInterval(() => setDuration(Math.round((Date.now() - startTimeRef.current) / 1000)), 500);
  }

  function handleStop() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
  }

  function handleReset() {
    setRecordingState("idle");
    setRawText(""); setFormattedText(""); setErrorMsg("");
    setDuration(0); setCopied(false);
    setTitle(""); setEditingId(null);
  }

  // ── Speichern (neu oder überschreiben) ───────────────────────────────────────
  async function handleSave(asNew = false) {
    if (!rawText || saving) return;
    setSaving(true);
    try {
      if (editingId && !asNew) {
        // Bestehendes Diktat aktualisieren
        const res = await fetch(`/api/dictations/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, raw_transcription: rawText, formatted_text: formattedText, duration_seconds: duration }),
        });
        if (res.ok) {
          const updated = await res.json();
          setDictations((prev) => prev.map((d) => d.id === editingId ? updated : d));
          handleReset();
        }
      } else {
        // Neues Diktat anlegen
        const res = await fetch("/api/dictations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, raw_transcription: rawText, formatted_text: formattedText, duration_seconds: duration }),
        });
        if (res.ok) {
          const created = await res.json();
          setDictations((prev) => [created, ...prev]);
          handleReset();
        }
      }
    } finally {
      setSaving(false);
    }
  }

  // ── History-Aktionen ─────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Diktat endgültig löschen?")) return;
    setDeletingId(id);
    await fetch(`/api/dictations/${id}`, { method: "DELETE" });
    setDictations((prev) => prev.filter((d) => d.id !== id));
    setDeletingId(null);
  }

  function handleEditRecording(d: Dictation) {
    setEditingId(d.id);
    setTitle(d.title ?? "");
    setRawText(""); setFormattedText("");
    setRecordingState("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveTitle(id: string) {
    setSavingTitleId(id);
    const res = await fetch(`/api/dictations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingTitleValue }),
    });
    if (res.ok) {
      setDictations((prev) => prev.map((d) => d.id === id ? { ...d, title: editingTitleValue } : d));
      setEditingTitleId(null);
    }
    setSavingTitleId(null);
  }

  function handleSendAsEmail() {
    sessionStorage.setItem("newEmailBody", formattedText);
    router.push("/emails");
  }

  // ── Verknüpfungs-Handler ────────────────────────────────────────────────────
  async function openLinks(id: string) {
    setLinksOpenId(linksOpenId === id ? null : id);
    if (linkContacts.length > 0) return;
    setLinkLoading(true);
    const [c, p, t, co] = await Promise.all([
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/properties").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/tickets").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/contracts").then((r) => (r.ok ? r.json() : [])),
    ]);
    setLinkContacts(c);
    setLinkProperties(p);
    setLinkTickets(t);
    setLinkContracts(co);
    setLinkLoading(false);
  }

  async function saveLink(id: string, field: string, value: string | null) {
    setLinksSavingId(id);
    const res = await fetch(`/api/dictations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      setDictations((prev) =>
        prev.map((d) => d.id === id ? { ...d, [field]: value } : d)
      );
    }
    setLinksSavingId(null);
  }

  const CONTRACT_TYPE_LABELS: Record<string, string> = {
    rental_residential: "Wohnraummiete",
    rental_commercial: "Gewerbemiete",
    management_weg: "WEG-Verwaltung",
    management_mv: "MV-Verwaltung",
    management_se: "SE-Verwaltung",
  };

  const isProcessing = recordingState === "processing";

  return (
    <>
      <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-gray-950 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Diktat</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sprachaufnahme &amp; KI-Formatierung</p>
        </div>

        {/* Edit-Banner */}
        {editingId && (
          <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl border bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Bearbeitungsmodus — nimm neu auf um das Diktat zu ersetzen
              </span>
            </div>
            <button onClick={handleReset} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Diktierzeichen */}
        <div className="rounded-2xl p-5 mb-8 border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-400 dark:text-gray-500">Diktierzeichen</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DIKTIERZEICHEN.map(({ command, symbol }) => (
              <div key={command} className="flex items-center justify-between rounded-lg px-3 py-2 border bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">{command}</span>
                <span className="text-base font-mono ml-2 text-cyan-600 dark:text-cyan-400">{symbol}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Aufnahme-Button */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="p-[2px] rounded-full" style={{
            background: recordingState === "recording" ? "linear-gradient(135deg,#ef4444,#f97316)"
              : recordingState === "error" ? "linear-gradient(135deg,#ef4444,#dc2626)"
              : "linear-gradient(135deg,#00c3d2,#06b6d4)",
          }}>
            <button
              onClick={recordingState === "idle" || recordingState === "error" ? handleStart : recordingState === "recording" ? handleStop : undefined}
              disabled={isProcessing}
              className={["flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none bg-white dark:bg-gray-900",
                recordingState === "recording" ? "animate-pulse" : "hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95",
                isProcessing ? "cursor-not-allowed opacity-70" : ""].filter(Boolean).join(" ")}
              style={{ width: 88, height: 88 }}
            >
              {isProcessing ? <Loader2 className="w-9 h-9 text-indigo-500 animate-spin" />
                : recordingState === "recording" ? <Square className="w-9 h-9 text-red-500 fill-red-500" />
                : <Mic className={`w-9 h-9 ${recordingState === "done" ? "text-cyan-500" : recordingState === "error" ? "text-red-500" : "text-indigo-500"}`} />}
            </button>
          </div>

          {(recordingState === "recording" || (isProcessing && duration > 0)) && (
            <div className="font-mono text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-200">
              {formatDuration(duration)}
            </div>
          )}

          <p className="text-sm text-center text-gray-500 dark:text-gray-400">
            {recordingState === "idle" && "Klicken zum Starten der Aufnahme"}
            {recordingState === "recording" && <span className="text-red-500 font-medium animate-pulse">Aufnahme läuft… Klicken zum Stoppen</span>}
            {isProcessing && <span className="text-indigo-600 dark:text-indigo-300">
              {processingStep === "transcribe" ? "Transkribiere mit Berko AI Scribe…" : "Berko AI formatiert…"}
            </span>}
            {recordingState === "done" && <button onClick={handleReset} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2 transition-colors">Neue Aufnahme starten</button>}
            {recordingState === "error" && <span className="flex items-center gap-2 text-red-500"><AlertCircle className="w-4 h-4 flex-shrink-0" />{errorMsg}</span>}
          </p>
          {recordingState === "error" && (
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Zurücksetzen
            </button>
          )}
        </div>

        {/* Ergebnis */}
        {recordingState === "done" && (
          <div className="space-y-5 mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl p-6 border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 text-gray-400 dark:text-gray-500 flex items-center gap-2">
                  Rohtranskription
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 normal-case tracking-normal">Berko AI Scribe</span>
                </h2>
                <p className="text-sm leading-relaxed font-mono text-gray-600 dark:text-gray-300">{rawText}</p>
              </div>
              <div className="rounded-2xl p-6 border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">KI-formatiert</h2>
                  <span className="inline-flex items-center gap-1 text-xs bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5 text-cyan-600 dark:text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" /> Berko AI
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line text-gray-900 dark:text-white">{formattedText}</p>
              </div>
            </div>

            {/* Titel-Eingabe */}
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titel des Diktats (optional)"
                className="w-full px-4 py-2.5 text-sm rounded-xl border transition-colors
                  bg-white border-gray-200 text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                  dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
              />
            </div>

            {/* Aktionen */}
            <div className="flex flex-wrap gap-3">
              {/* Speichern */}
              <button onClick={() => handleSave(false)} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? "Diktat aktualisieren" : "Diktat speichern"}
              </button>
              {editingId && (
                <button onClick={() => handleSave(true)} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl active:scale-95 transition-all border bg-white border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:bg-gray-800 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10 disabled:opacity-50">
                  <Save className="w-4 h-4" /> Als neues Diktat speichern
                </button>
              )}
              <button onClick={handleSendAsEmail}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl active:scale-95 transition-all border bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
                <Mail className="w-4 h-4 text-indigo-500" /> Als E-Mail senden
              </button>
              <button onClick={() => { navigator.clipboard.writeText(formattedText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl active:scale-95 transition-all border bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                <span className={copied ? "text-emerald-600 dark:text-emerald-400" : ""}>{copied ? "Kopiert" : "Kopieren"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Diktat-Verlauf ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            Alle Diktate
            {dictations.length > 0 && <span className="text-sm font-normal text-gray-400 dark:text-gray-500">({dictations.length})</span>}
          </h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            </div>
          ) : dictations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 py-12 flex flex-col items-center gap-2 text-center">
              <Mic className="w-8 h-8 text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Noch keine Diktate vorhanden. Starte deine erste Aufnahme.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dictations.map((d) => {
                const isExpanded = expandedId === d.id;
                const displayTitle = d.title || `Diktat vom ${formatDateTime(d.created_at)}`;
                return (
                  <div key={d.id} className="rounded-2xl border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                    {/* Kopfzeile */}
                    <div className="flex items-center gap-3 px-5 py-4">
                      {/* Titel (klickbar zum Aufklappen) */}
                      <button onClick={() => setExpandedId(isExpanded ? null : d.id)} className="flex-1 min-w-0 text-left">
                        {editingTitleId === d.id ? (
                          <input
                            type="text"
                            value={editingTitleValue}
                            onChange={(e) => setEditingTitleValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(d.id); if (e.key === "Escape") setEditingTitleId(null); }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full px-2.5 py-1 text-sm rounded-lg border border-indigo-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-gray-800 dark:border-indigo-500/50 dark:text-white"
                          />
                        ) : (
                          <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{displayTitle}</span>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                <Clock className="w-3 h-3" /> {formatDateTime(d.created_at)}
                              </span>
                              {d.duration_seconds && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDuration(d.duration_seconds)}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </button>

                      {/* Aktionen */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {editingTitleId === d.id ? (
                          <>
                            <button onClick={() => handleSaveTitle(d.id)} disabled={savingTitleId === d.id}
                              className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50">
                              {savingTitleId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setEditingTitleId(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingTitleId(d.id); setEditingTitleValue(d.title ?? ""); }}
                            title="Titel bearbeiten"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleEditRecording(d)} title="Neu aufnehmen"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
                          <Mic className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(d.id)} disabled={deletingId === d.id} title="Löschen"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
                          {deletingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : d.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Vorschau (immer) */}
                    {!isExpanded && (
                      <p className="px-5 pb-4 text-xs text-gray-400 dark:text-gray-500 truncate">
                        {d.formatted_text?.slice(0, 120)}{(d.formatted_text?.length ?? 0) > 120 ? "…" : ""}
                      </p>
                    )}

                    {/* Aufgeklappter Inhalt */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
                          <div className="p-5">
                            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Rohtranskription</h3>
                            <p className="text-xs leading-relaxed font-mono text-gray-500 dark:text-gray-400">{d.raw_transcription}</p>
                          </div>
                          <div className="p-5">
                            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">KI-formatiert</h3>
                            <p className="text-sm leading-relaxed whitespace-pre-line text-gray-900 dark:text-white">{d.formatted_text}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
                          <button onClick={() => { navigator.clipboard.writeText(d.formatted_text); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
                            <Copy className="w-3 h-3" /> Kopieren
                          </button>
                          <button onClick={() => { sessionStorage.setItem("newEmailBody", d.formatted_text); router.push("/emails"); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
                            <Mail className="w-3 h-3" /> Als E-Mail
                          </button>
                          <button
                            type="button"
                            onClick={() => openLinks(d.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                              linksOpenId === d.id
                                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                                : "border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                            }`}
                          >
                            <Link2 className="w-3 h-3" />
                            Als Notiz zuordnen
                            {(d.linked_contact_id || d.linked_property_id || d.linked_ticket_id || d.linked_contract_id) && (
                              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500 text-white leading-none">
                                {[d.linked_contact_id, d.linked_property_id, d.linked_ticket_id, d.linked_contract_id].filter(Boolean).length}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Verknüpfungs-Panel */}
                        {linksOpenId === d.id && (
                          <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                            {linkLoading ? (
                              <div className="flex justify-center py-3">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                              </div>
                            ) : (
                              <>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Kontakt</label>
                                  <div className="flex gap-2">
                                    <Combobox
                                      value={d.linked_contact_id ?? ""}
                                      onChange={(v) => saveLink(d.id, "linked_contact_id", v || null)}
                                      options={linkContacts.map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
                                      placeholder="Kontakt zuordnen…"
                                      className="flex-1"
                                    />
                                    {d.linked_contact_id && (
                                      <a href={`/kontakte/${d.linked_contact_id}`} target="_blank" rel="noreferrer"
                                        className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 whitespace-nowrap">
                                        Öffnen
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Objekt</label>
                                  <div className="flex gap-2">
                                    <Combobox
                                      value={d.linked_property_id ?? ""}
                                      onChange={(v) => saveLink(d.id, "linked_property_id", v || null)}
                                      options={linkProperties.map((p) => ({ value: p.id, label: p.name }))}
                                      placeholder="Objekt zuordnen…"
                                      className="flex-1"
                                    />
                                    {d.linked_property_id && (
                                      <a href={`/objekte/${d.linked_property_id}`} target="_blank" rel="noreferrer"
                                        className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 whitespace-nowrap">
                                        Öffnen
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vorgang</label>
                                  <div className="flex gap-2">
                                    <Combobox
                                      value={d.linked_ticket_id ?? ""}
                                      onChange={(v) => saveLink(d.id, "linked_ticket_id", v || null)}
                                      options={linkTickets.map((t) => ({ value: t.id, label: t.title }))}
                                      placeholder="Vorgang zuordnen…"
                                      className="flex-1"
                                    />
                                    {d.linked_ticket_id && (
                                      <a href={`/vorgaenge/${d.linked_ticket_id}`} target="_blank" rel="noreferrer"
                                        className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 whitespace-nowrap">
                                        Öffnen
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vertrag</label>
                                  <div className="flex gap-2">
                                    <Combobox
                                      value={d.linked_contract_id ?? ""}
                                      onChange={(v) => saveLink(d.id, "linked_contract_id", v || null)}
                                      options={linkContracts.map((c) => {
                                        const cr = c.contact_roles;
                                        const name = cr?.contacts ? contactDisplayName(cr.contacts) : "";
                                        const prop = cr?.properties?.name ?? "";
                                        return {
                                          value: c.id,
                                          label: [CONTRACT_TYPE_LABELS[c.type] ?? c.type, name, prop].filter(Boolean).join(" · "),
                                        };
                                      })}
                                      placeholder="Vertrag zuordnen…"
                                      className="flex-1"
                                    />
                                    {d.linked_contract_id && (
                                      <a href={`/vertraege/${d.linked_contract_id}`} target="_blank" rel="noreferrer"
                                        className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 whitespace-nowrap">
                                        Öffnen
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {linksSavingId === d.id && (
                                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Wird gespeichert…
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
