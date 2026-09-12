"use client";

import { useState } from "react";
import { Loader2, Wallet, Check, AlertTriangle } from "lucide-react";
import { type BankAccount, formatCents, inputCls, labelCls, cardCls } from "./shared";

// ════════════════════════════════════════════════════════════════════════
// BANKKONTEN & KONTENABSTIMMUNG
// ════════════════════════════════════════════════════════════════════════

export function BankAccountsSection({
  bankAccounts, onChange, onError,
}: {
  bankAccounts: BankAccount[]; onChange: () => void; onError: (msg: string) => void;
}) {
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);

  async function addConfirmation(bankAccountId: string, e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/weg-buchhaltung/bank-accounts/${bankAccountId}/balance-confirmations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, balance: Math.round(Number(balance) * 100) }),
    });
    if (res.ok) {
      setBalance(""); setOpenFormId(null); onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-gray-400" />
        Bankkonten & Kontenabstimmung
      </h2>

      {bankAccounts.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Keine Bankkonten der Gemeinschaft angelegt.</p>
      ) : (
        <div className="space-y-3">
          {bankAccounts.map((b) => {
            const r = b.reconciliation;
            const reconciled = r?.difference === 0;
            return (
              <div key={b.id} className={cardCls}>
                <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {b.label} <span className="text-xs text-gray-400 font-normal">({b.kind === "operating" ? "Bewirtschaftung" : "Rücklage"})</span>
                    </p>
                    <p className="text-xs text-gray-400 font-mono">{b.iban}</p>
                  </div>
                  <button
                    onClick={() => setOpenFormId(openFormId === b.id ? null : b.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Kontoauszugssaldo erfassen
                  </button>
                </div>

                {openFormId === b.id && (
                  <form onSubmit={(e) => addConfirmation(b.id, e)} className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-end gap-2">
                    <div>
                      <label className={labelCls}>Stichtag</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
                    </div>
                    <div>
                      <label className={labelCls}>Saldo (€)</label>
                      <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className={`${inputCls} w-32`} required />
                    </div>
                    <button type="submit" disabled={saving} className="px-3 py-2 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Speichern"}
                    </button>
                  </form>
                )}

                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-sm">
                  {!r ? (
                    <p className="text-gray-400">Noch kein Kontoauszugssaldo erfasst.</p>
                  ) : r.movementsSum === null ? (
                    <p className="text-gray-500">
                      Ein Saldo erfasst: <strong>{formatCents(r.latest.balance)}</strong> zum {r.latest.date}. Abstimmung ab dem nächsten Saldo möglich.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-gray-600 dark:text-gray-300">
                      <span>Anfangsbestand ({r.opening.date}): <strong>{formatCents(r.opening.balance)}</strong></span>
                      <span>+ Buchungen: <strong>{formatCents(r.movementsSum)}</strong></span>
                      <span>= Rechnerisch: <strong>{formatCents(r.computedClosing!)}</strong></span>
                      <span>Kontoauszug ({r.latest.date}): <strong>{formatCents(r.latest.balance)}</strong></span>
                      {reconciled ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check className="w-4 h-4" /> Stimmt überein
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                          <AlertTriangle className="w-4 h-4" /> Differenz: {formatCents(r.difference!)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
