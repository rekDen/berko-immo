"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2, Check, Minus, X as XIcon, Mail, UserX } from "lucide-react";
import { MatchCircle } from "@/components/mietermatching/MatchCircle";
import { ApplicantDocumentsSection, type ApplicantDocExtraction, type ApplicantDocumentRow } from "@/components/mietermatching/ApplicantDocumentsSection";
import { MatchingActionPanel } from "@/components/mietermatching/MatchingActionPanel";
import { CRITERION_LABELS, STATUS_LABELS, cardCls, inputCls, labelCls, type CriterionResult } from "@/components/mietermatching/shared";

interface MatchingActionEntry { id: string; action: "invited" | "rejected"; rendered_subject: string | null; performed_at: string }

interface ApplicantDetail {
  id: string;
  unit_id: string;
  first_name: string;
  last_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  net_income: number | null;
  employment_type: string | null;
  household_size: number | null;
  desired_move_in: string | null;
  schufa_result: { classification: "none_negative" | "soft_negative" | "hard_negative" } | null;
  status: string;
  documents: ApplicantDocumentRow[];
  unit: { unit_number: string; properties: { name: string; street: string | null; house_number: string | null; zip_code: string | null; city: string | null } | null } | null;
  matching_actions: MatchingActionEntry[];
  match_result: {
    overall_score: number;
    confidence: number;
    criteria_breakdown: CriterionResult[];
    missing_documents: string[];
    computed_at: string;
  } | null;
}

interface EditForm {
  net_income: string;
  employment_type: string;
  household_size: string;
  desired_move_in: string;
  schufa_classification: "" | "none_negative" | "soft_negative" | "hard_negative";
}

function toEditForm(a: ApplicantDetail): EditForm {
  return {
    net_income: a.net_income?.toString() ?? "",
    employment_type: a.employment_type ?? "",
    household_size: a.household_size?.toString() ?? "",
    desired_move_in: a.desired_move_in ?? "",
    schufa_classification: a.schufa_result?.classification ?? "",
  };
}

function CriterionIcon({ subScore }: { subScore: number }) {
  if (subScore >= 80) return <Check className="w-4 h-4 text-emerald-500" />;
  if (subScore >= 50) return <Minus className="w-4 h-4 text-amber-500" />;
  return <XIcon className="w-4 h-4 text-red-500" />;
}

export default function ApplicantDetailPage() {
  const { propertyId, unitId, applicantId } = useParams<{ propertyId: string; unitId: string; applicantId: string }>();
  const [applicant, setApplicant] = useState<ApplicantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<"invited" | "rejected" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/mietermatching/applicants/${applicantId}`);
    if (res.ok) {
      const data: ApplicantDetail = await res.json();
      setApplicant(data);
      setForm((prev) => prev ?? toEditForm(data));
    }
    setLoading(false);
  }, [applicantId]);

  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const res = await fetch(`/api/mietermatching/applicants/${applicantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        net_income: form.net_income ? Number(form.net_income) : null,
        employment_type: form.employment_type || null,
        household_size: form.household_size ? Number(form.household_size) : null,
        desired_move_in: form.desired_move_in || null,
        schufa_result: form.schufa_classification ? { classification: form.schufa_classification } : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setApplicant((prev) => (prev ? { ...prev, ...data } : prev));
      await load();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error);
    }
    setSaving(false);
  }

  function applyExtraction(extraction: ApplicantDocExtraction) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f };
      if (extraction.net_income_cents !== undefined) next.net_income = (extraction.net_income_cents / 100).toFixed(2);
      if (extraction.employment_type) next.employment_type = extraction.employment_type;
      if (extraction.household_size !== undefined) next.household_size = String(extraction.household_size);
      if (extraction.schufa_classification) next.schufa_classification = extraction.schufa_classification;
      return next;
    });
  }

  if (loading && !applicant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!applicant || !form) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Bewerber nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto bg-slate-50 dark:bg-gray-950 space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <Link href="/objekte" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Objekte</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/objekte/${propertyId}/einheiten/${unitId}`} className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Einheit
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">{applicant.first_name} {applicant.last_name}</span>
      </nav>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className={`${cardCls} p-6 flex items-center gap-6`}>
        {applicant.match_result ? (
          <MatchCircle score={applicant.match_result.overall_score} confidence={applicant.match_result.confidence} size="lg" />
        ) : (
          <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-gray-400">Noch kein Score</div>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{applicant.first_name} {applicant.last_name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {applicant.contact_email ?? "–"} {applicant.contact_phone && `· ${applicant.contact_phone}`}
          </p>
          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            {STATUS_LABELS[applicant.status] ?? applicant.status}
          </span>
          {applicant.match_result && applicant.match_result.confidence < 0.7 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Angaben unvollständig — Score mit reduzierter Konfidenz</p>
          )}
          {applicant.matching_actions.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Zuletzt {applicant.matching_actions[0].action === "invited" ? "eingeladen" : "abgelehnt"} am{" "}
              {new Date(applicant.matching_actions[0].performed_at).toLocaleDateString("de-DE")}
            </p>
          )}
          {activePanel === null && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setActivePanel("invited")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" /> Zur Besichtigung einladen
              </button>
              <button
                onClick={() => setActivePanel("rejected")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400 hover:text-red-600 transition-colors"
              >
                <UserX className="w-3.5 h-3.5" /> Ablehnen
              </button>
            </div>
          )}
        </div>
      </div>

      {activePanel && (
        <MatchingActionPanel
          action={activePanel} applicant={applicant} unit={applicant.unit}
          onDone={() => { setActivePanel(null); load(); }}
          onCancel={() => setActivePanel(null)}
          onError={setError}
        />
      )}

      {applicant.match_result && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Kriterien-Breakdown</h3>
          <div className="space-y-3">
            {applicant.match_result.criteria_breakdown.map((c) => (
              <div key={c.criterion} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                <CriterionIcon subScore={c.subScore} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{CRITERION_LABELS[c.criterion] ?? c.criterion}</p>
                  <p className="text-xs text-gray-400">
                    Bewerber: {c.applicantValue ?? "–"} · Ziel: {c.targetValue ?? "–"}
                    {c.note && ` · ${c.note}`}
                  </p>
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300 w-16 text-right">{c.subScore} / 100</div>
                <div className="text-xs text-gray-400 w-14 text-right">Gew. {c.weight}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ApplicantDocumentsSection
        applicantId={applicant.id} unitId={unitId} documents={applicant.documents}
        onChanged={load} onApply={applyExtraction} onError={setError}
      />

      <form onSubmit={save} className={`${cardCls} p-5 space-y-4`}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bewerberdaten</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
            <select
              value={form.schufa_classification}
              onChange={(e) => setForm({ ...form, schufa_classification: e.target.value as EditForm["schufa_classification"] })}
              className={`${inputCls} w-full`}
            >
              <option value="">keine Angabe</option>
              <option value="none_negative">Keine Negativmerkmale</option>
              <option value="soft_negative">Weiche Negativmerkmale</option>
              <option value="hard_negative">Harte Negativmerkmale</option>
            </select>
          </div>
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
        </button>
      </form>
    </div>
  );
}
