"use client";

import { useState } from "react";
import { Loader2, Calculator, FileBarChart } from "lucide-react";
import { type SettlementListItem, StatusBadge, inputCls, labelCls, cardCls } from "./shared";

export function SettlementsListSection({
  propertyId, settlements, selectedId, onSelect, onChange, onError,
}: {
  propertyId: string; settlements: SettlementListItem[]; selectedId: string | null;
  onSelect: (id: string) => void; onChange: () => void; onError: (msg: string) => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [computing, setComputing] = useState(false);

  async function compute() {
    setComputing(true);
    const res = await fetch("/api/weg-settlement/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, year }),
    });
    if (res.ok) {
      const data = await res.json();
      onChange();
      onSelect(data.settlement.id);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler bei der Berechnung" }));
      onError(err.error);
    }
    setComputing(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FileBarChart className="w-4 h-4 text-gray-400" />
          Jahresabrechnungen
        </h2>
        <div className="flex items-end gap-2">
          <div>
            <label className={labelCls}>Jahr</label>
            <input
              type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className={`${inputCls} w-24`}
            />
          </div>
          <button
            onClick={compute} disabled={computing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {computing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
            Berechnen
          </button>
        </div>
      </div>

      {settlements.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch keine Abrechnung berechnet.</p>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Jahr</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr
                  key={s.id} onClick={() => onSelect(s.id)}
                  className={`border-t border-gray-50 dark:border-gray-800/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 ${selectedId === s.id ? "bg-orange-50 dark:bg-orange-500/10" : ""}`}
                >
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-200 font-medium">{s.year}</td>
                  <td className="px-4 py-2 text-gray-500">v{s.version}</td>
                  <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{new Date(s.created_at).toLocaleString("de-DE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
