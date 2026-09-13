"use client";

import { useState, Fragment } from "react";
import { Loader2, X, Sparkles, AlertTriangle } from "lucide-react";
import { type BankAccount, type CostType, type Unit, type Owner, Badge, formatCents, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// DATEI-IMPORT (CSV / CAMT.053)
// ════════════════════════════════════════════════════════════════════════

type Stage2OwnerSuggestion = { ownerId: string; unitId: string; score: number; highlight: boolean; reasons: string[] };
type Stage2CostTypeSuggestion = { costTypeId: string; score: number; highlight: boolean; reasons: string[] };
type Stage3CostTypeSuggestion = { costTypeId: string; costTypeName: string; confidence: number | null; reasoning: string | null };
type BankTxCode = { domainCode: string | null; familyCode: string | null; subFamilyCode: string | null; proprietaryCode: string | null };

// Felder, die MB2 zusätzlich aus dem CAMT.053-Import mitführt — der Client
// verändert sie nicht, sondern reicht sie beim Commit unverändert zurück.
type PreviewRow = {
  bookingDate: string; amount: number; purpose: string | null;
  counterpartyIban: string | null; counterpartyName: string | null;
  counterpartyBic: string | null; endToEndId: string | null; mandateId: string | null;
  bankRef: string | null; bankTxCode: BankTxCode | null; returnReasonCode: string | null;
  isReversal: boolean; batchParentId: string | null; needsManualSplit: boolean;
  dedupKey: string; raw: unknown;
  isDuplicate: boolean; suggestedCostTypeId: string | null; suggestedUnitId: string | null; suggestedOwnerId: string | null;
  matchedRuleId: string | null;
  stage2OwnerSuggestions: Stage2OwnerSuggestion[];
  stage2CostTypeSuggestion: Stage2CostTypeSuggestion | null;
  stage3CostTypeSuggestion: Stage3CostTypeSuggestion | null;
};

type EditableRow = PreviewRow & { include: boolean; costTypeId: string; unitId: string; ownerId: string };

type PreviewStatement = {
  bankAccountId: string; iban: string | null; label: string;
  rows: PreviewRow[];
  openingBalance: number | null; closingBalance: number | null; closingDate: string | null;
  rejectedEntries: { reason: string; bookingDate: string | null; amount: number | null; currency: string | null }[];
  saldenketteWarnings: { code: string; reason: string; expected: number; actual: number }[];
};

type RejectedStatement = { iban: string | null; reason: string; sourceFileName?: string };

type EditableStatement = Omit<PreviewStatement, "rows"> & { rows: EditableRow[] };

export function ImportPanel({
  bankAccounts, costTypes, units, owners, onImported, onError,
}: {
  bankAccounts: BankAccount[]; costTypes: CostType[]; units: Unit[]; owners: Owner[];
  onImported: () => void; onError: (msg: string) => void;
}) {
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [format, setFormat] = useState<"csv" | "camt053">("camt053");
  const [file, setFile] = useState<File | null>(null);

  // CSV-Mapping
  const [dateColumn, setDateColumn] = useState("Buchungstag");
  const [amountColumn, setAmountColumn] = useState("Betrag");
  const [purposeColumn, setPurposeColumn] = useState("Verwendungszweck");
  const [ibanColumn, setIbanColumn] = useState("IBAN");
  const [nameColumn, setNameColumn] = useState("");
  const [dateFormat, setDateFormat] = useState<"de" | "iso">("de");
  const [decimalSeparator, setDecimalSeparator] = useState<"," | ".">(",");
  const [delimiter, setDelimiter] = useState<";" | ",">(";");

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [statements, setStatements] = useState<EditableStatement[] | null>(null);
  const [rejectedStatements, setRejectedStatements] = useState<RejectedStatement[]>([]);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const unitNumberById = new Map(units.map((u) => [u.id, u.unit_number]));
  const ownerNameById = new Map(owners.map((o) => [o.id, o.name]));
  const costTypeNameById = new Map(costTypes.map((c) => [c.id, c.name]));
  const bankAccountLabelById = new Map(bankAccounts.map((b) => [b.id, b.label]));

  function updateRow(groupIdx: number, rowIdx: number, patch: Partial<EditableRow>) {
    setStatements((prev) =>
      prev!.map((g, gi) => (gi !== groupIdx ? g : { ...g, rows: g.rows.map((r, ri) => (ri !== rowIdx ? r : { ...r, ...patch })) })),
    );
  }

  async function loadPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !bankAccountId) return;
    setLoadingPreview(true);
    const form = new FormData();
    form.set("file", file);
    form.set("format", format);
    if (format === "csv") {
      form.set("dateColumn", dateColumn);
      form.set("amountColumn", amountColumn);
      if (purposeColumn) form.set("purposeColumn", purposeColumn);
      if (ibanColumn) form.set("counterpartyIbanColumn", ibanColumn);
      if (nameColumn) form.set("counterpartyNameColumn", nameColumn);
      form.set("dateFormat", dateFormat);
      form.set("decimalSeparator", decimalSeparator);
      form.set("delimiter", delimiter);
    }
    const res = await fetch(`/api/weg-buchhaltung/bank-accounts/${bankAccountId}/import/preview`, {
      method: "POST", body: form,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.alreadyImported) {
        onError("Diese Datei wurde bereits importiert (Datei-Hash bekannt) — es wurde nichts erneut verarbeitet.");
        setLoadingPreview(false);
        return;
      }
      setFileHash(data.fileHash ?? null);
      setRejectedStatements(data.rejectedStatements ?? []);
      setStatements(
        (data.statements as PreviewStatement[]).map((s) => ({
          ...s,
          rows: s.rows.map((r) => ({
            ...r, include: !r.isDuplicate,
            costTypeId: r.suggestedCostTypeId ?? "",
            unitId: r.suggestedUnitId ?? "",
            ownerId: r.suggestedOwnerId ?? "",
          })),
        })),
      );
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Einlesen der Datei" }));
      onError(err.error);
    }
    setLoadingPreview(false);
  }

  async function commitImport() {
    if (!statements || !file) return;
    setImporting(true);
    const res = await fetch(`/api/weg-buchhaltung/bank-accounts/${bankAccountId}/import/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        format,
        fileHash,
        rejectedStatements,
        statements: statements.map((g) => ({
          bankAccountId: g.bankAccountId,
          openingBalance: g.openingBalance,
          closingBalance: g.closingBalance,
          closingDate: g.closingDate,
          saldenketteWarnings: g.saldenketteWarnings,
          rows: g.rows.map((r) => ({
            bookingDate: r.bookingDate, amount: r.amount, purpose: r.purpose, counterpartyIban: r.counterpartyIban,
            counterpartyName: r.counterpartyName, counterpartyBic: r.counterpartyBic,
            endToEndId: r.endToEndId, mandateId: r.mandateId, bankRef: r.bankRef, bankTxCode: r.bankTxCode,
            returnReasonCode: r.returnReasonCode, isReversal: r.isReversal, batchParentId: r.batchParentId,
            needsManualSplit: r.needsManualSplit, dedupKey: r.dedupKey, raw: r.raw,
            isDuplicate: r.isDuplicate, include: r.include, costTypeId: r.costTypeId || null,
            unitId: r.unitId || null, ownerId: r.ownerId || null,
          })),
        })),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.alreadyImported) {
        onError("Diese Datei wurde bereits importiert (Datei-Hash bekannt) — es wurde nichts erneut verarbeitet.");
      } else {
        onImported();
      }
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Import" }));
      onError(err.error);
    }
    setImporting(false);
  }

  const totalIncluded = statements?.reduce((sum, g) => sum + g.rows.filter((r) => r.include).length, 0) ?? 0;
  const totalRows = statements?.reduce((sum, g) => sum + g.rows.length, 0) ?? 0;
  const totalDuplicates = statements?.reduce((sum, g) => sum + g.rows.filter((r) => r.isDuplicate).length, 0) ?? 0;

  return (
    <div className={`${cardCls} p-4 mb-3 space-y-4`}>
      {!statements ? (
        <form onSubmit={loadPreview} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className={labelCls}>Bankkonto</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls} required>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as "csv" | "camt053")} className={inputCls}>
                <option value="camt053">CAMT.053 (XML oder ZIP)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Datei</label>
              <input
                type="file" accept={format === "csv" ? ".csv" : ".xml,.zip"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 dark:text-gray-300"
                required
              />
            </div>
          </div>

          {format === "camt053" && (
            <p className="text-xs text-gray-400">
              Das ausgewählte Bankkonto dient nur als Fallback — enthält die Datei eine IBAN, wird der Umsatz automatisch dem
              passenden Konto der Immobilie zugeordnet; unbekannte IBANs werden abgelehnt und gemeldet.
            </p>
          )}

          {format === "csv" && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div>
                <label className={labelCls}>Spalte Datum</label>
                <input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Spalte Betrag</label>
                <input value={amountColumn} onChange={(e) => setAmountColumn(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Spalte Verwendungszweck</label>
                <input value={purposeColumn} onChange={(e) => setPurposeColumn(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Spalte IBAN</label>
                <input value={ibanColumn} onChange={(e) => setIbanColumn(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Spalte Name Gegenpartei</label>
                <input value={nameColumn} onChange={(e) => setNameColumn(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Datumsformat</label>
                <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as "de" | "iso")} className={inputCls}>
                  <option value="de">TT.MM.JJJJ</option>
                  <option value="iso">JJJJ-MM-TT</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Dezimaltrennzeichen</label>
                <select value={decimalSeparator} onChange={(e) => setDecimalSeparator(e.target.value as "," | ".")} className={inputCls}>
                  <option value=",">Komma (1.234,56)</option>
                  <option value=".">Punkt (1,234.56)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Spaltentrenner</label>
                <select value={delimiter} onChange={(e) => setDelimiter(e.target.value as ";" | ",")} className={inputCls}>
                  <option value=";">Semikolon</option>
                  <option value=",">Komma</option>
                </select>
              </div>
            </div>
          )}

          <button type="submit" disabled={loadingPreview || !file} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
            {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vorschau laden"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {totalRows} Zeilen gelesen, {totalDuplicates} davon als Duplikat erkannt (vorab abgewählt).
            Import erzeugt ausschließlich Entwürfe — keine Buchung wird automatisch bestätigt.
          </p>

          {rejectedStatements.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Abgelehnte Auszüge (unbekannte IBAN):</p>
                {rejectedStatements.map((r, i) => (
                  <p key={i}>{r.iban ?? "(keine IBAN)"} — {r.reason}{r.sourceFileName ? ` (${r.sourceFileName})` : ""}</p>
                ))}
              </div>
            </div>
          )}

          {statements.map((group, groupIdx) => (
            <div key={group.bankAccountId + groupIdx} className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {bankAccountLabelById.get(group.bankAccountId) ?? group.label}
                {group.iban && <span className="text-gray-400 font-normal"> · {group.iban}</span>}
              </p>

              {group.saldenketteWarnings.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>
                    {group.saldenketteWarnings.map((w, i) => (
                      <p key={i}>{w.reason} (erwartet {formatCents(w.expected)}, tatsächlich {formatCents(w.actual)})</p>
                    ))}
                  </div>
                </div>
              )}
              {group.rejectedEntries.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-2 text-xs text-gray-500">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>
                    {group.rejectedEntries.map((r, i) => (
                      <p key={i}>{r.reason}{r.currency ? ` (${r.currency})` : ""}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-gray-900">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2 font-medium">Datum</th>
                      <th className="px-3 py-2 font-medium">Zweck</th>
                      <th className="px-3 py-2 font-medium text-right">Betrag</th>
                      <th className="px-3 py-2 font-medium">Kostenart</th>
                      <th className="px-3 py-2 font-medium">Einheit</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r, i) => {
                      const hasStage2 = r.stage2OwnerSuggestions.length > 0 || r.stage2CostTypeSuggestion !== null;
                      const hasStage3 = !hasStage2 && r.stage3CostTypeSuggestion !== null;
                      return (
                        <Fragment key={i}>
                          <tr className="border-t border-gray-50 dark:border-gray-800/50">
                            <td className="px-3 py-1.5">
                              <input
                                type="checkbox" checked={r.include}
                                onChange={(e) => updateRow(groupIdx, i, { include: e.target.checked })}
                              />
                            </td>
                            <td className="px-3 py-1.5 text-gray-500">{r.bookingDate}</td>
                            <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">
                              {r.purpose ?? "–"}
                              {r.counterpartyName && <span className="text-gray-400"> · {r.counterpartyName}</span>}
                              {r.needsManualSplit && <Badge>Sammelbuchung: manuell aufteilen</Badge>}
                            </td>
                            <td className={`px-3 py-1.5 text-right font-medium ${r.amount < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {formatCents(r.amount)}
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                value={r.costTypeId}
                                onChange={(e) => updateRow(groupIdx, i, { costTypeId: e.target.value })}
                                className={`${inputCls} py-1 text-xs`}
                              >
                                <option value="">– keine –</option>
                                {costTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                value={r.unitId}
                                onChange={(e) => updateRow(groupIdx, i, { unitId: e.target.value, ownerId: "" })}
                                className={`${inputCls} py-1 text-xs`}
                              >
                                <option value="">– keine –</option>
                                {units.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-1.5">
                              {r.isDuplicate && <Badge>Duplikat</Badge>}
                            </td>
                          </tr>
                          {hasStage2 && (
                            <tr className="border-t border-gray-50 dark:border-gray-800/50 bg-amber-50/50 dark:bg-amber-500/5">
                              <td colSpan={7} className="px-3 py-2">
                                <div className="flex items-start gap-2 text-xs">
                                  <Sparkles className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                                  <div className="space-y-1">
                                    <p className="text-gray-400 dark:text-gray-500">
                                      Stufe 2 (Heuristik) — kein Regeltreffer, folgende Vorschläge zur Prüfung:
                                    </p>
                                    {r.stage2OwnerSuggestions.map((s, k) => (
                                      <div key={k} className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => updateRow(groupIdx, i, { unitId: s.unitId, ownerId: s.ownerId })}
                                          className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                        >
                                          Übernehmen: {unitNumberById.get(s.unitId) ?? s.unitId} / {ownerNameById.get(s.ownerId) ?? s.ownerId}
                                        </button>
                                        <span className={s.highlight ? "font-semibold text-orange-600" : "text-gray-500"}>
                                          {Math.round(s.score * 100)} %
                                        </span>
                                        <span className="text-gray-400">{s.reasons.join(" · ")}</span>
                                      </div>
                                    ))}
                                    {r.stage2CostTypeSuggestion && (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => updateRow(groupIdx, i, { costTypeId: r.stage2CostTypeSuggestion!.costTypeId })}
                                          className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                        >
                                          Übernehmen: {costTypeNameById.get(r.stage2CostTypeSuggestion.costTypeId) ?? r.stage2CostTypeSuggestion.costTypeId}
                                        </button>
                                        <span className={r.stage2CostTypeSuggestion.highlight ? "font-semibold text-orange-600" : "text-gray-500"}>
                                          {Math.round(r.stage2CostTypeSuggestion.score * 100)} %
                                        </span>
                                        <span className="text-gray-400">{r.stage2CostTypeSuggestion.reasons.join(" · ")}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {hasStage3 && (
                            <tr className="border-t border-gray-50 dark:border-gray-800/50 bg-violet-50/50 dark:bg-violet-500/5">
                              <td colSpan={7} className="px-3 py-2">
                                <div className="flex items-start gap-2 text-xs">
                                  <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                                  <div className="space-y-1">
                                    <p className="text-gray-400 dark:text-gray-500">
                                      Stufe 3 (KI) — kein Regel-/Heuristik-Treffer, Kostenart-Vorschlag zur Prüfung:
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateRow(groupIdx, i, { costTypeId: r.stage3CostTypeSuggestion!.costTypeId })}
                                        className="px-2 py-0.5 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                                      >
                                        Übernehmen: {r.stage3CostTypeSuggestion!.costTypeName}
                                      </button>
                                      {r.stage3CostTypeSuggestion!.confidence !== null && (
                                        <span className="text-gray-500">{Math.round(r.stage3CostTypeSuggestion!.confidence * 100)} %</span>
                                      )}
                                      {r.stage3CostTypeSuggestion!.reasoning && (
                                        <span className="text-gray-400">{r.stage3CostTypeSuggestion!.reasoning}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button
              onClick={commitImport}
              disabled={importing || totalIncluded === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : `${totalIncluded} Buchungen als Entwurf importieren`}
            </button>
            <button onClick={() => setStatements(null)} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
