"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { type BankAccount, type CostType, Badge, formatCents, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// DATEI-IMPORT (CSV / CAMT.053)
// ════════════════════════════════════════════════════════════════════════

type PreviewRow = {
  bookingDate: string; amount: number; purpose: string | null; counterpartyIban: string | null;
  isDuplicate: boolean; suggestedCostTypeId: string | null; matchedRuleId: string | null;
};

export function ImportPanel({
  bankAccounts, costTypes, onImported, onError,
}: {
  bankAccounts: BankAccount[]; costTypes: CostType[]; onImported: () => void; onError: (msg: string) => void;
}) {
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [format, setFormat] = useState<"csv" | "camt053">("camt053");
  const [file, setFile] = useState<File | null>(null);

  // CSV-Mapping
  const [dateColumn, setDateColumn] = useState("Buchungstag");
  const [amountColumn, setAmountColumn] = useState("Betrag");
  const [purposeColumn, setPurposeColumn] = useState("Verwendungszweck");
  const [ibanColumn, setIbanColumn] = useState("IBAN");
  const [dateFormat, setDateFormat] = useState<"de" | "iso">("de");
  const [decimalSeparator, setDecimalSeparator] = useState<"," | ".">(",");
  const [delimiter, setDelimiter] = useState<";" | ",">(";");

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [rows, setRows] = useState<(PreviewRow & { include: boolean; costTypeId: string })[] | null>(null);
  const [importing, setImporting] = useState(false);

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
      form.set("dateFormat", dateFormat);
      form.set("decimalSeparator", decimalSeparator);
      form.set("delimiter", delimiter);
    }
    const res = await fetch(`/api/weg-buchhaltung/bank-accounts/${bankAccountId}/import/preview`, {
      method: "POST", body: form,
    });
    if (res.ok) {
      const data = await res.json();
      setRows(
        data.rows.map((r: PreviewRow) => ({
          ...r, include: !r.isDuplicate, costTypeId: r.suggestedCostTypeId ?? "",
        }))
      );
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Einlesen der Datei" }));
      onError(err.error);
    }
    setLoadingPreview(false);
  }

  async function commitImport() {
    if (!rows || !file) return;
    setImporting(true);
    const res = await fetch(`/api/weg-buchhaltung/bank-accounts/${bankAccountId}/import/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        format,
        rows: rows.map((r) => ({
          bookingDate: r.bookingDate, amount: r.amount, purpose: r.purpose, counterpartyIban: r.counterpartyIban,
          isDuplicate: r.isDuplicate, include: r.include, costTypeId: r.costTypeId || null,
        })),
      }),
    });
    if (res.ok) {
      onImported();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Import" }));
      onError(err.error);
    }
    setImporting(false);
  }

  const includedCount = rows?.filter((r) => r.include).length ?? 0;

  return (
    <div className={`${cardCls} p-4 mb-3 space-y-4`}>
      {!rows ? (
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
                <option value="camt053">CAMT.053 (XML)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Datei</label>
              <input
                type="file" accept={format === "csv" ? ".csv" : ".xml"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 dark:text-gray-300"
                required
              />
            </div>
          </div>

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
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {rows.length} Zeilen gelesen, {rows.filter((r) => r.isDuplicate).length} davon als Duplikat erkannt (vorab abgewählt).
            Import erzeugt ausschließlich Entwürfe — keine Buchung wird automatisch bestätigt.
          </p>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Zweck</th>
                  <th className="px-3 py-2 font-medium text-right">Betrag</th>
                  <th className="px-3 py-2 font-medium">Kostenart</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox" checked={r.include}
                        onChange={(e) => setRows((prev) => prev!.map((row, j) => j === i ? { ...row, include: e.target.checked } : row))}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{r.bookingDate}</td>
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{r.purpose ?? "–"}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${r.amount < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCents(r.amount)}
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={r.costTypeId}
                        onChange={(e) => setRows((prev) => prev!.map((row, j) => j === i ? { ...row, costTypeId: e.target.value } : row))}
                        className={`${inputCls} py-1 text-xs`}
                      >
                        <option value="">– keine –</option>
                        {costTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      {r.isDuplicate && <Badge>Duplikat</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={commitImport}
              disabled={importing || includedCount === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : `${includedCount} Buchungen als Entwurf importieren`}
            </button>
            <button onClick={() => setRows(null)} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
