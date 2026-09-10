"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Mail, MessageSquare, Loader2, Pencil, Trash2,
  X, Check, Search, Phone, Users, Video, StickyNote,
} from "lucide-react";
import { contactDisplayName } from "@/types/crm";

type CommunicationRow = {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  ticket_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  tickets: { id: string; title: string } | null;
  contacts: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    type: "natural_person" | "legal_entity";
  } | null;
};

type EmailRow = {
  id: string;
  subject: string;
  from_name: string;
  from_address: string;
  date: string;
};

const NOTE_CHANNELS = [
  { value: "phone", label: "Telefonat", icon: Phone },
  { value: "meeting", label: "Persönliches Meeting", icon: Users },
  { value: "online_meeting", label: "Online-Meeting", icon: Video },
  { value: "note", label: "Eigene Gedanken / Notiz", icon: StickyNote },
];

const CHANNEL_LABELS: Record<string, string> = {
  email: "E-Mail",
  phone: "Telefonat",
  letter: "Brief",
  meeting: "Persönliches Meeting",
  online_meeting: "Online-Meeting",
  portal: "Portal",
  note: "Notiz",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "email", label: "E-Mail" },
  { value: "phone", label: "Telefonat" },
  { value: "meeting", label: "Persönlich" },
  { value: "online_meeting", label: "Online-Meeting" },
  { value: "note", label: "Notiz" },
];

type Props = {
  propertyId: string;
};

export default function PropertyCommunications({ propertyId }: Props) {
  const [communications, setCommunications] = useState<CommunicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

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

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ channel: "", subject: "", body: "", occurred_at: "" });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ property_id: propertyId });
    const res = await fetch(`/api/communications?${params}`);
    if (res.ok) setCommunications(await res.json());
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

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
    const res = await fetch("/api/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
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
    const res = await fetch("/api/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, email_id: emailId }),
    });
    if (res.ok) {
      setEmailPickerOpen(false);
      await load();
    }
    setEmailAssigning(null);
  }

  function startEdit(c: CommunicationRow) {
    setEditId(c.id);
    setEditForm({
      channel: c.channel,
      subject: c.subject ?? "",
      body: c.body ?? "",
      occurred_at: new Date(c.occurred_at).toISOString().slice(0, 16),
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    const res = await fetch(`/api/communications/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: editForm.channel,
        subject: editForm.subject || null,
        body: editForm.body || null,
        occurred_at: new Date(editForm.occurred_at).toISOString(),
      }),
    });
    if (res.ok) {
      setEditId(null);
      await load();
    }
    setEditSaving(false);
  }

  async function remove(c: CommunicationRow) {
    const isEmail = c.channel === "email";
    const msg = isEmail
      ? "E-Mail aus dieser Verknüpfung entfernen?"
      : "Eintrag wirklich löschen?";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/communications/${c.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const filtered = filter === "all"
    ? communications
    : communications.filter((c) => c.channel === filter);

  const filteredEmails = emailSearch
    ? emails.filter((e) =>
        [e.subject, e.from_name, e.from_address].some((f) =>
          f?.toLowerCase().includes(emailSearch.toLowerCase())
        )
      )
    : emails;

  return (
    <div className="space-y-4">
      {/* Header mit Filter und Aktionen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f.value
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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

      {/* Note form */}
      {noteOpen && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
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
                placeholder={noteChannel === "phone" ? "z.B. Rückruf zu Mietminderung" : "Thema des Meetings"}
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
              placeholder={noteChannel === "note" ? "Was möchtest du festhalten?" : "Was wurde besprochen?"}
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

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <MessageSquare className="w-10 h-10 mb-2" />
          <p className="text-sm">
            {filter === "all" ? "Noch keine Kommunikation" : `Keine Einträge vom Typ „${FILTERS.find((f) => f.value === filter)?.label}"`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-4">
          {filtered.map((c) => {
            const isEmail = c.channel === "email";
            const isEditing = editId === c.id;
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
                        {c.contacts && (
                          <>
                            <span>·</span>
                            <Link
                              href={`/kontakte/${c.contacts.id}`}
                              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 truncate"
                            >
                              {contactDisplayName(c.contacts)}
                            </Link>
                          </>
                        )}
                        {c.tickets && (
                          <>
                            <span>·</span>
                            <Link
                              href={`/vorgaenge/${c.tickets.id}`}
                              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 truncate"
                            >
                              ↗ {c.tickets.title}
                            </Link>
                          </>
                        )}
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isEmail && (
                            <button
                              onClick={() => startEdit(c)}
                              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                              title="Bearbeiten"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => remove(c)}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                            title={isEmail ? "Verknüpfung entfernen" : "Löschen"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {c.subject && (
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">{c.subject}</p>
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
                          value={editForm.channel}
                          onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })}
                          className="text-sm rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        >
                          {NOTE_CHANNELS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <input
                          type="datetime-local"
                          value={editForm.occurred_at}
                          onChange={(e) => setEditForm({ ...editForm, occurred_at: e.target.value })}
                          className="text-sm rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        />
                      </div>
                      {editForm.channel !== "note" && (
                        <input
                          value={editForm.subject}
                          onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                          placeholder="Betreff"
                          className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        />
                      )}
                      <textarea
                        value={editForm.body}
                        onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                        rows={3}
                        placeholder="Inhalt"
                        className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setEditId(null)}
                          disabled={editSaving}
                          className="px-3 py-1 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={editSaving || !editForm.body.trim()}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                        >
                          {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
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
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">E-Mail dem Objekt zuordnen</h3>
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
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{e.subject}</p>
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
