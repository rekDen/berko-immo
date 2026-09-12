"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, BarChart3 } from "lucide-react";
import { type ChartAccount, type CostType, type Unit, formatCents, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// BILANZ / GUV / FREIE BUCHUNGSSATZ-ERFASSUNG (B7)
// ════════════════════════════════════════════════════════════════════════

type AccountBalanceRow = { accountId: string; code: string; name: string; kind: string; balance: number };
type BalanceSheetReport = { asOf: string; assets: AccountBalanceRow[]; liabilitiesAndEquity: AccountBalanceRow[]; totalAssets: number; totalLiabilitiesAndEquity: number };
type IncomeStatementReport = { from: string; to: string; expenses: AccountBalanceRow[]; income: AccountBalanceRow[]; totalExpenses: number; totalIncome: number; result: number };

export function ReportsSection({
  propertyId, chartAccounts, costTypes, units, onEntryCreated, onError,
}: {
  propertyId: string; chartAccounts: ChartAccount[]; costTypes: CostType[]; units: Unit[];
  onEntryCreated: () => void; onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"bilanz" | "guv">("bilanz");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [showFreeEntry, setShowFreeEntry] = useState(false);

  const loadBalanceSheet = useCallback(async () => {
    setLoadingReport(true);
    const res = await fetch(`/api/weg-buchhaltung/reports/balance-sheet?property_id=${propertyId}&as_of=${asOf}`);
    if (res.ok) setBalanceSheet(await res.json());
    setLoadingReport(false);
  }, [propertyId, asOf]);

  const loadIncomeStatement = useCallback(async () => {
    setLoadingReport(true);
    const res = await fetch(`/api/weg-buchhaltung/reports/income-statement?property_id=${propertyId}&from=${from}&to=${to}`);
    if (res.ok) setIncomeStatement(await res.json());
    setLoadingReport(false);
  }, [propertyId, from, to]);

  useEffect(() => {
    if (tab === "bilanz") loadBalanceSheet();
    else loadIncomeStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          Bilanz &amp; GuV
        </h2>
        <button
          onClick={() => setShowFreeEntry((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Freie Buchung
        </button>
      </div>

      {showFreeEntry && (
        <FreeJournalEntryForm
          propertyId={propertyId}
          chartAccounts={chartAccounts}
          costTypes={costTypes}
          units={units}
          onCreated={() => { setShowFreeEntry(false); onEntryCreated(); loadBalanceSheet(); loadIncomeStatement(); }}
          onError={onError}
        />
      )}

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab("bilanz")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${tab === "bilanz" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"}`}
        >
          Bilanz
        </button>
        <button
          onClick={() => setTab("guv")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${tab === "guv" ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"}`}
        >
          GuV
        </button>
      </div>

      {tab === "bilanz" ? (
        <div className={cardCls}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <label className={labelCls}>Stichtag</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} onBlur={loadBalanceSheet} className={inputCls} />
          </div>
          {loadingReport || !balanceSheet ? (
            <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Aktiva</p>
                {balanceSheet.assets.map((a) => (
                  <div key={a.accountId} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600 dark:text-gray-300">{a.code} · {a.name}</span>
                    <span className="font-medium">{formatCents(a.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                  <span>Summe Aktiva</span><span>{formatCents(balanceSheet.totalAssets)}</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Passiva</p>
                {balanceSheet.liabilitiesAndEquity.map((a) => (
                  <div key={a.accountId} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600 dark:text-gray-300">{a.code} · {a.name}</span>
                    <span className="font-medium">{formatCents(a.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                  <span>Summe Passiva</span><span>{formatCents(balanceSheet.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={cardCls}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-wrap">
            <label className={labelCls}>Von</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} onBlur={loadIncomeStatement} className={inputCls} />
            <label className={labelCls}>Bis</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} onBlur={loadIncomeStatement} className={inputCls} />
          </div>
          {loadingReport || !incomeStatement ? (
            <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Aufwand</p>
                  {incomeStatement.expenses.map((a) => (
                    <div key={a.accountId} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600 dark:text-gray-300">{a.code} · {a.name}</span>
                      <span className="font-medium">{formatCents(a.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>Summe Aufwand</span><span>{formatCents(incomeStatement.totalExpenses)}</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Ertrag</p>
                  {incomeStatement.income.map((a) => (
                    <div key={a.accountId} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600 dark:text-gray-300">{a.code} · {a.name}</span>
                      <span className="font-medium">{formatCents(a.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>Summe Ertrag</span><span>{formatCents(incomeStatement.totalIncome)}</span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-between text-sm font-semibold">
                <span>Ergebnis (Ertrag − Aufwand)</span>
                <span className={incomeStatement.result < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                  {formatCents(incomeStatement.result)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function FreeJournalEntryForm({
  propertyId, chartAccounts, costTypes, units, onCreated, onError,
}: {
  propertyId: string; chartAccounts: ChartAccount[]; costTypes: CostType[]; units: Unit[];
  onCreated: () => void; onError: (msg: string) => void;
}) {
  type LineDraft = { accountId: string; side: "debit" | "credit"; amountEur: string; costTypeId: string; unitId: string };
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [resolutionRef, setResolutionRef] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { accountId: "", side: "debit", amountEur: "", costTypeId: "", unitId: "" },
    { accountId: "", side: "credit", amountEur: "", costTypeId: "", unitId: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const totalDebit = lines.filter((l) => l.side === "debit").reduce((s, l) => s + Math.round((Number(l.amountEur) || 0) * 100), 0);
  const totalCredit = lines.filter((l) => l.side === "credit").reduce((s, l) => s + Math.round((Number(l.amountEur) || 0) * 100), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!balanced) return;
    setSaving(true);
    const res = await fetch("/api/weg-buchhaltung/journal-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
        date,
        description,
        resolution_ref: resolutionRef || null,
        lines: lines.map((l) => ({
          account_id: l.accountId,
          debit: l.side === "debit" ? Math.round(Number(l.amountEur) * 100) : null,
          credit: l.side === "credit" ? Math.round(Number(l.amountEur) * 100) : null,
          cost_type_id: l.costTypeId || null,
          unit_id: l.unitId || null,
        })),
      }),
    });
    if (res.ok) onCreated();
    else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className={`${cardCls} p-4 mb-3 space-y-3`}>
      <p className="text-xs text-gray-400">
        Für Umbuchungen, Korrekturen oder Rückstellungen ohne einzelne Zahlung (Spec 5.8.4). Jede Zeile ist Soll oder Haben; Σ Soll muss Σ Haben entsprechen.
      </p>
      <div className="flex flex-wrap gap-3">
        <div>
          <label className={labelCls}>Datum</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className={labelCls}>Beschreibung</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} w-full`} required />
        </div>
        <div>
          <label className={labelCls}>Beschlussreferenz</label>
          <input value={resolutionRef} onChange={(e) => setResolutionRef(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <select value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })} className={inputCls} required>
              <option value="">Konto wählen…</option>
              {chartAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
            <select value={l.side} onChange={(e) => updateLine(i, { side: e.target.value as "debit" | "credit" })} className={inputCls}>
              <option value="debit">Soll</option>
              <option value="credit">Haben</option>
            </select>
            <input
              type="number" step="0.01" placeholder="Betrag €" value={l.amountEur}
              onChange={(e) => updateLine(i, { amountEur: e.target.value })} className={`${inputCls} w-28`} required
            />
            <select value={l.costTypeId} onChange={(e) => updateLine(i, { costTypeId: e.target.value })} className={inputCls}>
              <option value="">Kostenart –</option>
              {costTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={l.unitId} onChange={(e) => updateLine(i, { unitId: e.target.value })} className={inputCls}>
              <option value="">Einheit –</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
            </select>
            {lines.length > 2 && (
              <button type="button" onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { accountId: "", side: "debit", amountEur: "", costTypeId: "", unitId: "" }])}
          className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
        >
          + weitere Zeile
        </button>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className={`text-xs ${balanced ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
          Soll {formatCents(totalDebit)} · Haben {formatCents(totalCredit)} {balanced && "· ausgeglichen"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !balanced} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buchungssatz speichern"}
        </button>
      </div>
    </form>
  );
}
