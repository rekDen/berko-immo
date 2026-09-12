"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Loader2, X, Upload, Flame, Trash2, Pencil, Sparkles } from "lucide-react";
import { formatCents, inputCls, labelCls, cardCls } from "./shared";

type PreviewRow = {
  unitLabel: string; unitId: string | null; heating: number; hotWater: number;
  co2Cost?: number; co2LandlordSharePct?: string; laborAmount?: number;
};

type HeatingImportRecord = {
  id: string; year: number; provider: string; total_amount: number;
  confirmed_difference: number | null; reconciliation_note: string | null; created_at: string;
  cost_types: { name: string } | null;
  units: { unit_id: string; heating: number; hot_water: number; units: { unit_number: string } | null }[];
};

export function HeatingImportPanel({
  propertyId, year, onError,
}: {
  propertyId: string; year: number; onError: (msg: string) => void;
}) {
  const [heatingCostTypes, setHeatingCostTypes] = useState<{ id: string; name: string }[]>([]);
  const [imports, setImports] = useState<HeatingImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [costTypeId, setCostTypeId] = useState("");
  const [provider, setProvider] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [totalAmountEur, setTotalAmountEur] = useState("");
  const [confirmedDifferenceEur, setConfirmedDifferenceEur] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [committing, setCommitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDifferenceEur, setEditDifferenceEur] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [generatingExplain, setGeneratingExplain] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ctRes, impRes] = await Promise.all([
      fetch(`/api/weg-buchhaltung/cost-types?property_id=${propertyId}`),
      fetch(`/api/weg-settlement/heating-imports?property_id=${propertyId}&year=${year}`),
    ]);
    if (ctRes.ok) {
      const all: { id: string; name: string; is_heating: boolean }[] = await ctRes.json();
      setHeatingCostTypes(all.filter((c) => c.is_heating));
    }
    if (impRes.ok) setImports(await impRes.json());
    setLoading(false);
  }, [propertyId, year]);

  useEffect(() => { load(); }, [load]);

  async function loadPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoadingPreview(true);
    const form = new FormData();
    form.set("file", file);
    form.set("property_id", propertyId);
    const res = await fetch("/api/weg-settlement/heating-imports/preview", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows);
      setPreviewErrors(data.errors);
      setTotalAmountEur((data.total / 100).toFixed(2));
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Einlesen der Datei" }));
      onError(err.error);
    }
    setLoadingPreview(false);
  }

  async function commit() {
    if (!rows || !costTypeId || !provider || !totalAmountEur) return;
    const unresolved = rows.filter((r) => !r.unitId);
    if (unresolved.length > 0) {
      onError(`${unresolved.length} Zeile(n) ohne zugeordnete Einheit — bitte Datei korrigieren und erneut hochladen`);
      return;
    }
    setCommitting(true);
    const res = await fetch("/api/weg-settlement/heating-imports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId, year, cost_type_id: costTypeId, provider,
        total_amount: Math.round(Number(totalAmountEur) * 100),
        rows: rows.map((r) => ({
          unit_id: r.unitId, heating: r.heating, hot_water: r.hotWater,
          co2_cost: r.co2Cost, co2_landlord_share_pct: r.co2LandlordSharePct, labor_amount: r.laborAmount,
        })),
        confirmed_difference: confirmedDifferenceEur ? Math.round(Number(confirmedDifferenceEur) * 100) : undefined,
        reconciliation_note: reconciliationNote || undefined,
      }),
    });
    if (res.ok) {
      setFile(null); setRows(null); setCostTypeId(""); setProvider("");
      setTotalAmountEur(""); setConfirmedDifferenceEur(""); setReconciliationNote(""); setShowUpload(false);
      load();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setCommitting(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/weg-settlement/heating-imports/${id}`, { method: "DELETE" });
    if (res.ok) load(); else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Löschen" }));
      onError(err.error);
    }
  }

  function startEdit(imp: HeatingImportRecord) {
    setEditingId(imp.id);
    setEditDifferenceEur(imp.confirmed_difference !== null ? (imp.confirmed_difference / 100).toFixed(2) : "");
    setEditNote(imp.reconciliation_note ?? "");
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    const res = await fetch(`/api/weg-settlement/heating-imports/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed_difference: editDifferenceEur ? Math.round(Number(editDifferenceEur) * 100) : null,
        reconciliation_note: editNote || null,
      }),
    });
    if (res.ok) { setEditingId(null); load(); } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSavingEdit(false);
  }

  async function generateExplanation(id: string) {
    setGeneratingExplain(true);
    const res = await fetch(`/api/weg-settlement/heating-imports/${id}/explain`, { method: "POST" });
    if (res.ok) {
      const data: { text: string } = await res.json();
      if (data.text) setEditNote(data.text);
      else onError("Keine Überleitungsdifferenz vorhanden — kein Textvorschlag nötig.");
    } else {
      const err = await res.json().catch(() => ({ error: "Textvorschlag fehlgeschlagen" }));
      onError(err.error);
    }
    setGeneratingExplain(false);
  }

  const perUnitSum = rows ? rows.reduce((s, r) => s + r.heating + r.hotWater, 0) : 0;
  const totalAmountCents = totalAmountEur ? Math.round(Number(totalAmountEur) * 100) : 0;
  const mismatch = rows ? perUnitSum - totalAmountCents : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" /> Heizkostenimport
        </h4>
        {heatingCostTypes.length > 0 && (
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600"
          >
            <Upload className="w-3.5 h-3.5" /> Datei importieren
          </button>
        )}
      </div>

      {heatingCostTypes.length === 0 && (
        <p className="text-xs text-gray-400">Keine Kostenart mit &bdquo;Heizkosten&rdquo;-Kennzeichen für dieses Objekt angelegt.</p>
      )}

      {showUpload && (
        <div className={`${cardCls} p-4 mb-3 space-y-3`}>
          {!rows ? (
            <form onSubmit={loadPreview} className="flex flex-wrap items-end gap-3">
              <div>
                <label className={labelCls}>Kostenart</label>
                <select value={costTypeId} onChange={(e) => setCostTypeId(e.target.value)} className={inputCls} required>
                  <option value="">wählen…</option>
                  {heatingCostTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Messdienst</label>
                <input value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls} placeholder="z. B. Techem" required />
              </div>
              <div>
                <label className={labelCls}>Datei (CSV/XLSX)</label>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-gray-600 dark:text-gray-300" required />
              </div>
              <button type="submit" disabled={loadingPreview || !file} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vorschau laden"}
              </button>
              <button type="button" onClick={() => setShowUpload(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {previewErrors.length > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                  {previewErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-gray-900">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-3 py-2 font-medium">Einheit</th>
                      <th className="px-3 py-2 font-medium text-right">Heizung</th>
                      <th className="px-3 py-2 font-medium text-right">Warmwasser</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={`border-t border-gray-50 dark:border-gray-800/50 ${!r.unitId ? "bg-red-50 dark:bg-red-500/10" : ""}`}>
                        <td className="px-3 py-1.5">{r.unitLabel}{!r.unitId && <span className="text-red-600 dark:text-red-400 text-xs ml-1">(nicht gefunden)</span>}</td>
                        <td className="px-3 py-1.5 text-right">{formatCents(r.heating)}</td>
                        <td className="px-3 py-1.5 text-right">{formatCents(r.hotWater)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelCls}>Gesamtbetrag laut Messdienst (€)</label>
                  <input type="number" step="0.01" value={totalAmountEur} onChange={(e) => setTotalAmountEur(e.target.value)} className={inputCls} required />
                </div>
                <p className="text-xs text-gray-400">Σ Einheiten: {formatCents(perUnitSum)}{mismatch !== 0 && <span className="text-amber-600 dark:text-amber-400"> · Differenz: {formatCents(mismatch)}</span>}</p>
              </div>

              {mismatch !== 0 && (
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <div>
                    <label className={labelCls}>Rundungsdifferenz bestätigen (€)</label>
                    <input type="number" step="0.01" value={confirmedDifferenceEur} onChange={(e) => setConfirmedDifferenceEur(e.target.value)} className={inputCls} placeholder={(mismatch / 100).toFixed(2)} />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className={labelCls}>Erläuterung (Überleitungsdifferenz)</label>
                    <input value={reconciliationNote} onChange={(e) => setReconciliationNote(e.target.value)} className={`${inputCls} w-full`} placeholder="z. B. abweichender Abrechnungszeitraum" />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button onClick={commit} disabled={committing || !costTypeId || !provider || !totalAmountEur} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                  {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import speichern"}
                </button>
                <button onClick={() => { setRows(null); setPreviewErrors([]); }} className="p-2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : imports.length > 0 && (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Kostenart</th>
                <th className="px-4 py-2 font-medium">Messdienst</th>
                <th className="px-4 py-2 font-medium text-right">Gesamtbetrag</th>
                <th className="px-4 py-2 font-medium">Einheiten</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <Fragment key={imp.id}>
                  <tr className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{imp.cost_types?.name ?? "–"}</td>
                    <td className="px-4 py-2 text-gray-500">{imp.provider}</td>
                    <td className="px-4 py-2 text-right">{formatCents(imp.total_amount)}</td>
                    <td className="px-4 py-2 text-gray-500">{imp.units.length}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => (editingId === imp.id ? setEditingId(null) : startEdit(imp))}
                          className="text-gray-400 hover:text-orange-500"
                          title="Rundungsdifferenz/Erläuterung bearbeiten"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(imp.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === imp.id && (
                    <tr className="border-t border-gray-50 dark:border-gray-800/50 bg-amber-50/50 dark:bg-amber-500/5">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className={labelCls}>Rundungsdifferenz bestätigen (€)</label>
                            <input type="number" step="0.01" value={editDifferenceEur} onChange={(e) => setEditDifferenceEur(e.target.value)} className={inputCls} />
                          </div>
                          <div className="flex-1 min-w-[240px]">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className={labelCls + " mb-0"}>Erläuterung (Überleitungsdifferenz)</label>
                              <button
                                type="button" onClick={() => generateExplanation(imp.id)} disabled={generatingExplain}
                                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 disabled:opacity-50"
                              >
                                {generatingExplain ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                Textvorschlag (KI)
                              </button>
                            </div>
                            <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} className={`${inputCls} w-full`} />
                          </div>
                          <button onClick={() => saveEdit(imp.id)} disabled={savingEdit} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                            {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
