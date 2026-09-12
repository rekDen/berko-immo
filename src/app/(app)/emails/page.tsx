"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Email } from "@/types";
import { useEmailNotifications } from "@/components/EmailNotifications";
import MarkdownContent from "@/components/MarkdownContent";
import {
  Mail,
  Star,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Scale,
  Send,
  Edit3,
  RefreshCw,
  RefreshCcw,
  Settings,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Reply,
  Forward,
  Trash2,
  Inbox,
  FileEdit,
  SendHorizonal,
  Plus,
  Search,
  SlidersHorizontal,
  Link2,
} from "lucide-react";
import Combobox from "@/components/Combobox";
import { contactDisplayName } from "@/types/crm";

/** Rohe DB-Zeile (snake_case) */
interface DbEmail {
  id: string;
  from_address: string;
  from_name: string;
  subject: string;
  body: string;
  date: string;
  category: Email["category"];
  folder: Email["folder"];
  read: boolean;
  starred: boolean;
  ai_summary: string;
  ai_draft: string;
  ai_legal: string;
  imap_uid: number | null;
  message_id: string | null;
  to_address: string | null;
  cc: string | null;
  bcc: string | null;
  linked_contact_id: string | null;
  linked_property_id: string | null;
  linked_ticket_id: string | null;
  linked_contract_id: string | null;
}

/** DB-Zeile auf den Frontend-Typ mappen */
function toEmail(row: DbEmail): Email {
  return {
    id: row.id,
    from: row.from_address,
    fromName: row.from_name,
    subject: row.subject,
    body: row.body,
    date: row.date,
    category: row.category,
    folder: row.folder ?? "inbox",
    read: row.read,
    starred: row.starred,
    aiSummary: row.ai_summary,
    aiDraft: row.ai_draft,
    aiLegal: row.ai_legal,
    toAddress: row.to_address,
    cc: row.cc,
    bcc: row.bcc,
    linkedContactId: row.linked_contact_id ?? null,
    linkedPropertyId: row.linked_property_id ?? null,
    linkedTicketId: row.linked_ticket_id ?? null,
    linkedContractId: row.linked_contract_id ?? null,
  };
}

type Category = "alle" | Email["category"];
type Folder = "inbox" | "sent" | "draft";

interface AccountInfo {
  email: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  last_sync_at: string | null;
  sync_error: string | null;
}

// ─── Kategorie-Konfiguration ──────────────────────────────────────────────

const categoryConfig: Record<
  Email["category"],
  { label: string; pill: string }
> = {
  objektbezogen: {
    label: "objektbezogen",
    pill: "bg-orange-500/15 text-orange-600 border-orange-500/20 dark:text-orange-400",
  },
  mieterkommunikation: {
    label: "Mieterkommunikation",
    pill: "bg-blue-500/15 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  finanzen: {
    label: "Finanzen & Abrechnung",
    pill: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  schaeden: {
    label: "Schäden & Instandhaltung",
    pill: "bg-red-500/15 text-red-600 border-red-500/20 dark:text-red-400",
  },
  vertraege: {
    label: "Verträge & Dokumente",
    pill: "bg-purple-500/15 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
  weg: {
    label: "Eigentümer / WEG",
    pill: "bg-amber-500/15 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  behoerden: {
    label: "Behörden & Recht",
    pill: "bg-rose-500/15 text-rose-600 border-rose-500/20 dark:text-rose-400",
  },
  dienstleister: {
    label: "Dienstleister & Partner",
    pill: "bg-cyan-500/15 text-cyan-600 border-cyan-500/20 dark:text-cyan-400",
  },
  termine: {
    label: "Termine & Organisation",
    pill: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
  },
  intern: {
    label: "Intern",
    pill: "bg-green-500/15 text-green-600 border-green-500/20 dark:text-green-400",
  },
  newsletter: {
    label: "Newsletter",
    pill: "bg-gray-500/10 text-gray-500 border-gray-400/20 dark:text-gray-400",
  },
};

const filterPills: { key: Category; label: string; activeClass: string }[] = [
  { key: "alle", label: "Alle", activeClass: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30 dark:text-indigo-400" },
  { key: "objektbezogen", label: "Objekt", activeClass: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400" },
  { key: "mieterkommunikation", label: "Mieter", activeClass: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400" },
  { key: "finanzen", label: "Finanzen", activeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400" },
  { key: "schaeden", label: "Schäden", activeClass: "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400" },
  { key: "vertraege", label: "Verträge", activeClass: "bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400" },
  { key: "weg", label: "WEG", activeClass: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400" },
  { key: "behoerden", label: "Behörden", activeClass: "bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400" },
  { key: "dienstleister", label: "Dienstleister", activeClass: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30 dark:text-cyan-400" },
  { key: "termine", label: "Termine", activeClass: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30 dark:text-indigo-400" },
  { key: "intern", label: "Intern", activeClass: "bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400" },
  { key: "newsletter", label: "Newsletter", activeClass: "bg-gray-500/10 text-gray-600 border-gray-400/30 dark:text-gray-400" },
];

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSyncTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return "gerade eben";
  if (diff < 60) return `vor ${diff} Min.`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

// ─── Setup-Dialog ─────────────────────────────────────────────────────────────

function SetupDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    email: "daniel.tauscher@berko.ai",
    imap_host: "imap.ionos.de",
    imap_port: "993",
    imap_user: "daniel.tauscher@berko.ai",
    imap_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "testing" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSave(testFirst: boolean) {
    setStatus(testFirst ? "testing" : "saving");
    setErrorMsg("");

    const res = await fetch("/api/emails/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, imap_port: Number(form.imap_port), test_connection: testFirst }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(data.error ?? "Unbekannter Fehler");
      return;
    }

    setStatus("ok");
    setTimeout(() => {
      onSaved();
      onClose();
    }, 800);
  }

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div>
      <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <div className="relative">
        <input
          type={key === "imap_password" && !showPassword ? "password" : type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
            bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
            dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        {key === "imap_password" && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                IMAP-Verbindung einrichten
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">IONOS Mailserver</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {field("E-Mail-Adresse", "email")}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">{field("IMAP-Host", "imap_host")}</div>
            <div>{field("Port", "imap_port", "number")}</div>
          </div>
          {field("Benutzername (IMAP)", "imap_user")}
          {field("Passwort", "imap_password", "password")}

          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            Das Passwort wird verschlüsselt in Supabase gespeichert und
            ausschließlich serverseitig für den IMAP-Zugriff verwendet.
          </p>

          {status === "error" && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          {status === "ok" && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-500/30 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Verbindung erfolgreich — Zugangsdaten gespeichert.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 pb-5">
          <button
            onClick={() => handleSave(true)}
            disabled={!form.imap_password || status === "testing" || status === "saving" || status === "ok"}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              border border-indigo-300 text-indigo-600 hover:bg-indigo-50
              dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "testing" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Verbindung testen & speichern
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={!form.imap_password || status === "testing" || status === "saving" || status === "ok"}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
              bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
            ) : null}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

interface ComposeState {
  mode: "reply" | "forward" | "draft" | "new";
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  draftId?: string;
}

const folderConfig: { key: Folder; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Posteingang", icon: Inbox },
  { key: "sent", label: "Gesendet", icon: SendHorizonal },
  { key: "draft", label: "Entwürfe", icon: FileEdit },
];

export default function EmailsPage() {
  const [emailList, setEmailList] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [activeFolder, setActiveFolder] = useState<Folder>("inbox");
  const [categoryFilter, setCategoryFilter] = useState<Category>("alle");
  const [draftExpanded, setDraftExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Verknüpfungen
  const [linksOpen, setLinksOpen] = useState(false);
  const [linksSaving, setLinksSaving] = useState(false);
  const [linkContacts, setLinkContacts] = useState<{ id: string; type: "natural_person" | "legal_entity"; first_name: string | null; last_name: string | null; company_name: string | null }[]>([]);
  const [linkProperties, setLinkProperties] = useState<{ id: string; name: string }[]>([]);
  const [linkTickets, setLinkTickets] = useState<{ id: string; title: string }[]>([]);
  const [linkContracts, setLinkContracts] = useState<{ id: string; type: string; contact_roles: { properties: { name: string } | null; contacts: { first_name: string | null; last_name: string | null; company_name: string | null; type: "natural_person" | "legal_entity" } } }[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [legalizing, setLegalizing] = useState(false);
  const [legalExpanded, setLegalExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    from: "",
    subject: "",
    dateFrom: "",
    dateTo: "",
    unreadOnly: false,
    starredOnly: false,
  });

  const { liveConnected, emailUpdateCount } = useEmailNotifications();

  const [panelWidth, setPanelWidth] = useState(450);
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  const syncingRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const composeRef = useRef<HTMLDivElement>(null);

  // ── E-Mails laden ─────────────────────────────────────────────────────────

  const refreshEmails = useCallback(async (folder?: Folder) => {
    const f = folder ?? "inbox";
    const res = await fetch(`/api/emails?folder=${f}`);
    if (!res.ok) return;
    const rows: DbEmail[] = await res.json();
    const mapped = rows.map(toEmail);
    setEmailList(mapped);
  }, []);

  const loadCredentials = useCallback(async () => {
    const res = await fetch("/api/emails/credentials");
    if (!res.ok) return false;
    const data = await res.json();
    setAccount(data.account);
    if (!data.configured) setShowSetup(true);
    return data.configured as boolean;
  }, []);

  const loadEmails = useCallback(async (folder?: Folder) => {
    const f = folder ?? "inbox";
    setLoading(true);
    try {
      const res = await fetch(`/api/emails?folder=${f}`);
      if (res.ok) {
        const rows: DbEmail[] = await res.json();
        const mapped = rows.map(toEmail);
        setEmailList(mapped);

        // Von /dictation weitergeleitet? Compose mit vorausgefülltem Text öffnen
        const dictationBody = sessionStorage.getItem("newEmailBody");
        if (dictationBody && f === "inbox") {
          sessionStorage.removeItem("newEmailBody");
          setCompose({ mode: "new", to: "", cc: "", bcc: "", subject: "", body: dictationBody });
        }

        // Von /cases weitergeleitet? Ziel-E-Mail direkt öffnen
        const targetId = sessionStorage.getItem("openEmailId");
        const targetFolder = sessionStorage.getItem("openEmailFolder") ?? "inbox";
        if (targetId && targetFolder === f) {
          sessionStorage.removeItem("openEmailId");
          sessionStorage.removeItem("openEmailFolder");
          const target = mapped.find((e) => e.id === targetId);
          if (target) { setSelectedEmail(target); return; }
        }

        if (f === "inbox") {
          setSelectedEmail((prev) => prev ?? mapped[0] ?? null);
        }
      }
    } finally {
      isInitialLoadRef.current = false;
      setLoading(false);
    }
  }, []);

  // ── Ordner wechseln ───────────────────────────────────────────────────────

  function handleFolderChange(folder: Folder) {
    setActiveFolder(folder);
    setSelectedEmail(null);
    setCompose(null);
    setCategoryFilter("alle");
    loadEmails(folder);
  }

  // ── Manueller Sync ────────────────────────────────────────────────────────

  const runSync = useCallback(async (silent = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (!silent) { setSyncing(true); setSyncStatus(null); }
    try {
      const res = await fetch("/api/emails/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (!silent) setSyncStatus(`Fehler: ${data.error}`);
        return;
      }
      await refreshEmails("inbox");
      setAccount((prev) => prev ? { ...prev, last_sync_at: new Date().toISOString() } : prev);
      if (!silent) {
        const { synced, skipped, errors } = data;
        setSyncStatus(`${synced} neu${skipped ? `, ${skipped} übersprungen` : ""}${errors?.length ? `, ${errors.length} Fehler` : ""}`);
        setTimeout(() => setSyncStatus(null), 5000);
      }
    } catch {
      if (!silent) setSyncStatus("Verbindungsfehler");
    } finally {
      syncingRef.current = false;
      if (!silent) setSyncing(false);
    }
  }, [refreshEmails]);

  const handleSync = useCallback(() => runSync(false), [runSync]);

  // ── Initialisierung ───────────────────────────────────────────────────────

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizingRef.current) return;
      const delta = e.clientX - resizeStartXRef.current;
      const next = Math.min(Math.max(resizeStartWidthRef.current + delta, 220), 560);
      setPanelWidth(next);
    }
    function onMouseUp() {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const configured = await loadCredentials();
      await loadEmails("inbox");
      if (active && configured) runSync(true);
    }
    init();

    const onFocus = () => refreshEmails(activeFolder);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime: E-Mail-Liste sofort aktualisieren wenn neue E-Mails ankommen ──
  useEffect(() => {
    if (emailUpdateCount === 0) return;
    refreshEmails(activeFolder);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailUpdateCount]);

  // ── Compose-Bereich in den sichtbaren Bereich scrollen ──────────────────────
  useEffect(() => {
    if (compose && composeRef.current) {
      composeRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [compose]);

  // ── E-Mail-Aktionen ────────────────────────────────────────────────────────

  function handleSelectEmail(email: Email) {
    setLinksOpen(false);
    // Entwürfe direkt im Compose-Formular öffnen
    if (email.folder === "draft") {
      setSelectedEmail(email);
      setCompose({
        mode: "draft",
        to: email.toAddress ?? "",
        cc: email.cc ?? "",
        bcc: email.bcc ?? "",
        subject: email.subject,
        body: email.body,
        draftId: email.id,
      });
      return;
    }

    setSelectedEmail(email);
    setCompose(null);
    setDraftExpanded(false);
    setLegalExpanded(!!email.aiLegal);
    if (!email.read) {
      setEmailList((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, read: true } : e))
      );
      setSelectedEmail({ ...email, read: true });
      fetch(`/api/emails/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
    }
  }

  function toggleStar(emailId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const target = emailList.find((em) => em.id === emailId);
    if (!target) return;
    const newStarred = !target.starred;
    setEmailList((prev) =>
      prev.map((em) => (em.id === emailId ? { ...em, starred: newStarred } : em))
    );
    if (selectedEmail?.id === emailId) {
      setSelectedEmail((prev) => (prev ? { ...prev, starred: newStarred } : prev));
    }
    fetch(`/api/emails/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: newStarred }),
    });
  }

  // ── Antworten / Weiterleiten / Löschen ──────────────────────────────────────

  function handleReply() {
    if (!selectedEmail) return;
    setCompose({
      mode: "reply",
      to: selectedEmail.from,
      cc: "",
      bcc: "",
      subject: selectedEmail.subject.startsWith("Re:") ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
      body: `\n\n--- Ursprüngliche Nachricht ---\nVon: ${selectedEmail.fromName} <${selectedEmail.from}>\nAm: ${formatFullDate(selectedEmail.date)}\n\n${selectedEmail.body}`,
      inReplyTo: selectedEmail.id,
    });
  }

  function handleForward() {
    if (!selectedEmail) return;
    setCompose({
      mode: "forward",
      to: "",
      cc: "",
      bcc: "",
      subject: selectedEmail.subject.startsWith("Fwd:") ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`,
      body: `\n\n--- Weitergeleitete Nachricht ---\nVon: ${selectedEmail.fromName} <${selectedEmail.from}>\nAm: ${formatFullDate(selectedEmail.date)}\nBetreff: ${selectedEmail.subject}\n\n${selectedEmail.body}`,
    });
  }

  function handleNewEmail() {
    setSelectedEmail(null);
    setCompose({
      mode: "new",
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
    });
  }

  async function handleSend() {
    if (!compose) return;
    setSending(true);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: compose.to,
          ...(compose.cc.trim() ? { cc: compose.cc.trim() } : {}),
          ...(compose.bcc.trim() ? { bcc: compose.bcc.trim() } : {}),
          subject: compose.subject,
          text: compose.body,
          ...(compose.inReplyTo ? { in_reply_to: compose.inReplyTo } : {}),
          ...(compose.draftId ? { draft_id: compose.draftId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Fehler beim Senden: ${data.error}`);
        return;
      }
      setCompose(null);
      // Falls aus Entwürfe-Ordner gesendet: Liste aktualisieren
      if (activeFolder === "draft") {
        await loadEmails("draft");
        setSelectedEmail(null);
      }
    } catch {
      alert("Verbindungsfehler beim Senden");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    if (!compose) return;
    setSavingDraft(true);
    try {
      const res = await fetch("/api/emails/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(compose.draftId ? { id: compose.draftId } : {}),
          to: compose.to,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.subject,
          text: compose.body,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Fehler beim Speichern: ${data.error}`);
        return;
      }
      setCompose(null);
      // Entwürfe-Liste aktualisieren, falls wir dort sind
      if (activeFolder === "draft") {
        await loadEmails("draft");
      }
    } catch {
      alert("Verbindungsfehler beim Speichern");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDelete(emailId: string) {
    if (!confirm("E-Mail endgültig löschen?")) return;
    setDeleting(emailId);
    try {
      const res = await fetch(`/api/emails/${emailId}`, { method: "DELETE" });
      if (res.ok) {
        setEmailList((prev) => prev.filter((e) => e.id !== emailId));
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
          setCompose(null);
        }
        setSelectedIds((prev) => {
          if (!prev.has(emailId)) return prev;
          const next = new Set(prev);
          next.delete(emailId);
          return next;
        });
      }
    } finally {
      setDeleting(null);
    }
  }

  function toggleSelected(emailId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelectAll(visibleIds: string[]) {
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/emails/${id}`, { method: "DELETE" }))
      );
      const successIds = ids.filter((_, i) => {
        const r = results[i];
        return r.status === "fulfilled" && r.value.ok;
      });
      if (successIds.length > 0) {
        const successSet = new Set(successIds);
        setEmailList((prev) => prev.filter((e) => !successSet.has(e.id)));
        if (selectedEmail && successSet.has(selectedEmail.id)) {
          setSelectedEmail(null);
          setCompose(null);
        }
      }
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  }

  // Auswahl beim Ordnerwechsel zurücksetzen
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeFolder]);

  // Verknüpfungen-Panel öffnen und Daten laden
  async function openLinks() {
    setLinksOpen(true);
    if (linkContacts.length > 0) return; // bereits geladen
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

  async function saveLink(field: string, value: string | null) {
    if (!selectedEmail) return;
    setLinksSaving(true);
    const res = await fetch(`/api/emails/${selectedEmail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const updated = { ...selectedEmail, [toCamel(field)]: value };
      setSelectedEmail(updated);
      setEmailList((prev) => prev.map((e) => (e.id === selectedEmail.id ? updated : e)));
    }
    setLinksSaving(false);
  }

  function toCamel(field: string): keyof Email {
    const map: Record<string, keyof Email> = {
      linked_contact_id: "linkedContactId",
      linked_property_id: "linkedPropertyId",
      linked_ticket_id: "linkedTicketId",
      linked_contract_id: "linkedContractId",
    };
    return map[field] ?? (field as keyof Email);
  }

  async function handleLegalAssess() {
    if (!selectedEmail || legalizing) return;
    setLegalizing(true);
    setLegalExpanded(true);
    try {
      const res = await fetch(`/api/emails/${selectedEmail.id}/legal`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Fehler bei der rechtlichen Bewertung: ${data.error}`);
        return;
      }
      const { legal } = await res.json();
      const updated = { ...selectedEmail, aiLegal: legal };
      setSelectedEmail(updated);
      setEmailList((prev) =>
        prev.map((e) => (e.id === selectedEmail.id ? { ...e, aiLegal: legal } : e))
      );
    } catch {
      alert("Verbindungsfehler bei der rechtlichen Bewertung");
    } finally {
      setLegalizing(false);
    }
  }

  async function handleLegalDelete() {
    if (!selectedEmail) return;
    await fetch(`/api/emails/${selectedEmail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_legal: "" }),
    });
    const updated = { ...selectedEmail, aiLegal: "" };
    setSelectedEmail(updated);
    setEmailList((prev) =>
      prev.map((e) => (e.id === selectedEmail.id ? { ...e, aiLegal: "" } : e))
    );
  }

  async function handleGenerateDraft() {
    if (!selectedEmail || generatingDraft) return;
    setGeneratingDraft(true);
    try {
      const res = await fetch(`/api/emails/${selectedEmail.id}/draft`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Fehler bei der Antwortgenerierung: ${data.error}`);
        return;
      }
      const { draft } = await res.json();
      setCompose((c) => {
        if (!c) return c;
        const sep = "--- Ursprüngliche Nachricht ---";
        const idx = c.body.indexOf(sep);
        const quoted = idx !== -1 ? "\n\n" + c.body.substring(idx) : "";
        return { ...c, body: draft + quoted };
      });
    } catch {
      alert("Verbindungsfehler bei der Antwortgenerierung");
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function handleSummarize() {
    if (!selectedEmail || summarizing) return;
    setSummarizing(true);
    try {
      const res = await fetch(`/api/emails/${selectedEmail.id}/summarize`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Fehler bei der Zusammenfassung: ${data.error}`);
        return;
      }
      const { summary } = await res.json();
      // Lokal aktualisieren
      const updated = { ...selectedEmail, aiSummary: summary };
      setSelectedEmail(updated);
      setEmailList((prev) =>
        prev.map((e) => (e.id === selectedEmail.id ? { ...e, aiSummary: summary } : e))
      );
    } catch {
      alert("Verbindungsfehler bei der Zusammenfassung");
    } finally {
      setSummarizing(false);
    }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const unreadCount = emailList.filter((e) => !e.read && e.folder === "inbox").length;
  const draftCount = activeFolder === "draft" ? emailList.length : 0;

  const hasAdvancedFilters =
    !!advancedFilters.from || !!advancedFilters.subject ||
    !!advancedFilters.dateFrom || !!advancedFilters.dateTo ||
    advancedFilters.unreadOnly || advancedFilters.starredOnly;

  const filteredEmails = emailList.filter((e) => {
    if (activeFolder === "inbox" && categoryFilter !== "alle" && e.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !e.fromName.toLowerCase().includes(q) &&
        !e.from.toLowerCase().includes(q) &&
        !e.subject.toLowerCase().includes(q) &&
        !e.body.toLowerCase().includes(q)
      ) return false;
    }
    if (advancedFilters.from) {
      const f = advancedFilters.from.toLowerCase();
      if (!e.fromName.toLowerCase().includes(f) && !e.from.toLowerCase().includes(f)) return false;
    }
    if (advancedFilters.subject && !e.subject.toLowerCase().includes(advancedFilters.subject.toLowerCase())) return false;
    if (advancedFilters.dateFrom && e.date.slice(0, 10) < advancedFilters.dateFrom) return false;
    if (advancedFilters.dateTo && e.date.slice(0, 10) > advancedFilters.dateTo) return false;
    if (advancedFilters.unreadOnly && e.read) return false;
    if (advancedFilters.starredOnly && !e.starred) return false;
    return true;
  });

  // ── Ordner-Titel ──────────────────────────────────────────────────────────

  const folderTitle = activeFolder === "inbox" ? "Posteingang" : activeFolder === "sent" ? "Gesendet" : "Entwürfe";

  return (
    <>
      {showSetup && (
        <SetupDialog
          onClose={() => setShowSetup(false)}
          onSaved={() => {
            loadCredentials();
            loadEmails("inbox");
          }}
        />
      )}

      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-gray-950">
        {/* ── Linkes Panel ─────────────────────────────────────────── */}
        <div
          style={{ width: panelWidth, minWidth: 220, maxWidth: 560 }}
          className="flex flex-col flex-shrink-0 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">
                  {folderTitle}
                </h1>
                {account?.email && (
                  <p className="text-xs truncate text-gray-400 dark:text-gray-500">
                    {account.email}
                  </p>
                )}
              </div>
              {activeFolder === "inbox" && unreadCount > 0 && (
                <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                  {unreadCount}
                </span>
              )}
              <button
                onClick={handleNewEmail}
                title="Neue E-Mail verfassen"
                className="flex-shrink-0 p-1.5 rounded-lg transition-colors
                  bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Ordner-Tabs */}
            <div className="flex gap-1 mb-3 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
              {folderConfig.map((f) => {
                const isActive = activeFolder === f.key;
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => handleFolderChange(f.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Suchleiste */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="E-Mails durchsuchen..."
                    className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border transition-colors
                      bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                      dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  title="Erweiterte Suche"
                  className={`relative p-1.5 rounded-lg border transition-colors flex-shrink-0 ${
                    showAdvanced || hasAdvancedFilters
                      ? "bg-indigo-500/15 border-indigo-400/40 text-indigo-600 dark:text-indigo-400"
                      : "border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:border-gray-700 dark:text-gray-400"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {hasAdvancedFilters && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </button>
              </div>

              {/* Erweiterte Suche */}
              {showAdvanced && (
                <div className="mt-2 p-3 rounded-lg border space-y-2.5
                  bg-gray-50 border-gray-200 dark:bg-gray-800/60 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium mb-1 text-gray-500 dark:text-gray-400">Absender</label>
                      <input
                        type="text"
                        value={advancedFilters.from}
                        onChange={(e) => setAdvancedFilters((f) => ({ ...f, from: e.target.value }))}
                        placeholder="Name oder E-Mail"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border transition-colors
                          bg-white border-gray-200 text-gray-900 placeholder-gray-400
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                          dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium mb-1 text-gray-500 dark:text-gray-400">Betreff</label>
                      <input
                        type="text"
                        value={advancedFilters.subject}
                        onChange={(e) => setAdvancedFilters((f) => ({ ...f, subject: e.target.value }))}
                        placeholder="Im Betreff suchen"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border transition-colors
                          bg-white border-gray-200 text-gray-900 placeholder-gray-400
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                          dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium mb-1 text-gray-500 dark:text-gray-400">Datum von</label>
                      <input
                        type="date"
                        value={advancedFilters.dateFrom}
                        onChange={(e) => setAdvancedFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border transition-colors
                          bg-white border-gray-200 text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                          dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium mb-1 text-gray-500 dark:text-gray-400">Datum bis</label>
                      <input
                        type="date"
                        value={advancedFilters.dateTo}
                        onChange={(e) => setAdvancedFilters((f) => ({ ...f, dateTo: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border transition-colors
                          bg-white border-gray-200 text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                          dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={advancedFilters.unreadOnly}
                        onChange={(e) => setAdvancedFilters((f) => ({ ...f, unreadOnly: e.target.checked }))}
                        className="w-3 h-3 rounded accent-indigo-500"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Nur ungelesen</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={advancedFilters.starredOnly}
                        onChange={(e) => setAdvancedFilters((f) => ({ ...f, starredOnly: e.target.checked }))}
                        className="w-3 h-3 rounded accent-indigo-500"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Nur markiert</span>
                    </label>
                    {hasAdvancedFilters && (
                      <button
                        onClick={() => setAdvancedFilters({ from: "", subject: "", dateFrom: "", dateTo: "", unreadOnly: false, starredOnly: false })}
                        className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Zurücksetzen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sync-Bar — nur im Posteingang */}
            {activeFolder === "inbox" && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={handleSync}
                  disabled={syncing || !account}
                  title={account ? "Jetzt manuell synchronisieren" : "Bitte zuerst IMAP einrichten"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    border border-gray-200 text-gray-600 hover:border-indigo-400/50 hover:text-indigo-600
                    dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {syncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-3.5 h-3.5" />
                  )}
                  {syncing ? "Synchronisiert..." : "Sync"}
                </button>

                {account && !syncing && (
                  liveConnected ? (
                    <div
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium
                        bg-emerald-50 text-emerald-600 border border-emerald-200
                        dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                      title="IMAP IDLE aktiv — neue E-Mails werden sofort erkannt"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      Live
                    </div>
                  ) : null
                )}

                <button
                  onClick={() => setShowSetup(true)}
                  title="IMAP-Einstellungen"
                  className="p-1.5 rounded-lg text-gray-400 transition-colors hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1 text-right">
                  {syncStatus ? (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">
                      {syncStatus}
                    </span>
                  ) : account?.last_sync_at ? (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatSyncTime(account.last_sync_at)}
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {/* Sync-Fehler */}
            {activeFolder === "inbox" && account?.sync_error && (
              <div className="flex items-start gap-2 mb-3 text-xs p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{account.sync_error}</span>
              </div>
            )}

            {/* Kategorie-Filter — nur im Posteingang */}
            {activeFolder === "inbox" && (
              <div className="flex flex-wrap gap-1.5">
                {filterPills.map((pill) => {
                  const isActive = categoryFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => setCategoryFilter(pill.key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isActive
                          ? pill.activeClass
                          : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bulk-Action-Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-indigo-50 dark:bg-indigo-500/10">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-medium text-indigo-700 dark:text-indigo-300">
                  {selectedIds.size} ausgewählt
                </span>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(filteredEmails.map((e) => e.id))}
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {filteredEmails.every((e) => selectedIds.has(e.id))
                    ? "Auswahl aufheben"
                    : "Alle auswählen"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={bulkDeleting}
                  className="px-2.5 py-1 text-xs rounded-md text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md
                    bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {bulkDeleting
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />
                  }
                  {selectedIds.size > 1 ? `${selectedIds.size} löschen` : "Löschen"}
                </button>
              </div>
            </div>
          )}

          {/* E-Mail-Liste */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                {activeFolder === "inbox" ? (
                  <Mail className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                ) : activeFolder === "sent" ? (
                  <SendHorizonal className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                ) : (
                  <FileEdit className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                    {searchQuery || hasAdvancedFilters
                      ? "Keine Ergebnisse"
                      : activeFolder === "inbox" && !account
                      ? "IMAP nicht konfiguriert"
                      : activeFolder === "inbox"
                      ? "Keine E-Mails"
                      : activeFolder === "sent"
                      ? "Keine gesendeten E-Mails"
                      : "Keine Entwürfe"}
                  </p>
                  {(searchQuery || hasAdvancedFilters) && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setAdvancedFilters({ from: "", subject: "", dateFrom: "", dateTo: "", unreadOnly: false, starredOnly: false });
                      }}
                      className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Suche zurücksetzen
                    </button>
                  )}
                  {activeFolder === "inbox" && !account && (
                    <button
                      onClick={() => setShowSetup(true)}
                      className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Jetzt einrichten
                    </button>
                  )}
                  {activeFolder === "inbox" && account && emailList.length === 0 && (
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {syncing ? "Lädt..." : "E-Mails jetzt abrufen"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                const isChecked = selectedIds.has(email.id);
                const isSelectMode = selectedIds.size > 0;
                const cfg = categoryConfig[email.category];
                const isSentOrDraft = email.folder === "sent" || email.folder === "draft";

                return (
                  <div
                    key={email.id}
                    onClick={() => {
                      if (isSelectMode) toggleSelected(email.id);
                      else handleSelectEmail(email);
                    }}
                    className={`relative px-4 py-3.5 cursor-pointer border-b transition-colors group
                      border-gray-100 dark:border-gray-800
                      ${isChecked
                        ? "bg-indigo-100/60 dark:bg-indigo-500/15"
                        : isSelected
                          ? "bg-indigo-50 border-l-2 border-l-indigo-500 dark:bg-indigo-500/8"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1 w-4 h-4 flex items-center justify-center">
                        {(isSelectMode || isChecked) ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelected(email.id)}
                            className="w-3.5 h-3.5 rounded cursor-pointer"
                          />
                        ) : (
                          <>
                            {!email.read && (
                              <span className="block w-2 h-2 rounded-full bg-blue-500 group-hover:hidden" />
                            )}
                            <input
                              type="checkbox"
                              checked={false}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelected(email.id)}
                              className={`w-3.5 h-3.5 rounded cursor-pointer ${email.read ? "opacity-0 group-hover:opacity-100" : "hidden group-hover:block"}`}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className={`text-sm font-medium truncate ${
                              !email.read
                                ? "text-gray-900 dark:text-white"
                                : "text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {isSentOrDraft
                              ? `An: ${email.toAddress || "(kein Empfänger)"}`
                              : email.fromName}
                          </span>
                          <span className="text-xs flex-shrink-0 text-gray-400 dark:text-gray-500">
                            {formatTime(email.date)}
                          </span>
                        </div>
                        <p
                          className={`text-xs truncate mb-1.5 ${
                            !email.read
                              ? "font-medium text-gray-800 dark:text-gray-200"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {email.subject}
                        </p>
                        <div className="flex items-center gap-2">
                          {activeFolder === "inbox" && (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.pill}`}
                            >
                              {cfg.label}
                            </span>
                          )}
                          {email.folder === "draft" && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border bg-orange-500/10 text-orange-600 border-orange-400/20 dark:text-orange-400">
                              Entwurf
                            </span>
                          )}
                        </div>
                      </div>
                      {activeFolder !== "draft" && (
                        <button
                          onClick={(e) => toggleStar(email.id, e)}
                          className="flex-shrink-0 mt-0.5 p-0.5 transition-colors"
                        >
                          <Star
                            className={`w-3.5 h-3.5 transition-colors ${
                              email.starred
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                            }`}
                          />
                        </button>
                      )}
                      {activeFolder === "draft" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(email.id);
                          }}
                          className="flex-shrink-0 mt-0.5 p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                          title="Entwurf löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Resize-Handle ──────────────────────────────────────── */}
        <div
          onMouseDown={(e) => {
            isResizingRef.current = true;
            resizeStartXRef.current = e.clientX;
            resizeStartWidthRef.current = panelWidth;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            e.preventDefault();
          }}
          className="relative flex-shrink-0 w-2 cursor-col-resize group z-10"
        >
          {/* Trennlinie */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px
            bg-gray-200 dark:bg-gray-800
            group-hover:bg-indigo-400/70 group-hover:w-0.5 transition-all duration-150" />
          {/* Grip-Indikator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[3px] h-[3px] rounded-full bg-indigo-400" />
            ))}
          </div>
        </div>

        {/* ── Rechtes Panel ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">
          {/* Compose-Formular (für Entwürfe oder Antworten) */}
          {compose && (activeFolder === "draft" || selectedEmail || compose.mode === "new") ? (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div ref={composeRef} className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    {compose.mode === "reply" ? (
                      <Reply className="w-4 h-4 text-indigo-500" />
                    ) : compose.mode === "forward" ? (
                      <Forward className="w-4 h-4 text-cyan-500" />
                    ) : compose.mode === "new" ? (
                      <Mail className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <FileEdit className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {compose.mode === "reply" ? "Antworten" : compose.mode === "forward" ? "Weiterleiten" : compose.mode === "new" ? "Neue E-Mail" : "Entwurf bearbeiten"}
                    </span>
                  </div>
                  <button
                    onClick={() => setCompose(null)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                  {/* An */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">An</label>
                    <input
                      type="email"
                      value={compose.to}
                      onChange={(e) => setCompose((c) => c ? { ...c, to: e.target.value } : c)}
                      placeholder="empfaenger@email.de"
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                        bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                        dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                    />
                  </div>

                  {/* CC */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">CC</label>
                    <input
                      type="email"
                      value={compose.cc}
                      onChange={(e) => setCompose((c) => c ? { ...c, cc: e.target.value } : c)}
                      placeholder="cc@email.de"
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                        bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                        dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                    />
                  </div>

                  {/* BCC */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">BCC</label>
                    <input
                      type="email"
                      value={compose.bcc}
                      onChange={(e) => setCompose((c) => c ? { ...c, bcc: e.target.value } : c)}
                      placeholder="bcc@email.de"
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                        bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                        dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                    />
                  </div>

                  {/* Betreff */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Betreff</label>
                    <input
                      type="text"
                      value={compose.subject}
                      onChange={(e) => setCompose((c) => c ? { ...c, subject: e.target.value } : c)}
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                        bg-gray-50 border-gray-200 text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                        dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                  </div>

                  {/* Nachricht */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Nachricht</label>
                      {compose.mode === "reply" && selectedEmail && (
                        <button
                          type="button"
                          onClick={handleGenerateDraft}
                          disabled={generatingDraft}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                            border border-cyan-300 text-cyan-600 hover:bg-cyan-50
                            dark:border-cyan-500/40 dark:text-cyan-400 dark:hover:bg-cyan-500/10
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generatingDraft ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          {generatingDraft ? "Generiert..." : "KI-Antwort"}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={compose.body}
                      onChange={(e) => setCompose((c) => c ? { ...c, body: e.target.value } : c)}
                      rows={12}
                      className="w-full px-3 py-2 text-sm rounded-lg border transition-colors resize-y
                        bg-gray-50 border-gray-200 text-gray-900
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                        dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSend}
                      disabled={sending || !compose.to.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      {sending ? "Wird gesendet..." : "Senden"}
                    </button>
                    <button
                      onClick={handleSaveDraft}
                      disabled={savingDraft}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                        border border-orange-300 text-orange-600 hover:bg-orange-50
                        dark:border-orange-500/40 dark:text-orange-400 dark:hover:bg-orange-500/10
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingDraft ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileEdit className="w-3.5 h-3.5" />
                      )}
                      {savingDraft ? "Speichert..." : "Als Entwurf speichern"}
                    </button>
                    <button
                      onClick={() => setCompose(null)}
                      className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                        border border-gray-200 text-gray-600 hover:bg-gray-100
                        dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedEmail && selectedEmail.folder !== "draft" ? (
            <>
              {/* E-Mail-Header */}
              <div className="px-6 pt-6 pb-5 border-b flex-shrink-0 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-xl font-semibold leading-tight text-gray-900 dark:text-white">
                    {selectedEmail.subject}
                  </h2>
                  <button
                    onClick={(e) => toggleStar(selectedEmail.id, e)}
                    className="flex-shrink-0 p-1 mt-0.5"
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        selectedEmail.starred
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  {selectedEmail.folder === "sent" ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 dark:text-gray-500">An:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {selectedEmail.toAddress || "(kein Empfänger)"}
                        </span>
                      </div>
                      {selectedEmail.cc && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 dark:text-gray-500">CC:</span>
                          <span className="text-gray-600 dark:text-gray-400">{selectedEmail.cc}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 dark:text-gray-500">Von:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {selectedEmail.fromName}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-600">
                          &lt;{selectedEmail.from}&gt;
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400 dark:text-gray-500">Am:</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatFullDate(selectedEmail.date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    {activeFolder === "inbox" && (
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${
                          categoryConfig[selectedEmail.category].pill
                        }`}
                      >
                        {categoryConfig[selectedEmail.category].label}
                      </span>
                    )}
                    {activeFolder === "sent" && (
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium border bg-cyan-500/10 text-cyan-600 border-cyan-400/20 dark:text-cyan-400">
                        Gesendet
                      </span>
                    )}
                  </div>

                  {/* Aktionen */}
                  <div className="flex items-center gap-1">
                    {activeFolder === "inbox" && (
                      <>
                        <button
                          onClick={handleSummarize}
                          disabled={summarizing}
                          title="KI-Zusammenfassung erstellen"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                            border border-purple-300 text-purple-600 hover:border-purple-400/50 hover:bg-purple-50
                            dark:border-purple-500/40 dark:text-purple-400 dark:hover:border-purple-500/50 dark:hover:bg-purple-500/10
                            disabled:opacity-50"
                        >
                          {summarizing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {summarizing ? "Fasst zusammen..." : "Zusammenfassen"}
                        </button>
                        <button
                          onClick={handleLegalAssess}
                          disabled={legalizing}
                          title="Rechtliche Bewertung durch Berko AI erstellen"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                            border border-amber-300 text-amber-600 hover:border-amber-400/50 hover:bg-amber-50
                            dark:border-amber-500/40 dark:text-amber-400 dark:hover:border-amber-500/50 dark:hover:bg-amber-500/10
                            disabled:opacity-50"
                        >
                          {legalizing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Scale className="w-3.5 h-3.5" />
                          )}
                          {legalizing ? "Bewertet..." : "Rechtlich bewerten"}
                        </button>
                        <button
                          onClick={handleReply}
                          title="Antworten"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                            border border-gray-200 text-gray-600 hover:border-indigo-400/50 hover:text-indigo-600 hover:bg-indigo-50
                            dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400 dark:hover:bg-indigo-500/10"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          Antworten
                        </button>
                        <button
                          onClick={handleForward}
                          title="Weiterleiten"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                            border border-gray-200 text-gray-600 hover:border-cyan-400/50 hover:text-cyan-600 hover:bg-cyan-50
                            dark:border-gray-700 dark:text-gray-400 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400 dark:hover:bg-cyan-500/10"
                        >
                          <Forward className="w-3.5 h-3.5" />
                          Weiterleiten
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(selectedEmail.id)}
                      disabled={deleting === selectedEmail.id}
                      title="Löschen"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50
                        dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-500/50 dark:hover:text-red-400 dark:hover:bg-red-500/10
                        disabled:opacity-50"
                    >
                      {deleting === selectedEmail.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Löschen
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollbarer Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* KI-Zusammenfassung — immer sichtbar */}
                {activeFolder === "inbox" && (
                  <div className="relative rounded-xl p-px bg-gradient-to-br from-indigo-500/40 via-cyan-500/20 to-purple-500/30">
                    <div className="rounded-[11px] px-4 py-4 bg-white dark:bg-gray-900">
                      <div className="flex items-center gap-2 mb-2">
                        {summarizing ? (
                          <Loader2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Berko AI KI-Zusammenfassung
                        </span>
                      </div>
                      {summarizing ? (
                        <p className="text-sm leading-relaxed text-gray-400 dark:text-gray-500 animate-pulse">
                          Zusammenfassung wird erstellt...
                        </p>
                      ) : selectedEmail.aiSummary ? (
                        <MarkdownContent content={selectedEmail.aiSummary} />
                      ) : (
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-gray-400 dark:text-gray-500">
                            Noch keine Zusammenfassung vorhanden.
                          </p>
                          <button
                            onClick={handleSummarize}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                              bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90"
                          >
                            <Sparkles className="w-3 h-3" />
                            Jetzt erstellen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rechtliche Bewertung — immer sichtbar im Posteingang */}
                {activeFolder === "inbox" && (
                  <div className="rounded-xl border overflow-hidden bg-white border-amber-200 dark:bg-gray-900 dark:border-amber-500/30">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <button
                        onClick={() => setLegalExpanded((v) => !v)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        {legalizing ? (
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
                        ) : (
                          <Scale className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Berko AI Rechtliche Bewertung
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 flex-shrink-0">
                          Berko AI
                        </span>
                        <span className="ml-1 flex-shrink-0">
                          {legalExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                        </span>
                      </button>

                      {/* Aktionen — immer sichtbar */}
                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        {selectedEmail.aiLegal && !legalizing && (
                          <button
                            onClick={handleLegalDelete}
                            title="Bewertung löschen"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                              dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={handleLegalAssess}
                          disabled={legalizing}
                          title={selectedEmail.aiLegal ? "Neu bewerten" : "Rechtlich bewerten"}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                            border border-amber-300 text-amber-600 hover:bg-amber-50
                            dark:border-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-500/10
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {legalizing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Scale className="w-3 h-3" />
                          )}
                          {legalizing ? "Läuft..." : selectedEmail.aiLegal ? "Neu" : "Erstellen"}
                        </button>
                      </div>
                    </div>

                    {/* Inhalt */}
                    {legalExpanded && (
                      <div className="px-5 pb-5 border-t border-amber-100 dark:border-amber-500/20">
                        {legalizing ? (
                          <div className="pt-4 space-y-2">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`h-3 rounded bg-amber-100 dark:bg-amber-500/10 animate-pulse ${i === 4 ? "w-2/3" : "w-full"}`}
                              />
                            ))}
                            <p className="text-xs text-amber-500 dark:text-amber-400 pt-1">
                              Berko AI analysiert den Sachverhalt...
                            </p>
                          </div>
                        ) : selectedEmail.aiLegal ? (
                          <div className="pt-4">
                            <MarkdownContent content={selectedEmail.aiLegal} />
                          </div>
                        ) : (
                          <div className="pt-4 flex items-center gap-3">
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                              Noch keine rechtliche Bewertung vorhanden.
                            </p>
                            <button
                              onClick={handleLegalAssess}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity
                                bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 flex-shrink-0"
                            >
                              <Scale className="w-3 h-3" />
                              Jetzt erstellen
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Verknüpfungen */}
                <div className="rounded-xl border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { if (!linksOpen) openLinks(); else setLinksOpen(false); }}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verknüpfungen</span>
                      {(selectedEmail.linkedContactId || selectedEmail.linkedPropertyId || selectedEmail.linkedTicketId || selectedEmail.linkedContractId) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                          {[selectedEmail.linkedContactId, selectedEmail.linkedPropertyId, selectedEmail.linkedTicketId, selectedEmail.linkedContractId].filter(Boolean).length}
                        </span>
                      )}
                    </div>
                    {linksOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {linksOpen && (
                    <div className="px-5 pb-5 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
                      {linkLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <>
                          {/* Kontakt */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Kontakt</label>
                            <div className="flex gap-2">
                              <Combobox
                                value={selectedEmail.linkedContactId ?? ""}
                                onChange={(v) => saveLink("linked_contact_id", v || null)}
                                options={linkContacts.map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
                                placeholder="Kontakt zuordnen…"
                                className="flex-1"
                              />
                              {selectedEmail.linkedContactId && (
                                <a href={`/kontakte/${selectedEmail.linkedContactId}`} target="_blank" rel="noreferrer"
                                  className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 transition-colors whitespace-nowrap">
                                  Öffnen
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Objekt */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Objekt</label>
                            <div className="flex gap-2">
                              <Combobox
                                value={selectedEmail.linkedPropertyId ?? ""}
                                onChange={(v) => saveLink("linked_property_id", v || null)}
                                options={linkProperties.map((p) => ({ value: p.id, label: p.name }))}
                                placeholder="Objekt zuordnen…"
                                className="flex-1"
                              />
                              {selectedEmail.linkedPropertyId && (
                                <a href={`/objekte/${selectedEmail.linkedPropertyId}`} target="_blank" rel="noreferrer"
                                  className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 transition-colors whitespace-nowrap">
                                  Öffnen
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Vorgang */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vorgang</label>
                            <div className="flex gap-2">
                              <Combobox
                                value={selectedEmail.linkedTicketId ?? ""}
                                onChange={(v) => saveLink("linked_ticket_id", v || null)}
                                options={linkTickets.map((t) => ({ value: t.id, label: t.title }))}
                                placeholder="Vorgang zuordnen…"
                                className="flex-1"
                              />
                              {selectedEmail.linkedTicketId && (
                                <a href={`/vorgaenge/${selectedEmail.linkedTicketId}`} target="_blank" rel="noreferrer"
                                  className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 transition-colors whitespace-nowrap">
                                  Öffnen
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Vertrag */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vertrag</label>
                            <div className="flex gap-2">
                              <Combobox
                                value={selectedEmail.linkedContractId ?? ""}
                                onChange={(v) => saveLink("linked_contract_id", v || null)}
                                options={linkContracts.map((c) => {
                                  const cr = c.contact_roles;
                                  const name = cr?.contacts ? contactDisplayName(cr.contacts) : "";
                                  const prop = cr?.properties?.name ?? "";
                                  const CONTRACT_LABELS: Record<string, string> = {
                                    rental_residential: "Wohnraummietvertrag",
                                    rental_commercial: "Gewerbemietvertrag",
                                    management_weg: "WEG-Verwaltung",
                                    management_mv: "MV-Verwaltung",
                                    management_se: "SE-Verwaltung",
                                  };
                                  return {
                                    value: c.id,
                                    label: [CONTRACT_LABELS[c.type] ?? c.type, name, prop].filter(Boolean).join(" · "),
                                  };
                                })}
                                placeholder="Vertrag zuordnen…"
                                className="flex-1"
                              />
                              {selectedEmail.linkedContractId && (
                                <a href={`/vertraege/${selectedEmail.linkedContractId}`} target="_blank" rel="noreferrer"
                                  className="px-2 py-1 text-xs rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10 transition-colors whitespace-nowrap">
                                  Öffnen
                                </a>
                              )}
                            </div>
                          </div>

                          {linksSaving && (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Wird gespeichert…
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* E-Mail-Body */}
                <div className="rounded-xl px-5 py-5 border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-700 dark:text-gray-300">
                    {selectedEmail.body}
                  </pre>
                </div>

                {/* KI-Antwort-Entwurf */}
                {selectedEmail.aiDraft && activeFolder === "inbox" && (
                  <div className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                    <button
                      onClick={() => setDraftExpanded((prev) => !prev)}
                      className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                        <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                          Berko AI Antwort-Entwurf
                        </span>
                      </div>
                      {draftExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      )}
                    </button>

                    {draftExpanded && (
                      <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800">
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed mt-4 mb-5 text-gray-700 dark:text-gray-300">
                          {selectedEmail.aiDraft}
                        </pre>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setCompose({
                                mode: "reply",
                                to: selectedEmail.from,
                                cc: "",
                                bcc: "",
                                subject: selectedEmail.subject.startsWith("Re:") ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
                                body: selectedEmail.aiDraft,
                                inReplyTo: selectedEmail.id,
                              });
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Als Antwort verwenden
                          </button>
                          <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors border bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700">
                            <Edit3 className="w-3.5 h-3.5" />
                            Bearbeiten
                          </button>
                          <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors border bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Neu generieren
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Compose — Antworten / Weiterleiten (innerhalb Inbox-Detailansicht) */}
                {compose && activeFolder !== "draft" && (
                  <div ref={composeRef} className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        {compose.mode === "reply" ? (
                          <Reply className="w-4 h-4 text-indigo-500" />
                        ) : (
                          <Forward className="w-4 h-4 text-cyan-500" />
                        )}
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {compose.mode === "reply" ? "Antworten" : "Weiterleiten"}
                        </span>
                      </div>
                      <button
                        onClick={() => setCompose(null)}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="px-5 py-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">An</label>
                        <input
                          type="email"
                          value={compose.to}
                          onChange={(e) => setCompose((c) => c ? { ...c, to: e.target.value } : c)}
                          placeholder="empfaenger@email.de"
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                            bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                            dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">CC</label>
                        <input
                          type="email"
                          value={compose.cc}
                          onChange={(e) => setCompose((c) => c ? { ...c, cc: e.target.value } : c)}
                          placeholder="cc@email.de"
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                            bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                            dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">BCC</label>
                        <input
                          type="email"
                          value={compose.bcc}
                          onChange={(e) => setCompose((c) => c ? { ...c, bcc: e.target.value } : c)}
                          placeholder="bcc@email.de"
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                            bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                            dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Betreff</label>
                        <input
                          type="text"
                          value={compose.subject}
                          onChange={(e) => setCompose((c) => c ? { ...c, subject: e.target.value } : c)}
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors
                            bg-gray-50 border-gray-200 text-gray-900
                            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                            dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Nachricht</label>
                          {compose.mode === "reply" && selectedEmail && (
                            <button
                              type="button"
                              onClick={handleGenerateDraft}
                              disabled={generatingDraft}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                                border border-cyan-300 text-cyan-600 hover:bg-cyan-50
                                dark:border-cyan-500/40 dark:text-cyan-400 dark:hover:bg-cyan-500/10
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {generatingDraft ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              {generatingDraft ? "Generiert..." : "KI-Antwort"}
                            </button>
                          )}
                        </div>
                        <textarea
                          value={compose.body}
                          onChange={(e) => setCompose((c) => c ? { ...c, body: e.target.value } : c)}
                          rows={10}
                          className="w-full px-3 py-2 text-sm rounded-lg border transition-colors resize-y
                            bg-gray-50 border-gray-200 text-gray-900
                            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                            dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleSend}
                          disabled={sending || !compose.to.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          {sending ? "Wird gesendet..." : "Senden"}
                        </button>
                        <button
                          onClick={handleSaveDraft}
                          disabled={savingDraft}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                            border border-orange-300 text-orange-600 hover:bg-orange-50
                            dark:border-orange-500/40 dark:text-orange-400 dark:hover:bg-orange-500/10
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingDraft ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileEdit className="w-3.5 h-3.5" />
                          )}
                          Als Entwurf speichern
                        </button>
                        <button
                          onClick={() => setCompose(null)}
                          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                            border border-gray-200 text-gray-600 hover:bg-gray-100
                            dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
              <Mail className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">Keine E-Mail ausgewählt</p>
              <p className="text-sm mt-1">Wählen Sie eine E-Mail aus der Liste aus</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
