"use client";

import { useState } from "react";
import { Loader2, Plus, X, Zap } from "lucide-react";
import { type CostType, type MatchingRule, type Owner, type Unit, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// ZUORDNUNGSREGELN (MatchingRule)
// ════════════════════════════════════════════════════════════════════════

function ruleTargetLabel(rule: MatchingRule): string {
  if (rule.cost_types) return `Kostenart: ${rule.cost_types.name}`;
  if (rule.units) return `Einheit: ${rule.units.unit_number}`;
  if (rule.contacts) {
    return `Eigentümer: ${rule.contacts.company_name ?? [rule.contacts.first_name, rule.contacts.last_name].filter(Boolean).join(" ")}`;
  }
  return "–";
}

export function MatchingRulesSection({
  propertyId, units, owners, costTypes, rules, onChange, onError,
}: {
  propertyId: string; units: Unit[]; owners: Owner[]; costTypes: CostType[]; rules: MatchingRule[];
  onChange: () => void; onError: (msg: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [iban, setIban] = useState("");
  const [purposeContains, setPurposeContains] = useState("");
  const [targetType, setTargetType] = useState<"cost_type" | "unit" | "owner">("cost_type");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const pattern: { iban?: string; purposeContains?: string } = {};
    if (iban) pattern.iban = iban;
    if (purposeContains) pattern.purposeContains = purposeContains;

    const res = await fetch("/api/weg-buchhaltung/matching-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
        pattern,
        target_cost_type_id: targetType === "cost_type" ? targetId || null : null,
        target_unit_id: targetType === "unit" ? targetId || null : null,
        target_owner_id: targetType === "owner" ? targetId || null : null,
      }),
    });
    if (res.ok) {
      setIban(""); setPurposeContains(""); setTargetId(""); setShowNew(false);
      onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Anlegen" }));
      onError(err.error);
    }
    setSaving(false);
  }

  async function toggleActive(rule: MatchingRule) {
    const res = await fetch(`/api/weg-buchhaltung/matching-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    if (res.ok) onChange();
    else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Aktualisieren" }));
      onError(err.error);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-gray-400" />
          Zuordnungsregeln
        </h2>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Neue Regel
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Werden beim Datei-Import zuerst angewendet (deterministisch), bevor irgendein KI-Vorschlag entstehen würde.
      </p>

      {showNew && (
        <form onSubmit={createRule} className={`${cardCls} p-4 mb-3 space-y-3`}>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className={labelCls}>IBAN (Gegenkonto)</label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} className={inputCls} placeholder="DE…" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Verwendungszweck enthält</label>
              <input value={purposeContains} onChange={(e) => setPurposeContains(e.target.value)} className={`${inputCls} w-full`} placeholder="z. B. Hausmeister" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className={labelCls}>Ziel-Typ</label>
              <select value={targetType} onChange={(e) => { setTargetType(e.target.value as "cost_type" | "unit" | "owner"); setTargetId(""); }} className={inputCls}>
                <option value="cost_type">Kostenart</option>
                <option value="unit">Einheit</option>
                <option value="owner">Eigentümer</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ziel</label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls} required>
                <option value="">wählen…</option>
                {targetType === "cost_type" && costTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                {targetType === "unit" && units.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                {targetType === "owner" && owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit" disabled={saving || (!iban && !purposeContains)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch keine Zuordnungsregeln angelegt.</p>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Muster</th>
                <th className="px-4 py-2 font-medium">Ziel</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
                    {r.pattern.iban && <div>IBAN: {r.pattern.iban}</div>}
                    {r.pattern.purposeContains && <div>Zweck enthält: {r.pattern.purposeContains}</div>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{ruleTargetLabel(r)}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleActive(r)}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.active
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                      }`}
                    >
                      {r.active ? "Aktiv" : "Inaktiv"}
                    </button>
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
