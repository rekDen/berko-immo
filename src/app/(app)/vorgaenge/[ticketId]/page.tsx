"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Loader2, AlertTriangle, Trash2,
  Building2, Home, MessageSquare, Pencil, X, Check, Plus, Mail, Search,
} from "lucide-react";
import { contactDisplayName } from "@/types/crm";
import PersonAvatar from "@/components/crm/PersonAvatar";
import Combobox from "@/components/Combobox";

type CommunicationRow = {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  occurred_at: string;
};

type TicketDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  resolved_at: string | null;
  created_at: string;
  contacts: {
    id: string;
    type: "natural_person" | "legal_entity";
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    emails: { type: string; value: string }[];
    phones: { type: string; value: string }[];
  } | null;
  units: { id: string; unit_number: string; floor: string | null; property_id: string } | null;
  properties: {
    id: string;
    name: string;
    street: string | null;
    house_number: string | null;
    zip_code: string | null;
    city: string | null;
  } | null;
  communications: CommunicationRow[];
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: "Neu", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  in_progress: { label: "In Bearbeitung", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  waiting: { label: "Wartend", cls: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  resolved: { label: "Erledigt", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  closed: { label: "Geschlossen", cls: "bg-gray-100 text-gray-400 dark:bg-gray-800" },
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Dringend",
  high: "Hoch",
  normal: "Normal",
  low: "Niedrig",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "E-Mail",
  phone: "Telefonat",
  letter: "Brief",
  meeting: "Persönliches Meeting",
  online_meeting: "Online-Meeting",
  portal: "Portal",
  note: "Notiz",
};

const NOTE_CHANNELS: { value: string; label: string }[] = [
  { value: "phone", label: "Telefonat" },
  { value: "meeting", label: "Persönliches Meeting" },
  { value: "online_meeting", label: "Online-Meeting" },
  { value: "note", label: "Eigene Gedanken / Notiz" },
];

type EmailRow = {
  id: string;
  subject: string;
  from_name: string;
  from_address: string;
  date: string;
};

type EditableForm = {
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  contact_id: string;
  property_id: string;
  unit_id: string;
};

type ContactOption = {
  id: string;
  type: "natural_person" | "legal_entity";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; unit_number: string };

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditableForm | null>(null);
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  // Note form
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteChannel, setNoteChannel] = useState("note");
  const [noteSubject, setNoteSubject] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteOccurredAt, setNoteOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));

  // Email picker
  const [emailPickerOpen, setEmailPickerOpen] = useState(false);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailAssigning, setEmailAssigning] = useState<string | null>(null);

  // Communication edit
  const [editCommId, setEditCommId] = useState<string | null>(null);
  const [editComm, setEditComm] = useState({ channel: "", subject: "", body: "", occurred_at: "" });
  const [editCommSaving, setEditCommSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tickets/${ticketId}`);
    if (res.ok) setTicket(await res.json());
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  async function startEdit() {
    if (!ticket) return;
    setForm({
      title: ticket.title,
      description: ticket.description ?? "",
      category: ticket.category ?? "",
      priority: ticket.priority,
      status: ticket.status,
      contact_id: ticket.contacts?.id ?? "",
      property_id: ticket.properties?.id ?? "",
      unit_id: ticket.units?.id ?? "",
    });
    setError("");
    setEditing(true);

    const [c, p] = await Promise.all([
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/properties").then((r) => (r.ok ? r.json() : [])),
    ]);
    setContacts(c);
    setProperties(p);

    if (ticket.properties?.id) {
      const u = await fetch(`/api/properties/${ticket.properties.id}/units`).then((r) =>
        r.ok ? r.json() : []
      );
      setUnits(u);
    }
  }

  useEffect(() => {
    if (!editing || !form) return;
    if (!form.property_id) {
      setUnits([]);
      return;
    }
    fetch(`/api/properties/${form.property_id}/units`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setUnits);
  }, [editing, form?.property_id]); // eslint-disable-line react-hooks/exhaustive-deps

  function cancelEdit() {
    setEditing(false);
    setForm(null);
    setError("");
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError("");

    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        priority: form.priority,
        status: form.status,
        contact_id: form.contact_id || null,
        property_id: form.property_id || null,
        unit_id: form.unit_id || null,
      }),
    });

    if (res.ok) {
      await load();
      setEditing(false);
      setForm(null);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error ?? "Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Vorgang wirklich löschen?")) return;
    const res = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });
    if (res.ok) router.push("/vorgaenge");
  }

  function openNoteForm() {
    setNoteChannel("note");
    setNoteSubject("");
    setNoteBody("");
    setNoteOccurredAt(new Date().toISOString().slice(0, 16));
    setNoteOpen(true);
  }

  async function saveNote() {
    if (!noteBody.trim()) return;
    setNoteSaving(true);
    const res = await fetch(`/api/tickets/${ticketId}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: noteChannel,
        subject: noteSubject || null,
        body: noteBody,
        occurred_at: new Date(noteOccurredAt).toISOString(),
      }),
    });
    if (res.ok) {
      setNoteOpen(false);
      await load();
    }
    setNoteSaving(false);
  }

  async function openEmailPicker() {
    setEmailPickerOpen(true);
    setEmailLoading(true);
    const res = await fetch("/api/emails");
    if (res.ok) setEmails(await res.json());
    setEmailLoading(false);
  }

  async function assignEmail(emailId: string) {
    setEmailAssigning(emailId);
    const res = await fetch(`/api/tickets/${ticketId}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_id: emailId }),
    });
    if (res.ok) {
      setEmailPickerOpen(false);
      await load();
    }
    setEmailAssigning(null);
  }

  const filteredEmails = emailSearch
    ? emails.filter((e) =>
        [e.subject, e.from_name, e.from_address].some((f) =>
          f?.toLowerCase().includes(emailSearch.toLowerCase())
        )
      )
    : emails;

  function startEditComm(c: CommunicationRow) {
    setEditCommId(c.id);
    setEditComm({
      channel: c.channel,
      subject: c.subject ?? "",
      body: c.body ?? "",
      occurred_at: new Date(c.occurred_at).toISOString().slice(0, 16),
    });
  }

  function cancelEditComm() {
    setEditCommId(null);
  }

  async function saveEditComm() {
    if (!editCommId) return;
    setEditCommSaving(true);
    const res = await fetch(`/api/communications/${editCommId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: editComm.channel,
        subject: editComm.subject || null,
        body: editComm.body || null,
        occurred_at: new Date(editComm.occurred_at).toISOString(),
      }),
    });
    if (res.ok) {
      setEditCommId(null);
      await load();
    }
    setEditCommSaving(false);
  }

  async function deleteComm(c: CommunicationRow) {
    const isEmail = c.channel === "email";
    const msg = isEmail
      ? "E-Mail aus diesem Vorgang entfernen?"
      : "Eintrag wirklich löschen?";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/communications/${c.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Vorgang nicht gefunden</p>
      </div>
    );
  }

  const st = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.new;

  return (
    <div className="min-h-screen px-6 py-8 max-w-5xl mx-auto bg-slate-50 dark:bg-gray-950">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/vorgaenge" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Vorgänge
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300 truncate">{ticket.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="min-w-0 flex-1">
          {!editing ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.title}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>
                  {st.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {ticket.priority === "urgent" && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertTriangle className="w-3 h-3" /> {PRIORITY_LABELS[ticket.priority]}
                  </span>
                )}
                {ticket.priority !== "urgent" && (
                  <span>Priorität: {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</span>
                )}
                {ticket.category && <span>Kategorie: {ticket.category}</span>}
                <span>Erstellt: {new Date(ticket.created_at).toLocaleDateString("de-DE")}</span>
                {ticket.resolved_at && (
                  <span>Erledigt: {new Date(ticket.resolved_at).toLocaleDateString("de-DE")}</span>
                )}
              </div>
            </>
          ) : form && (
            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Titel"
                className="w-full text-xl font-bold rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Kategorie</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="z.B. Schadensmeldung"
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Priorität</label>
                  <Combobox
                    value={form.priority}
                    onChange={(v) => setForm({ ...form, priority: v })}
                    options={[
                      { value: "low", label: "Niedrig" },
                      { value: "normal", label: "Normal" },
                      { value: "high", label: "Hoch" },
                      { value: "urgent", label: "Dringend" },
                    ]}
                    placeholder="Priorität wählen…"
                    allowClear={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
                  <Combobox
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                    options={Object.entries(STATUS_LABELS).map(([value, { label }]) => ({ value, label }))}
                    placeholder="Status wählen…"
                    allowClear={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editing ? (
            <>
              <button
                onClick={startEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  border border-gray-200 text-gray-600 hover:bg-gray-50
                  dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Bearbeiten
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                  dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  border border-gray-200 text-gray-600 hover:bg-gray-50
                  dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Speichern
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {(editing || ticket.description) && (
            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Beschreibung</h3>
              {!editing ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              ) : form && (
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={5}
                  placeholder="Beschreibung des Vorgangs…"
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              )}
            </div>
          )}

          {/* Communications */}
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Kommunikation ({ticket.communications?.length ?? 0})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={openEmailPicker}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                    border border-gray-200 text-gray-600 hover:bg-gray-50
                    dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  E-Mail zuordnen
                </button>
                <button
                  onClick={openNoteForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                    bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Notiz hinzufügen
                </button>
              </div>
            </div>

            {noteOpen && (
              <div className="mb-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Typ</label>
                    <select
                      value={noteChannel}
                      onChange={(e) => setNoteChannel(e.target.value)}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    >
                      {NOTE_CHANNELS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Zeitpunkt</label>
                    <input
                      type="datetime-local"
                      value={noteOccurredAt}
                      onChange={(e) => setNoteOccurredAt(e.target.value)}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                </div>
                {noteChannel !== "note" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Betreff</label>
                    <input
                      value={noteSubject}
                      onChange={(e) => setNoteSubject(e.target.value)}
                      placeholder={noteChannel === "phone" ? "z.B. Rückruf zu Heizungsausfall" : "Thema des Meetings"}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    {noteChannel === "note" ? "Gedanken / Notiz" : "Inhalt / Gesprächsnotiz"}
                  </label>
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    rows={4}
                    placeholder={
                      noteChannel === "note"
                        ? "Was möchtest du festhalten?"
                        : "Was wurde besprochen?"
                    }
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setNoteOpen(false)}
                    disabled={noteSaving}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={saveNote}
                    disabled={noteSaving || !noteBody.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                      bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {noteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Speichern
                  </button>
                </div>
              </div>
            )}

            {(!ticket.communications || ticket.communications.length === 0) ? (
              <p className="text-sm text-gray-400 py-4 text-center">Keine Einträge</p>
            ) : (
              <div className="space-y-4">
                {ticket.communications
                  .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                  .map((c) => {
                    const isEmail = c.channel === "email";
                    const isEditing = editCommId === c.id;
                    return (
                      <div key={c.id} className="flex gap-3 group">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                            c.direction === "inbound"
                              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            <MessageSquare className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          {!isEditing ? (
                            <>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                                <span>·</span>
                                <span>{c.direction === "inbound" ? "Eingehend" : "Ausgehend"}</span>
                                <span>·</span>
                                <span>{new Date(c.occurred_at).toLocaleDateString("de-DE")}</span>
                                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {!isEmail && (
                                    <button
                                      onClick={() => startEditComm(c)}
                                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                                      title="Bearbeiten"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteComm(c)}
                                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                                    title={isEmail ? "Aus Vorgang entfernen" : "Löschen"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {c.subject && (
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                                  {c.subject}
                                </p>
                              )}
                              {c.body && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-3 whitespace-pre-wrap">
                                  {c.body}
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="space-y-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={editComm.channel}
                                  onChange={(e) => setEditComm({ ...editComm, channel: e.target.value })}
                                  className="text-sm rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                >
                                  {NOTE_CHANNELS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                <input
                                  type="datetime-local"
                                  value={editComm.occurred_at}
                                  onChange={(e) => setEditComm({ ...editComm, occurred_at: e.target.value })}
                                  className="text-sm rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                />
                              </div>
                              {editComm.channel !== "note" && (
                                <input
                                  value={editComm.subject}
                                  onChange={(e) => setEditComm({ ...editComm, subject: e.target.value })}
                                  placeholder="Betreff"
                                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                />
                              )}
                              <textarea
                                value={editComm.body}
                                onChange={(e) => setEditComm({ ...editComm, body: e.target.value })}
                                rows={3}
                                placeholder="Inhalt"
                                className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={cancelEditComm}
                                  disabled={editCommSaving}
                                  className="px-3 py-1 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Abbrechen
                                </button>
                                <button
                                  onClick={saveEditComm}
                                  disabled={editCommSaving || !editComm.body.trim()}
                                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                                >
                                  {editCommSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Speichern
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          {!editing ? (
            ticket.contacts && (
              <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Kontakt</h3>
                <Link
                  href={`/kontakte/${ticket.contacts.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50
                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <PersonAvatar
                    firstName={ticket.contacts.first_name}
                    lastName={ticket.contacts.last_name}
                    companyName={ticket.contacts.company_name}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {contactDisplayName(ticket.contacts)}
                  </span>
                </Link>
              </div>
            )
          ) : form && (
            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Kontakt</h3>
              <Combobox
                value={form.contact_id}
                onChange={(v) => setForm({ ...form, contact_id: v })}
                options={contacts.map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
                placeholder="Kontakt suchen…"
              />
            </div>
          )}

          {/* Property / Unit */}
          {!editing ? (
            (ticket.properties || ticket.units) && (
              <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Bezug</h3>
                {ticket.properties && (
                  <Link
                    href={`/objekte/${ticket.properties.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50
                      hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-2"
                  >
                    <Building2 className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{ticket.properties.name}</span>
                  </Link>
                )}
                {ticket.units && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <Home className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Einheit {ticket.units.unit_number}
                    </span>
                  </div>
                )}
              </div>
            )
          ) : form && (
            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Bezug</h3>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Objekt</label>
                <Combobox
                  value={form.property_id}
                  onChange={(v) => setForm({ ...form, property_id: v, unit_id: "" })}
                  options={properties.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Objekt suchen…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Einheit</label>
                <Combobox
                  value={form.unit_id}
                  onChange={(v) => setForm({ ...form, unit_id: v })}
                  options={units.map((u) => ({ value: u.id, label: u.unit_number }))}
                  placeholder="Einheit suchen…"
                  disabled={!form.property_id}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* E-Mail-Picker Modal */}
      {emailPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setEmailPickerOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">E-Mail dem Vorgang zuordnen</h3>
              <button
                onClick={() => setEmailPickerOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  placeholder="Nach Betreff oder Absender suchen…"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {emailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : filteredEmails.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">
                  {emails.length === 0 ? "Keine E-Mails im Posteingang" : `Keine Treffer für „${emailSearch}"`}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredEmails.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => assignEmail(e.id)}
                        disabled={emailAssigning !== null}
                        className="w-full text-left px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
                          <span className="truncate">{e.from_name} &lt;{e.from_address}&gt;</span>
                          <span>·</span>
                          <span className="flex-shrink-0">{new Date(e.date).toLocaleDateString("de-DE")}</span>
                          {emailAssigning === e.id && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {e.subject}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
