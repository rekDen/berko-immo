"use client";

import { useState } from "react";
import { Loader2, Plus, X, Banknote } from "lucide-react";
import { type SpecialLevy, type Unit, formatCents, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// SONDERUMLAGEN
// ════════════════════════════════════════════════════════════════════════

export function SpecialLeviesSection({
  propertyId, units, levies, onChange, onError,
}: {
  propertyId: string; units: Unit[]; levies: SpecialLevy[]; onChange: () => void; onError: (msg: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [resolutionDate, setResolutionDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function createLevy(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/weg-buchhaltung/special-levies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, purpose, resolution_date: resolutionDate, due_date: dueDate || null }),
    });
    if (res.ok) { setPurpose(""); setDueDate(""); setShowNew(false); onChange(); }
    else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Anlegen" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Banknote className="w-4 h-4 text-gray-400" />
          Sonderumlagen
        </h2>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Neue Sonderumlage
        </button>
      </div>

      {showNew && (
        <form onSubmit={createLevy} className={`${cardCls} p-4 mb-3 flex flex-wrap items-end gap-3`}>
          <div className="flex-1 min-w-[200px]">
            <label className={labelCls}>Zweck</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${inputCls} w-full`} required />
          </div>
          <div>
            <label className={labelCls}>Beschlussdatum</label>
            <input type="date" value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Fällig zum</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
          </button>
          <button type="button" onClick={() => setShowNew(false)} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {levies.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch keine Sonderumlage angelegt.</p>
      ) : (
        <div className="space-y-4">
          {levies.map((l) => (
            <SpecialLevyCard key={l.id} levy={l} units={units} onChange={onChange} onError={onError} />
          ))}
        </div>
      )}
    </section>
  );
}

function SpecialLevyCard({
  levy, units, onChange, onError,
}: {
  levy: SpecialLevy; units: Unit[]; onChange: () => void; onError: (msg: string) => void;
}) {
  const [addingUnitId, setAddingUnitId] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [saving, setSaving] = useState(false);

  const coveredUnitIds = new Set(levy.units.map((u) => u.unit_id));
  const availableUnits = units.filter((u) => !coveredUnitIds.has(u.id));
  const totalSoll = levy.units.reduce((s, u) => s + u.amount, 0);
  const totalPaid = levy.units.reduce((s, u) => s + u.paid, 0);

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!addingUnitId || !amountEur) return;
    setSaving(true);
    const res = await fetch(`/api/weg-buchhaltung/special-levies/${levy.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit_id: addingUnitId, amount: Math.round(Number(amountEur) * 100) }),
    });
    if (res.ok) { setAddingUnitId(""); setAmountEur(""); onChange(); }
    else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{levy.purpose}</p>
          <p className="text-xs text-gray-400">
            Beschluss {levy.resolution_date}{levy.due_date ? ` · fällig ${levy.due_date}` : ""}
          </p>
        </div>
        <p className="text-xs text-gray-400">
          Soll {formatCents(totalSoll)} · bezahlt {formatCents(totalPaid)} · Rest {formatCents(totalSoll - totalPaid)}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2 font-medium">Einheit</th>
            <th className="px-4 py-2 font-medium">Soll</th>
            <th className="px-4 py-2 font-medium">Bezahlt</th>
            <th className="px-4 py-2 font-medium">Rest</th>
          </tr>
        </thead>
        <tbody>
          {levy.units.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-3 text-gray-400 text-center">Keine Einheiten zugeordnet</td></tr>
          )}
          {levy.units.map((u) => (
            <tr key={u.id} className="border-t border-gray-50 dark:border-gray-800/50">
              <td className="px-4 py-2">{u.units?.unit_number ?? "–"}</td>
              <td className="px-4 py-2">{formatCents(u.amount)}</td>
              <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400">{formatCents(u.paid)}</td>
              <td className="px-4 py-2">{formatCents(u.amount - u.paid)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {availableUnits.length > 0 && (
        <form onSubmit={addUnit} className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-end gap-2">
          <select value={addingUnitId} onChange={(e) => setAddingUnitId(e.target.value)} className={inputCls} required>
            <option value="">Einheit wählen…</option>
            {availableUnits.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Soll €" value={amountEur} onChange={(e) => setAmountEur(e.target.value)} className={`${inputCls} w-28`} required />
          <button type="submit" disabled={saving} className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Hinzufügen"}
          </button>
        </form>
      )}
    </div>
  );
}
