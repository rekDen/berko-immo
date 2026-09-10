"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";

type BankAccount = {
  id: string;
  iban: string;
  bic: string | null;
  account_holder: string;
  sepa_mandate_reference: string | null;
  sepa_mandate_date: string | null;
  sepa_mandate_status: string | null;
};

type EditState = {
  id: string | null;
  account_holder: string;
  iban: string;
  bic: string;
  sepa_mandate_reference: string;
  sepa_mandate_date: string;
  sepa_mandate_status: string;
};

function maskIban(iban: string): string {
  if (iban.length <= 8) return iban;
  return iban.slice(0, 4) + " **** **** " + iban.slice(-4);
}

type Props = {
  contactId: string;
  defaultAccountHolder?: string;
  onChange?: () => void;
};

export default function ContactBankAccounts({ contactId, defaultAccountHolder = "", onChange }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedIbans, setRevealedIbans] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/contacts/${contactId}`);
    if (res.ok) {
      const c = await res.json();
      setAccounts(c.bank_accounts ?? []);
    }
    setLoading(false);
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEdit({
      id: null,
      account_holder: defaultAccountHolder,
      iban: "",
      bic: "",
      sepa_mandate_reference: "",
      sepa_mandate_date: "",
      sepa_mandate_status: "",
    });
    setError("");
  }

  function openEdit(ba: BankAccount) {
    setEdit({
      id: ba.id,
      account_holder: ba.account_holder,
      iban: ba.iban,
      bic: ba.bic ?? "",
      sepa_mandate_reference: ba.sepa_mandate_reference ?? "",
      sepa_mandate_date: ba.sepa_mandate_date ?? "",
      sepa_mandate_status: ba.sepa_mandate_status ?? "",
    });
    setError("");
  }

  async function save() {
    if (!edit) return;
    if (!edit.iban.trim() || !edit.account_holder.trim()) {
      setError("IBAN und Kontoinhaber sind Pflichtfelder");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      contact_id: contactId,
      account_holder: edit.account_holder,
      iban: edit.iban.replace(/\s+/g, ""),
      bic: edit.bic || null,
      sepa_mandate_reference: edit.sepa_mandate_reference || null,
      sepa_mandate_date: edit.sepa_mandate_date || null,
      sepa_mandate_status: edit.sepa_mandate_status || null,
    };

    const res = edit.id
      ? await fetch(`/api/bank-accounts/${edit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/bank-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      setEdit(null);
      await load();
      onChange?.();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error ?? "Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Bankverbindung wirklich löschen?")) return;
    const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      onChange?.();
    }
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Bankverbindung hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Keine Bankverbindungen</p>
      ) : (
        <div className="space-y-3">
          {accounts.map((ba) => (
            <div
              key={ba.id}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 group"
            >
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ba.account_holder}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                  {revealedIbans.has(ba.id) ? ba.iban : maskIban(ba.iban)}
                </p>
                {ba.bic && <p className="text-xs text-gray-400 mt-0.5">BIC: {ba.bic}</p>}
              </div>
              <div className="flex items-center gap-3">
                {ba.sepa_mandate_status && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ba.sepa_mandate_status === "active"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                    }`}
                  >
                    SEPA {ba.sepa_mandate_status === "active" ? "aktiv" : "inaktiv"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const next = new Set(revealedIbans);
                    if (next.has(ba.id)) next.delete(ba.id);
                    else next.add(ba.id);
                    setRevealedIbans(next);
                  }}
                  className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400"
                >
                  {revealedIbans.has(ba.id) ? "Verbergen" : "Anzeigen"}
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEdit(ba)}
                    className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(ba.id)}
                    className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !saving && setEdit(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {edit.id ? "Bankverbindung bearbeiten" : "Neue Bankverbindung"}
              </h3>
              <button
                type="button"
                onClick={() => setEdit(null)}
                disabled={saving}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Kontoinhaber *</label>
                <input
                  value={edit.account_holder}
                  onChange={(e) => setEdit({ ...edit, account_holder: e.target.value })}
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">IBAN *</label>
                  <input
                    value={edit.iban}
                    onChange={(e) => setEdit({ ...edit, iban: e.target.value })}
                    placeholder="DE…"
                    className="w-full text-sm font-mono rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">BIC</label>
                  <input
                    value={edit.bic}
                    onChange={(e) => setEdit({ ...edit, bic: e.target.value })}
                    className="w-full text-sm font-mono rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">SEPA-Mandat (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Mandatsreferenz</label>
                    <input
                      value={edit.sepa_mandate_reference}
                      onChange={(e) => setEdit({ ...edit, sepa_mandate_reference: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Mandatsdatum</label>
                    <input
                      type="date"
                      value={edit.sepa_mandate_date}
                      onChange={(e) => setEdit({ ...edit, sepa_mandate_date: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Mandatsstatus</label>
                  <select
                    value={edit.sepa_mandate_status}
                    onChange={(e) => setEdit({ ...edit, sepa_mandate_status: e.target.value })}
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  >
                    <option value="">– Kein Mandat –</option>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                    <option value="revoked">Widerrufen</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <button
                type="button"
                onClick={() => setEdit(null)}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
