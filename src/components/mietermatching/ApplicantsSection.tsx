"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, UserX, Users, X } from "lucide-react";
import { inputCls, labelCls, cardCls, STATUS_LABELS, SOURCE_LABELS, type Applicant, type Profile } from "./shared";
import { MatchCircle } from "./MatchCircle";

interface RejectionTemplate { id: string; name: string; is_default: boolean }

interface FormState {
  first_name: string;
  last_name: string;
  contact_email: string;
  contact_phone: string;
  net_income: string;
  employment_type: string;
  household_size: string;
  has_pets: boolean | null;
  is_smoker: boolean | null;
  desired_move_in: string;
  schufa_classification: "" | "none_negative" | "soft_negative" | "hard_negative";
}

const EMPTY_FORM: FormState = {
  first_name: "", last_name: "", contact_email: "", contact_phone: "", net_income: "",
  employment_type: "", household_size: "", has_pets: null, is_smoker: null,
  desired_move_in: "", schufa_classification: "",
};

export function ApplicantsSection({
  propertyId, unitId, profile, applicants, onChange, onError,
}: {
  propertyId: string; unitId: string; profile: Profile | null; applicants: Applicant[];
  onChange: () => void; onError: (msg: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [rejectionDefault, setRejectionDefault] = useState<RejectionTemplate | null>(null);
  const [bulkRejecting, setBulkRejecting] = useState(false);

  useEffect(() => {
    fetch("/api/mietermatching/message-templates?type=rejection")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: RejectionTemplate[]) => setRejectionDefault(list.find((t) => t.is_default) ?? list[0] ?? null))
      .catch(() => {});
  }, []);

  function toggleSelected(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkReject() {
    setBulkRejecting(true);
    const res = await fetch("/api/mietermatching/applicants/bulk-reject", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicant_ids: [...selected], template_id: rejectionDefault?.id ?? null }),
    });
    if (res.ok) {
      const data: { results: { applicant_id: string; ok: boolean; error?: string }[] } = await res.json();
      const failed = data.results.filter((r) => !r.ok);
      if (failed.length > 0) onError(`${failed.length} von ${data.results.length} Ablehnungen fehlgeschlagen`);
      setSelected(new Set());
      setConfirmingBulk(false);
      onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Bulk-Ablehnung fehlgeschlagen" }));
      onError(err.error);
    }
    setBulkRejecting(false);
  }

  async function createApplicant(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/mietermatching/applicants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unit_id: unitId,
        first_name: form.first_name,
        last_name: form.last_name,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        net_income: form.net_income ? Number(form.net_income) : null,
        employment_type: form.employment_type || null,
        household_size: form.household_size ? Number(form.household_size) : null,
        has_pets: form.has_pets,
        is_smoker: form.is_smoker,
        desired_move_in: form.desired_move_in || null,
        schufa_result: form.schufa_classification ? { classification: form.schufa_classification } : null,
      }),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowNew(false);
      onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Erfassen" }));
      onError(err.error);
    }
    setSaving(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Bewerber
        </h3>
        <button
          onClick={() => setShowNew((v) => !v)}
          disabled={!profile}
          title={!profile ? "Zuerst ein Wunschmieter-Profil anlegen" : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Bewerber erfassen
        </button>
      </div>

      {showNew && (
        <form onSubmit={createApplicant} className={`${cardCls} p-4 mb-3 space-y-3`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Vorname *</label>
              <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>Nachname *</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>E-Mail</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>Nettoeinkommen (€)</label>
              <input type="number" step="0.01" value={form.net_income} onChange={(e) => setForm({ ...form, net_income: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>Beschäftigungsart</label>
              <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} className={`${inputCls} w-full`}>
                <option value="">–</option>
                <option value="unbefristet">Unbefristet</option>
                <option value="befristet">Befristet</option>
                <option value="selbststaendig">Selbstständig</option>
                <option value="rentner">Rentner</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Haushaltsgröße</label>
              <input type="number" value={form.household_size} onChange={(e) => setForm({ ...form, household_size: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>Wunsch-Einzugstermin</label>
              <input type="date" value={form.desired_move_in} onChange={(e) => setForm({ ...form, desired_move_in: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={labelCls}>SCHUFA-Einschätzung</label>
              <select value={form.schufa_classification} onChange={(e) => setForm({ ...form, schufa_classification: e.target.value as FormState["schufa_classification"] })} className={`${inputCls} w-full`}>
                <option value="">keine Angabe</option>
                <option value="none_negative">Keine Negativmerkmale</option>
                <option value="soft_negative">Weiche Negativmerkmale</option>
                <option value="hard_negative">Harte Negativmerkmale</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Erfassen & bewerten"}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {selected.size > 0 && (
        <div className={`${cardCls} p-3 mb-3 flex items-center justify-between`}>
          {confirmingBulk ? (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {selected.size} Bewerber ablehnen mit Vorlage „{rejectionDefault?.name ?? "Interner Standardtext"}&quot;?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={bulkReject} disabled={bulkRejecting}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Bestätigen"}
                </button>
                <button onClick={() => setConfirmingBulk(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">{selected.size} ausgewählt</p>
              <button
                onClick={() => setConfirmingBulk(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400 hover:text-red-600"
              >
                <UserX className="w-3.5 h-3.5" /> Ausgewählte ablehnen
              </button>
            </>
          )}
        </div>
      )}

      {applicants.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Noch keine Bewerber erfasst.</p>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium w-8"></th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Quelle</th>
                <th className="px-4 py-2 font-medium">Eingang</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Match</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.id} className="border-t border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelected(a.id)} />
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/objekte/${propertyId}/einheiten/${unitId}/bewerber/${a.id}`}
                      className="text-gray-800 dark:text-gray-200 font-medium hover:text-orange-600 dark:hover:text-orange-400"
                    >
                      {a.first_name} {a.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{SOURCE_LABELS[a.source] ?? a.source}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(a.created_at).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex justify-end">
                    {a.match_result ? (
                      <MatchCircle score={a.match_result.overall_score} confidence={a.match_result.confidence} size="sm" />
                    ) : (
                      <span className="text-xs text-gray-400">–</span>
                    )}
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
