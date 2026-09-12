"use client";

import { useState } from "react";
import { Loader2, Plus, X, Calculator } from "lucide-react";
import { type EconomicPlan, type Unit, formatCents, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// WIRTSCHAFTSPLAN
// ════════════════════════════════════════════════════════════════════════

export function EconomicPlansSection({
  propertyId, units, plans, onChange, onError,
}: {
  propertyId: string; units: Unit[]; plans: EconomicPlan[]; onChange: () => void; onError: (msg: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [resolutionDate, setResolutionDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/weg-buchhaltung/economic-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, year, resolution_date: resolutionDate }),
    });
    if (res.ok) { setShowNew(false); onChange(); }
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
          <Calculator className="w-4 h-4 text-gray-400" />
          Wirtschaftsplan
        </h2>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Neuer Wirtschaftsplan
        </button>
      </div>

      {showNew && (
        <form onSubmit={createPlan} className={`${cardCls} p-4 mb-3 flex flex-wrap items-end gap-3`}>
          <div>
            <label className={labelCls}>Jahr</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputCls} w-24`} required />
          </div>
          <div>
            <label className={labelCls}>Beschlussdatum</label>
            <input type="date" value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} className={inputCls} required />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
          </button>
          <button type="button" onClick={() => setShowNew(false)} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {plans.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch kein Wirtschaftsplan angelegt.</p>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => (
            <EconomicPlanCard key={p.id} plan={p} units={units} onChange={onChange} onError={onError} />
          ))}
        </div>
      )}
    </section>
  );
}

function EconomicPlanCard({
  plan, units, onChange, onError,
}: {
  plan: EconomicPlan; units: Unit[]; onChange: () => void; onError: (msg: string) => void;
}) {
  const [addingUnitId, setAddingUnitId] = useState("");
  const [operatingEur, setOperatingEur] = useState("");
  const [reserveEur, setReserveEur] = useState("");
  const [validFrom, setValidFrom] = useState(`${plan.year}-01-01`);
  const [saving, setSaving] = useState(false);

  const activeAdvances = plan.advances.filter((a) => !a.valid_to);
  const totalOperating = activeAdvances.reduce((s, a) => s + a.monthly_operating, 0);
  const totalReserve = activeAdvances.reduce((s, a) => s + a.monthly_reserve, 0);

  async function addAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!addingUnitId) return;
    setSaving(true);
    const res = await fetch(`/api/weg-buchhaltung/economic-plans/${plan.id}/advances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unit_id: addingUnitId,
        monthly_operating: Math.round(Number(operatingEur) * 100),
        monthly_reserve: Math.round(Number(reserveEur) * 100),
        valid_from: validFrom,
      }),
    });
    if (res.ok) {
      setAddingUnitId(""); setOperatingEur(""); setReserveEur(""); onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Wirtschaftsplan {plan.year} <span className="text-xs text-gray-400 font-normal">(Beschluss {plan.resolution_date})</span>
        </p>
        <p className="text-xs text-gray-400">
          Σ Bewirtschaftung: {formatCents(totalOperating)}/Monat · Σ Rücklage: {formatCents(totalReserve)}/Monat
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2 font-medium">Einheit</th>
            <th className="px-4 py-2 font-medium">Bewirtschaftung/Monat</th>
            <th className="px-4 py-2 font-medium">Rücklage/Monat</th>
            <th className="px-4 py-2 font-medium">Gültig ab</th>
            <th className="px-4 py-2 font-medium">Gültig bis</th>
          </tr>
        </thead>
        <tbody>
          {plan.advances.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-3 text-gray-400 text-center">Keine Vorschüsse</td></tr>
          )}
          {plan.advances.map((a) => (
            <tr key={a.id} className={`border-t border-gray-50 dark:border-gray-800/50 ${a.valid_to ? "opacity-50" : ""}`}>
              <td className="px-4 py-2">{a.units?.unit_number ?? "–"}</td>
              <td className="px-4 py-2">{formatCents(a.monthly_operating)}</td>
              <td className="px-4 py-2">{formatCents(a.monthly_reserve)}</td>
              <td className="px-4 py-2 text-gray-500">{a.valid_from}</td>
              <td className="px-4 py-2 text-gray-500">{a.valid_to ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={addAdvance} className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-end gap-2">
        <select value={addingUnitId} onChange={(e) => setAddingUnitId(e.target.value)} className={inputCls} required>
          <option value="">Einheit wählen…</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="Bewirtschaftung €" value={operatingEur} onChange={(e) => setOperatingEur(e.target.value)} className={`${inputCls} w-36`} required />
        <input type="number" step="0.01" placeholder="Rücklage €" value={reserveEur} onChange={(e) => setReserveEur(e.target.value)} className={`${inputCls} w-32`} required />
        <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} required />
        <button type="submit" disabled={saving} className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Vorschuss setzen"}
        </button>
      </form>
    </div>
  );
}
