"use client";

import { useState } from "react";
import { Loader2, Plus, X, Receipt, Upload, Paperclip, Sparkles } from "lucide-react";
import {
  type BankAccount, type ChartAccount, type CostType, type Unit, type Owner, type Transaction,
  TX_KIND_LABELS, formatCents, inputCls, labelCls, cardCls,
} from "./shared";
import { ImportPanel } from "./ImportPanel";

// ════════════════════════════════════════════════════════════════════════
// BUCHUNGEN
// ════════════════════════════════════════════════════════════════════════

export function TransactionsSection({
  propertyId, bankAccounts, chartAccounts, costTypes, units, owners, transactions, onChange, onError,
}: {
  propertyId: string; bankAccounts: BankAccount[]; chartAccounts: ChartAccount[]; costTypes: CostType[];
  units: Unit[]; owners: Owner[]; transactions: Transaction[]; onChange: () => void; onError: (msg: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [amountEur, setAmountEur] = useState("");
  const [kind, setKind] = useState("expense");
  const [costTypeId, setCostTypeId] = useState("");
  const [counterAccountId, setCounterAccountId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [asDraft, setAsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  async function createTransaction(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const signedCents = Math.round(Number(amountEur) * 100) * (direction === "out" ? -1 : 1);
    const res = await fetch("/api/weg-buchhaltung/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bank_account_id: bankAccountId,
        booking_date: bookingDate,
        amount: signedCents,
        kind,
        cost_type_id: costTypeId || null,
        counter_account_id: costTypeId ? null : (counterAccountId || null),
        unit_id: unitId || null,
        purpose: purpose || null,
        status: asDraft ? "suggested" : "confirmed",
      }),
    });
    if (res.ok) {
      setBankAccountId(""); setAmountEur(""); setCostTypeId(""); setCounterAccountId("");
      setUnitId(""); setPurpose(""); setAsDraft(false); setShowNew(false);
      onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-400" />
          Buchungen
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Datei importieren
          </button>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Neue Buchung
          </button>
        </div>
      </div>

      {showImport && (
        <ImportPanel
          bankAccounts={bankAccounts}
          costTypes={costTypes}
          units={units}
          owners={owners}
          onImported={() => { setShowImport(false); onChange(); }}
          onError={onError}
        />
      )}

      {showNew && (
        <form onSubmit={createTransaction} className={`${cardCls} p-4 mb-3 space-y-3`}>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className={labelCls}>Bankkonto</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls} required>
                <option value="">wählen…</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Datum</label>
              <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Richtung</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")} className={inputCls}>
                <option value="out">Ausgang</option>
                <option value="in">Eingang</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Betrag (€)</label>
              <input type="number" step="0.01" min="0" value={amountEur} onChange={(e) => setAmountEur(e.target.value)} className={`${inputCls} w-28`} required />
            </div>
            <div>
              <label className={labelCls}>Art</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
                {Object.entries(TX_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className={labelCls}>Kostenart</label>
              <select value={costTypeId} onChange={(e) => setCostTypeId(e.target.value)} className={inputCls}>
                <option value="">– keine –</option>
                {costTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!costTypeId && (
              <div>
                <label className={labelCls}>Gegenkonto (falls keine Kostenart)</label>
                <select value={counterAccountId} onChange={(e) => setCounterAccountId(e.target.value)} className={inputCls}>
                  <option value="">wählen…</option>
                  {chartAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Einheit</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls}>
                <option value="">– keine –</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Verwendungszweck</label>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${inputCls} w-full`} />
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
            Als Entwurf speichern (noch nicht bestätigen, kein Buchungssatz)
          </label>
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

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch keine Buchungen erfasst.</p>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Datum</th>
                <th className="px-4 py-2 font-medium">Konto</th>
                <th className="px-4 py-2 font-medium">Zweck</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Kostenart</th>
                <th className="px-4 py-2 font-medium text-right">Betrag</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id} tx={t} costTypes={costTypes} chartAccounts={chartAccounts} propertyId={propertyId}
                  onChange={onChange} onError={onError}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Kategorie "FINANZEN.RECHNUNGEN_EINGANG" aus scripts/migration-categories-expand.sql
const INVOICE_CATEGORY_ID = "dc000000-0000-0000-000b-000000000001";

type InvoiceExtraction = {
  cost_type_id?: string; cost_type_name?: string | null; betrkv_no?: number;
  par35a_category?: "household_employment" | "household_service" | "craftsman";
  labor_amount_cents?: number; period_start?: string; period_end?: string;
  invoice_amount_cents?: number; invoice_number?: string;
};

const PAR35A_LABELS: Record<string, string> = {
  household_employment: "Haushaltsnahes Beschäftigungsverhältnis",
  household_service: "Haushaltsnahe Dienstleistung",
  craftsman: "Handwerkerleistung",
};

function TransactionRow({
  tx, costTypes, chartAccounts, propertyId, onChange, onError,
}: {
  tx: Transaction; costTypes: CostType[]; chartAccounts: ChartAccount[]; propertyId: string;
  onChange: () => void; onError: (msg: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [costTypeId, setCostTypeId] = useState("");
  const [counterAccountId, setCounterAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null);
  const [laborAmountEur, setLaborAmountEur] = useState("");
  const [par35aCategory, setPar35aCategory] = useState("");

  async function attachDocument(file: File) {
    setUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const storagePath = `${propertyId}/property/${INVOICE_CATEGORY_ID}/${crypto.randomUUID()}.${ext}`;
      const { error: storageErr } = await supabase.storage.from("documents").upload(storagePath, file, { contentType: file.type });
      if (storageErr) { onError(storageErr.message); return; }
      const res = await fetch("/api/documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: INVOICE_CATEGORY_ID, level: "property", property_id: propertyId,
          title: file.name.replace(/\.[^.]+$/, ""), storage_path: storagePath,
          file_name: file.name, file_size: file.size, mime_type: file.type || null,
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: "Beleg konnte nicht gespeichert werden" })); onError(err.error); return; }
      const doc = await res.json();
      setDocumentId(doc.id); setDocumentName(file.name);
    } finally {
      setUploading(false);
    }
  }

  async function extractInvoice() {
    if (!documentId) return;
    setExtracting(true);
    const res = await fetch("/api/weg-buchhaltung/extract-invoice", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId, property_id: propertyId }),
    });
    if (res.ok) {
      const data: InvoiceExtraction = await res.json();
      setExtraction(data);
    } else {
      const err = await res.json().catch(() => ({ error: "Belegerkennung fehlgeschlagen" }));
      onError(err.error);
    }
    setExtracting(false);
  }

  function applySuggestion() {
    if (!extraction) return;
    if (extraction.cost_type_id) setCostTypeId(extraction.cost_type_id);
    if (extraction.par35a_category) setPar35aCategory(extraction.par35a_category);
    if (extraction.labor_amount_cents !== undefined) setLaborAmountEur((extraction.labor_amount_cents / 100).toFixed(2));
  }

  async function confirm() {
    setSaving(true);
    const res = await fetch(`/api/weg-buchhaltung/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cost_type_id: costTypeId || undefined,
        counter_account_id: costTypeId ? undefined : (counterAccountId || undefined),
        document_id: documentId || undefined,
        labor_amount: laborAmountEur ? Math.round(Number(laborAmountEur) * 100) : undefined,
        par35a_category: par35aCategory || undefined,
        confirm: true,
      }),
    });
    if (res.ok) {
      setConfirming(false); onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Bestätigen" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <>
      <tr className="border-t border-gray-50 dark:border-gray-800/50">
        <td className="px-4 py-2 text-gray-500">{tx.booking_date}</td>
        <td className="px-4 py-2 text-gray-500">{tx.community_bank_accounts?.label ?? "–"}</td>
        <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{tx.purpose ?? TX_KIND_LABELS[tx.kind] ?? tx.kind}</td>
        <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{tx.cost_types?.name ?? "–"}</td>
        <td className={`px-4 py-2 text-right font-medium ${tx.amount < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {formatCents(tx.amount)}
        </td>
        <td className="px-4 py-2">
          {tx.status === "confirmed" ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Bestätigt</span>
          ) : (
            <button
              onClick={() => setConfirming((v) => !v)}
              className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
            >
              Entwurf — bestätigen
            </button>
          )}
        </td>
      </tr>
      {confirming && (
        <tr className="border-t border-gray-50 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-800/30">
          <td colSpan={6} className="px-4 py-3">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                  {documentName ?? "Beleg anhängen"}
                  <input
                    type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) attachDocument(f); }}
                  />
                </label>
                {documentId && (
                  <button
                    type="button" onClick={extractInvoice} disabled={extracting}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 disabled:opacity-50"
                  >
                    {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    KI-Vorschlag aus Beleg
                  </button>
                )}
              </div>

              {extraction && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                  <p>
                    <strong>Vorschlag:</strong>{" "}
                    {extraction.cost_type_name ? `Kostenart „${extraction.cost_type_name}"` : "keine Kostenart erkannt"}
                    {extraction.betrkv_no ? ` · BetrKV Nr. ${extraction.betrkv_no}` : ""}
                    {extraction.par35a_category ? ` · § 35a: ${PAR35A_LABELS[extraction.par35a_category]}` : ""}
                    {extraction.labor_amount_cents !== undefined ? ` · Lohnanteil ${formatCents(extraction.labor_amount_cents)}` : ""}
                  </p>
                  {(extraction.invoice_amount_cents !== undefined || extraction.period_start) && (
                    <p className="text-gray-500 dark:text-gray-400">
                      Laut Beleg: {extraction.invoice_amount_cents !== undefined ? formatCents(extraction.invoice_amount_cents) : "–"}
                      {extraction.period_start ? ` · Zeitraum ${extraction.period_start} – ${extraction.period_end ?? "?"}` : ""}
                      {extraction.invoice_number ? ` · Rechnungsnr. ${extraction.invoice_number}` : ""}
                    </p>
                  )}
                  <button type="button" onClick={applySuggestion} className="text-orange-600 hover:text-orange-700 font-medium">
                    Übernehmen
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <select value={costTypeId} onChange={(e) => setCostTypeId(e.target.value)} className={inputCls}>
                  <option value="">– Kostenart wählen –</option>
                  {costTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!costTypeId && (
                  <select value={counterAccountId} onChange={(e) => setCounterAccountId(e.target.value)} className={inputCls}>
                    <option value="">– oder Gegenkonto –</option>
                    {chartAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                  </select>
                )}
                <div>
                  <label className={labelCls}>§ 35a-Lohnanteil (€)</label>
                  <input type="number" step="0.01" value={laborAmountEur} onChange={(e) => setLaborAmountEur(e.target.value)} className={`${inputCls} w-28`} />
                </div>
                <div>
                  <label className={labelCls}>§ 35a-Kategorie</label>
                  <select value={par35aCategory} onChange={(e) => setPar35aCategory(e.target.value)} className={inputCls}>
                    <option value="">– keine –</option>
                    {Object.entries(PAR35A_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <button
                  onClick={confirm}
                  disabled={saving || (!costTypeId && !counterAccountId)}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Bestätigen"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
