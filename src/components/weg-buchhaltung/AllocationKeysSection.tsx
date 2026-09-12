"use client";

import { useState } from "react";
import { Loader2, Plus, X, Tags } from "lucide-react";
import { type AllocationKey, type Unit, KEY_TYPE_LABELS, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// VERTEILERSCHLÜSSEL
// ════════════════════════════════════════════════════════════════════════

export function AllocationKeysSection({
  propertyId, units, keys, onChange, onError,
}: {
  propertyId: string; units: Unit[]; keys: AllocationKey[];
  onChange: () => void; onError: (msg: string) => void;
}) {
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState("co_ownership");
  const [saving, setSaving] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/weg-buchhaltung/allocation-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, name: newKeyName, type: newKeyType }),
    });
    if (res.ok) {
      setNewKeyName(""); setShowNewKey(false); onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Anlegen" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Tags className="w-4 h-4 text-gray-400" />
          Verteilerschlüssel
        </h2>
        <button
          onClick={() => setShowNewKey((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Neuer Schlüssel
        </button>
      </div>

      {showNewKey && (
        <form onSubmit={createKey} className={`${cardCls} p-4 mb-3 flex flex-wrap items-end gap-3`}>
          <div>
            <label className={labelCls}>Name</label>
            <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} required className={inputCls} placeholder="z. B. MEA" />
          </div>
          <div>
            <label className={labelCls}>Typ</label>
            <select value={newKeyType} onChange={(e) => setNewKeyType(e.target.value)} className={inputCls}>
              {Object.entries(KEY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
          </button>
          <button type="button" onClick={() => setShowNewKey(false)} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch keine Verteilerschlüssel angelegt.</p>
      ) : (
        <div className="space-y-4">
          {keys.map((k) => (
            <AllocationKeyCard key={k.id} akey={k} units={units} onChange={onChange} onError={onError} />
          ))}
        </div>
      )}
    </section>
  );
}

function AllocationKeyCard({
  akey, units, onChange, onError,
}: {
  akey: AllocationKey; units: Unit[]; onChange: () => void; onError: (msg: string) => void;
}) {
  const [addingUnitId, setAddingUnitId] = useState("");
  const [addingValue, setAddingValue] = useState("");
  const [addingValidFrom, setAddingValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const activeValues = akey.values.filter((v) => !v.valid_to);
  const coveredUnitIds = new Set(activeValues.map((v) => v.unit_id));
  const availableUnits = units.filter((u) => !coveredUnitIds.has(u.id));

  async function addValue(e: React.FormEvent) {
    e.preventDefault();
    if (!addingUnitId || !addingValue) return;
    setSaving(true);
    const res = await fetch(`/api/weg-buchhaltung/allocation-keys/${akey.id}/values`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit_id: addingUnitId, value: Number(addingValue), valid_from: addingValidFrom }),
    });
    if (res.ok) {
      setAddingUnitId(""); setAddingValue(""); onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSaving(false);
  }

  const totalWeight = activeValues.reduce((s, v) => s + Number(v.value), 0);

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{akey.name}</p>
          <p className="text-xs text-gray-400">{KEY_TYPE_LABELS[akey.type] ?? akey.type}</p>
        </div>
        <p className="text-xs text-gray-400">Σ Gewicht: {totalWeight}</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2 font-medium">Einheit</th>
            <th className="px-4 py-2 font-medium">Wert</th>
            <th className="px-4 py-2 font-medium">Gültig ab</th>
            <th className="px-4 py-2 font-medium">Gültig bis</th>
          </tr>
        </thead>
        <tbody>
          {akey.values.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-3 text-gray-400 text-center">Keine Werte</td></tr>
          )}
          {akey.values.map((v) => (
            <tr key={v.id} className={`border-t border-gray-50 dark:border-gray-800/50 ${v.valid_to ? "opacity-50" : ""}`}>
              <td className="px-4 py-2">{v.units?.unit_number ?? "–"}</td>
              <td className="px-4 py-2">{v.value}</td>
              <td className="px-4 py-2 text-gray-500">{v.valid_from}</td>
              <td className="px-4 py-2 text-gray-500">{v.valid_to ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {availableUnits.length > 0 && (
        <form onSubmit={addValue} className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-end gap-2">
          <select value={addingUnitId} onChange={(e) => setAddingUnitId(e.target.value)} className={inputCls} required>
            <option value="">Einheit wählen…</option>
            {availableUnits.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
          </select>
          <input
            type="number" step="0.0001" placeholder="Wert" value={addingValue}
            onChange={(e) => setAddingValue(e.target.value)} className={`${inputCls} w-28`} required
          />
          <input
            type="date" value={addingValidFrom} onChange={(e) => setAddingValidFrom(e.target.value)}
            className={inputCls} required
          />
          <button type="submit" disabled={saving} className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Wert hinzufügen"}
          </button>
        </form>
      )}
    </div>
  );
}
