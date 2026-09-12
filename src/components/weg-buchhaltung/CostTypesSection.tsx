"use client";

import { useState } from "react";
import { Loader2, Plus, X, Landmark } from "lucide-react";
import { type AllocationKey, type CostType, Badge, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// KOSTENARTEN
// ════════════════════════════════════════════════════════════════════════

export function CostTypesSection({
  propertyId, keys, costTypes, onChange, onError,
}: {
  propertyId: string; keys: AllocationKey[]; costTypes: CostType[];
  onChange: () => void; onError: (msg: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [allocationKeyId, setAllocationKeyId] = useState("");
  const [isHeating, setIsHeating] = useState(false);
  const [allowsDirectCharge, setAllowsDirectCharge] = useState(false);
  const [apportionable, setApportionable] = useState(false);
  const [betrkvNo, setBetrkvNo] = useState("");
  const [saving, setSaving] = useState(false);

  async function createCostType(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/weg-buchhaltung/cost-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
        name,
        direction,
        allocation_key_id: allocationKeyId || null,
        is_heating: isHeating,
        allows_direct_charge: allowsDirectCharge,
        apportionable,
        betrkv_no: betrkvNo ? Number(betrkvNo) : null,
      }),
    });
    if (res.ok) {
      setName(""); setAllocationKeyId(""); setIsHeating(false); setAllowsDirectCharge(false);
      setApportionable(false); setBetrkvNo(""); setShowNew(false);
      onChange();
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
          <Landmark className="w-4 h-4 text-gray-400" />
          Kostenarten
        </h2>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Neue Kostenart
        </button>
      </div>

      {showNew && (
        <form onSubmit={createCostType} className={`${cardCls} p-4 mb-3 space-y-3`}>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="z. B. Hausmeister" />
            </div>
            <div>
              <label className={labelCls}>Richtung</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value as "expense" | "income")} className={inputCls}>
                <option value="expense">Ausgabe</option>
                <option value="income">Einnahme</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Verteilerschlüssel</label>
              <select value={allocationKeyId} onChange={(e) => setAllocationKeyId(e.target.value)} className={inputCls}>
                <option value="">– keiner –</option>
                {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>BetrKV-Nr.</label>
              <input
                type="number" min={1} max={17} value={betrkvNo}
                onChange={(e) => setBetrkvNo(e.target.value)} className={`${inputCls} w-24`}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isHeating} onChange={(e) => setIsHeating(e.target.checked)} /> Heizkosten
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={allowsDirectCharge} onChange={(e) => setAllowsDirectCharge(e.target.checked)} /> Direktbelastung erlaubt
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={apportionable} onChange={(e) => setApportionable(e.target.checked)} /> Umlagefähig
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {costTypes.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch keine Kostenarten angelegt.</p>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Konto</th>
                <th className="px-4 py-2 font-medium">Richtung</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Schlüssel</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Eigenschaften</th>
              </tr>
            </thead>
            <tbody>
              {costTypes.map((c) => (
                <tr key={c.id} className="border-t border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                    {c.accounts ? `${c.accounts.code} · ${c.accounts.name}` : "–"}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{c.direction === "expense" ? "Ausgabe" : "Einnahme"}</td>
                  <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">
                    {keys.find((k) => k.id === c.allocation_key_id)?.name ?? "–"}
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell">
                    <div className="flex gap-1.5 flex-wrap">
                      {c.is_heating && <Badge>Heizung</Badge>}
                      {c.allows_direct_charge && <Badge>Direktbelastung</Badge>}
                      {c.apportionable && <Badge>Umlagefähig{c.betrkv_no ? ` (§${c.betrkv_no})` : ""}</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
