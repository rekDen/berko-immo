"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { inputCls, labelCls } from "./shared";
import type { MessageTemplateType } from "@/lib/mietermatching/message-templates";

interface Template {
  id: string;
  type: MessageTemplateType;
  name: string;
  subject: string;
  body: string;
  channel: "email" | "sms";
  is_default: boolean;
  active: boolean;
}

const TYPE_LABELS: Record<MessageTemplateType, string> = { invitation: "Einladung", rejection: "Ablehnung" };

const PLACEHOLDER_HINT =
  "Platzhalter: {{vorname}}, {{nachname}}, {{einheit_bezeichnung}}, {{einheit_adresse}}, " +
  "{{besichtigungstermin}} (nur Einladung), {{verwalter_name}}, {{verwalter_telefon}}, {{firma_name}}";

interface TemplateForm { name: string; subject: string; body: string; channel: "email" | "sms"; is_default: boolean; active: boolean }

const EMPTY_FORM: TemplateForm = { name: "", subject: "", body: "", channel: "email", is_default: false, active: true };

function TemplateGroup({ type, templates, onChange }: { type: MessageTemplateType; templates: Template[]; onChange: () => void }) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(t: Template) {
    setForm({ name: t.name, subject: t.subject, body: t.body, channel: t.channel, is_default: t.is_default, active: t.active });
    setEditingId(t.id);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = editingId === "new"
      ? await fetch("/api/mietermatching/message-templates", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...form }),
        })
      : await fetch(`/api/mietermatching/message-templates/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
    if (res.ok) {
      setEditingId(null);
      onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error);
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/mietermatching/message-templates/${id}`, { method: "DELETE" });
    if (res.ok) onChange();
    else {
      const err = await res.json().catch(() => ({ error: "Löschen fehlgeschlagen" }));
      setError(err.error);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{TYPE_LABELS[type]}</h3>
        <button
          type="button" onClick={startNew}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Neue Vorlage
        </button>
      </div>

      {templates.length === 0 && editingId !== "new" ? (
        <p className="text-sm text-gray-400 py-2">Noch keine Vorlage — es wird ein interner Standardtext verwendet.</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => startEdit(t)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                {t.is_default && <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" />}
                <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{t.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{t.channel === "email" ? "E-Mail" : "SMS"}</span>
                {!t.active && <span className="text-xs text-gray-400 shrink-0">(inaktiv)</span>}
              </button>
              <button type="button" onClick={() => remove(t.id)} className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editingId && (
        <form onSubmit={save} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">{PLACEHOLDER_HINT}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>Kanal</label>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as "email" | "sms" })} className={`${inputCls} w-full`}>
                <option value="email">E-Mail</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Betreff</label>
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>Text</label>
            <textarea required rows={7} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={`${inputCls} w-full font-mono text-xs`} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
              Standard-Vorlage
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Aktiv
            </label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Speichern
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
          </div>
        </form>
      )}
    </div>
  );
}

// Spec §7: Einstellungen für Einladen/Ablehnen-Vorlagen. Wird in die
// bestehende /einstellungen-Seite eingebettet, wie schon die WEG-
// Jahresabrechnungs-Vorlagen dort (App-Konvention: eine gemeinsame
// Einstellungen-Seite statt vieler /settings/*-Unterrouten).
export function MessageTemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/mietermatching/message-templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <TemplateGroup type="invitation" templates={templates.filter((t) => t.type === "invitation")} onChange={load} />
      <div className="border-t border-gray-200 dark:border-gray-800" />
      <TemplateGroup type="rejection" templates={templates.filter((t) => t.type === "rejection")} onChange={load} />
    </div>
  );
}
