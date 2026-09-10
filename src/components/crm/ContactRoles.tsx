"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import { type RoleType } from "@/types/crm";
import RoleChip from "./RoleChip";
import Combobox from "@/components/Combobox";

type Role = {
  id: string;
  role: RoleType;
  valid_from: string;
  valid_to: string | null;
  is_primary: boolean;
  property_id: string | null;
  unit_id: string | null;
  properties: { id: string; name: string } | null;
  units: { id: string; unit_number: string } | null;
};

type EditState = {
  id: string | null;
  role: string;
  property_id: string;
  unit_id: string;
  valid_from: string;
  valid_to: string;
  is_primary: boolean;
};

const ROLE_OPTIONS = [
  { value: "owner", label: "Eigentümer" },
  { value: "tenant", label: "Mieter" },
  { value: "subtenant", label: "Untermieter" },
  { value: "beirat", label: "Beirat" },
  { value: "proxy", label: "Bevollmächtigter" },
  { value: "service_provider", label: "Dienstleister" },
  { value: "caretaker", label: "Hausmeister" },
  { value: "other", label: "Sonstige" },
];

type Props = {
  contactId: string;
  onChange?: () => void;
};

export default function ContactRoles({ contactId, onChange }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unit_number: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/contacts/${contactId}`);
    if (res.ok) {
      const c = await res.json();
      setRoles(c.contact_roles ?? []);
    }
    setLoading(false);
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProperties);
  }, []);

  useEffect(() => {
    if (!edit?.property_id) {
      setUnits([]);
      return;
    }
    fetch(`/api/properties/${edit.property_id}/units`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setUnits);
  }, [edit?.property_id]);

  function openNew() {
    setEdit({
      id: null,
      role: "tenant",
      property_id: "",
      unit_id: "",
      valid_from: new Date().toISOString().slice(0, 10),
      valid_to: "",
      is_primary: true,
    });
    setError("");
  }

  function openEdit(r: Role) {
    setEdit({
      id: r.id,
      role: r.role,
      property_id: r.property_id ?? "",
      unit_id: r.unit_id ?? "",
      valid_from: r.valid_from,
      valid_to: r.valid_to ?? "",
      is_primary: r.is_primary,
    });
    setError("");
  }

  async function save() {
    if (!edit) return;
    if (!edit.property_id) {
      setError("Objekt ist erforderlich");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      contact_id: contactId,
      role: edit.role,
      property_id: edit.property_id,
      unit_id: edit.unit_id || null,
      valid_from: edit.valid_from,
      valid_to: edit.valid_to || null,
      is_primary: edit.is_primary,
    };

    const res = edit.id
      ? await fetch(`/api/contact-roles/${edit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/contact-roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      setEdit(null);
      await load();
      onChange?.();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error ?? "Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Rolle wirklich löschen?")) return;
    const res = await fetch(`/api/contact-roles/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      onChange?.();
    }
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Rolle hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : roles.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Keine Rollen</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Rolle</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Objekt / Einheit</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Zeitraum</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const isActive = !r.valid_to || new Date(r.valid_to) > new Date();
                return (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50 group">
                    <td className="px-4 py-2.5"><RoleChip role={r.role} /></td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                      {r.properties?.name ?? "–"}
                      {r.units && ` / ${r.units.unit_number}`}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {new Date(r.valid_from).toLocaleDateString("de-DE")}
                      {r.valid_to && ` – ${new Date(r.valid_to).toLocaleDateString("de-DE")}`}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                        }`}
                      >
                        {isActive ? "Aktiv" : "Beendet"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !saving && setEdit(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {edit.id ? "Rolle bearbeiten" : "Neue Rolle"}
              </h3>
              <button
                type="button"
                onClick={() => setEdit(null)}
                disabled={saving}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Rolle *</label>
                <select
                  value={edit.role}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Objekt *</label>
                  <Combobox
                    value={edit.property_id}
                    onChange={(v) => setEdit({ ...edit, property_id: v, unit_id: "" })}
                    options={properties.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Objekt suchen…"
                    allowClear={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Einheit</label>
                  <Combobox
                    value={edit.unit_id}
                    onChange={(v) => setEdit({ ...edit, unit_id: v })}
                    options={units.map((u) => ({ value: u.id, label: u.unit_number }))}
                    placeholder={edit.property_id ? "Einheit suchen…" : "zuerst Objekt wählen"}
                    disabled={!edit.property_id}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Gültig ab *</label>
                  <input
                    type="date"
                    value={edit.valid_from}
                    onChange={(e) => setEdit({ ...edit, valid_from: e.target.value })}
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Gültig bis</label>
                  <input
                    type="date"
                    value={edit.valid_to}
                    onChange={(e) => setEdit({ ...edit, valid_to: e.target.value })}
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={edit.is_primary}
                  onChange={(e) => setEdit({ ...edit, is_primary: e.target.checked })}
                  className="rounded"
                />
                Primäre Rolle
              </label>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <button
                type="button"
                onClick={() => setEdit(null)}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
