"use client";

import { useState, useRef } from "react";
import {
  FileText, Upload, Loader, Download, X, AlertCircle,
  Image as ImageIcon, CheckCircle, Sparkles, FolderOpen, Mail, Send,
} from "lucide-react";

type ListingType = "kauf" | "miete";
interface UploadedImage { file: File; preview: string; }

export default function ExposeErstellungPage() {
  // ── Form ────────────────────────────────────────────────────────────────
  const [description,   setDescription]   = useState("");
  const [type,          setType]           = useState<ListingType>("kauf");
  const [price,         setPrice]          = useState("");
  const [images,        setImages]         = useState<UploadedImage[]>([]);
  const [template,      setTemplate]       = useState<File | null>(null);
  const [imageDrag,     setImageDrag]      = useState(false);
  const [templateDrag,  setTemplateDrag]   = useState(false);
  const imageInputRef   = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // ── Generation ──────────────────────────────────────────────────────────
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState("");
  const [pdfBlob,     setPdfBlob]     = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // ── Save to Documents ───────────────────────────────────────────────────
  const [saving,      setSaving]      = useState(false);
  const [savedFolder, setSavedFolder] = useState<string | null>(null);
  const [saveError,   setSaveError]   = useState("");

  // ── Email ───────────────────────────────────────────────────────────────
  const [showEmail,     setShowEmail]     = useState(false);
  const [emailTo,       setEmailTo]       = useState("");
  const [emailSubject,  setEmailSubject]  = useState("");
  const [emailMessage,  setEmailMessage]  = useState(
    "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie das Exposé zur Immobilie.\n\nMit freundlichen Grüßen",
  );
  const [sending,   setSending]   = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

  // ── Image helpers ───────────────────────────────────────────────────────
  function addImages(files: FileList | File[]) {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setImages((prev) =>
      [...prev, ...valid.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))].slice(0, 10),
    );
    resetResult();
  }
  function removeImage(idx: number) {
    setImages((prev) => { const c = [...prev]; URL.revokeObjectURL(c[idx].preview); c.splice(idx, 1); return c; });
  }
  function pickTemplate(files: FileList | File[]) {
    const pdf = Array.from(files).find((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (pdf) { setTemplate(pdf); resetResult(); }
  }

  function resetResult() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setPdfBlob(null);
    setDownloadUrl(null);
    setSavedFolder(null); setSaveError("");
    setEmailSent(false);  setEmailError(""); setShowEmail(false);
  }

  // ── Generate PDF ─────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!description.trim() || !price.trim()) return;
    setGenerating(true);
    setGenError("");
    resetResult();
    try {
      const fd = new FormData();
      fd.append("description", description);
      fd.append("type", type);
      fd.append("price", price);
      images.forEach(({ file }) => fd.append("images", file));
      if (template) fd.append("template", template);

      const res = await fetch("/api/expose", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Fehler ${res.status}`);
      }
      const blob = await res.blob();
      setPdfBlob(blob);
      setDownloadUrl(URL.createObjectURL(blob));
      setEmailSubject(`Exposé – ${type === "kauf" ? "Kauf" : "Vermietung"}: ${price}`);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  // ── Save to Documents ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!pdfBlob) return;
    setSaving(true);
    setSaveError("");
    try {
      const title = (description.slice(0, 60).trim() || "Exposé");
      const fd    = new FormData();
      fd.append("pdf",   new File([pdfBlob], "expose.pdf", { type: "application/pdf" }));
      fd.append("title", title);
      const res = await fetch("/api/expose/save", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Fehler");
      const data = await res.json();
      setSavedFolder(data.folder_name as string);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Send via Email ────────────────────────────────────────────────────────
  async function handleSendEmail() {
    if (!pdfBlob || !emailTo.trim()) return;
    setSending(true);
    setEmailError("");
    try {
      const fd = new FormData();
      fd.append("pdf",     new File([pdfBlob], "expose.pdf", { type: "application/pdf" }));
      fd.append("to",      emailTo.trim());
      fd.append("subject", emailSubject.trim() || "Exposé");
      fd.append("message", emailMessage);
      const res = await fetch("/api/expose/email", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Fehler");
      setEmailSent(true);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const canGenerate = !!description.trim() && !!price.trim() && !generating;
  const hasResult   = !!pdfBlob && !!downloadUrl;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Exposé-Erstellung</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            KI-generiertes Immobilien-Exposé als PDF – powered by Claude Opus
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">

          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Beschreibung <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="z.B. Schöne 3-Zimmer-Wohnung, 85 m², Baujahr 2005, ruhige Südlage, neue Einbauküche, Balkon, Tiefgarage, Fußbodenheizung …"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Art + Preis */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Art <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
                {(["kauf", "miete"] as ListingType[]).map((t) => (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex-1 py-2 font-medium transition-colors ${
                      type === t
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {t === "kauf" ? "Kauf" : "Vermietung"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {type === "kauf" ? "Kaufpreis" : "Kaltmiete"} <span className="text-red-500">*</span>
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={type === "kauf" ? "z.B. 450.000 €" : "z.B. 1.200 €/Monat"}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                  focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Bilder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Bilder <span className="text-xs font-normal text-gray-400">(optional, max. 10)</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setImageDrag(true); }}
              onDragLeave={() => setImageDrag(false)}
              onDrop={(e) => { e.preventDefault(); setImageDrag(false); addImages(e.dataTransfer.files); }}
              onClick={() => imageInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                imageDrag
                  ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              }`}
            >
              <ImageIcon className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Bilder hierher ziehen oder klicken</p>
              <p className="text-xs text-gray-400 mt-0.5">JPG · PNG · WebP</p>
              <input ref={imageInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => e.target.files && addImages(e.target.files)} />
            </div>
            {images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative group w-20 h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt=""
                      className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                    {i === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-indigo-600/80 text-white text-xs text-center py-0.5 rounded-b-lg">
                        Haupt
                      </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white
                        flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vorlage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Vorlage <span className="text-xs font-normal text-gray-400">(optional – PDF, wird vorangestellt)</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setTemplateDrag(true); }}
              onDragLeave={() => setTemplateDrag(false)}
              onDrop={(e) => { e.preventDefault(); setTemplateDrag(false); pickTemplate(e.dataTransfer.files); }}
              onClick={() => templateInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 flex items-center gap-4 cursor-pointer transition-colors ${
                templateDrag
                  ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                  : template
                    ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              }`}
            >
              <FileText className={`w-8 h-8 flex-shrink-0 ${template ? "text-green-500" : "text-gray-400"}`} />
              <div className="flex-1 min-w-0">
                {template ? (
                  <>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 truncate">{template.name}</p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Wird dem Exposé vorangestellt</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400">PDF-Vorlage hierher ziehen</p>
                    <p className="text-xs text-gray-400 mt-0.5">z.B. Deckblatt oder Firmenvorlage</p>
                  </>
                )}
              </div>
              {template && (
                <button onClick={(e) => { e.stopPropagation(); setTemplate(null); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
              <input ref={templateInputRef} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => e.target.files && pickTemplate(e.target.files)} />
            </div>
          </div>

          {/* Gen error */}
          {genError && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm
              bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {genError}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
              text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <><Loader className="w-4 h-4 animate-spin" />Exposé wird erstellt …</>
            ) : (
              <><Upload className="w-4 h-4" />Exposé erstellen</>
            )}
          </button>

          {generating && (
            <p className="text-xs text-center text-gray-400">
              Claude Opus analysiert das Objekt — bitte kurz warten …
            </p>
          )}
        </div>

        {/* ── Aktionen (visible once PDF is ready) ──────────────────────────── */}
        {hasResult && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Exposé bereit</p>
            </div>

            {/* Three action buttons */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700">

              {/* Download */}
              <a
                href={downloadUrl!}
                download={`expose-${Date.now()}.pdf`}
                className="flex flex-col items-center gap-2 py-5 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50
                  transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center
                  group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Herunterladen</span>
              </a>

              {/* Save to documents */}
              <button
                onClick={handleSave}
                disabled={saving || !!savedFolder}
                className="flex flex-col items-center gap-2 py-5 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50
                  disabled:cursor-default transition-colors text-center group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  savedFolder
                    ? "bg-green-50 dark:bg-green-900/30"
                    : "bg-amber-50 dark:bg-amber-900/30 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50"
                }`}>
                  {saving
                    ? <Loader className="w-5 h-5 text-amber-600 animate-spin" />
                    : savedFolder
                      ? <CheckCircle className="w-5 h-5 text-green-500" />
                      : <FolderOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  }
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {savedFolder ? `Gespeichert in »${savedFolder}«` : "In Dokumenten ablegen"}
                </span>
                {saveError && (
                  <span className="text-xs text-red-500 leading-tight">{saveError}</span>
                )}
              </button>

              {/* Send via email */}
              <button
                onClick={() => { setShowEmail((v) => !v); setEmailSent(false); setEmailError(""); }}
                className={`flex flex-col items-center gap-2 py-5 px-3 transition-colors text-center group ${
                  showEmail
                    ? "bg-sky-50 dark:bg-sky-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  emailSent
                    ? "bg-green-50 dark:bg-green-900/30"
                    : showEmail
                      ? "bg-sky-100 dark:bg-sky-900/40"
                      : "bg-sky-50 dark:bg-sky-900/30 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/50"
                }`}>
                  {emailSent
                    ? <CheckCircle className="w-5 h-5 text-green-500" />
                    : <Mail className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  }
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {emailSent ? "E-Mail gesendet" : "Per E-Mail senden"}
                </span>
              </button>
            </div>

            {/* Inline email form */}
            {showEmail && !emailSent && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  E-Mail mit Exposé-Anhang senden
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Empfänger <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="empfaenger@beispiel.de"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                        focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Betreff</label>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                        focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nachricht</label>
                  <textarea
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                      focus:ring-2 focus:ring-sky-500 outline-none resize-none"
                  />
                </div>

                {emailError && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm
                    bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {emailError}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSendEmail}
                    disabled={sending || !emailTo.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                      text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors"
                  >
                    {sending
                      ? <><Loader className="w-4 h-4 animate-spin" />Wird gesendet …</>
                      : <><Send className="w-4 h-4" />E-Mail senden</>
                    }
                  </button>
                </div>
              </div>
            )}

            {showEmail && emailSent && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  E-Mail an <strong>{emailTo}</strong> erfolgreich versendet. Das Exposé liegt als Anhang bei.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
