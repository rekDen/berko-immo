"use client";

import { useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { inputCls, labelCls, cardCls, CRITERION_LABELS, type Profile } from "./shared";
import { DOC_TYPE_LABELS, type ApplicantDocType, type CriterionKey } from "@/lib/mietermatching/scoring";

// Feste Anzeigereihenfolge der sechs gewichtbaren Kriterien (Spec §3.2/§7).
const WEIGHT_CRITERIA: CriterionKey[] = [
  "income_ratio", "employment", "schufa", "household_size", "move_in", "documents_completeness",
];

const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  income_ratio: 30, employment: 15, schufa: 25, household_size: 10, move_in: 10, documents_completeness: 10,
};

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "unbefristet", label: "Unbefristet angestellt" },
  { value: "befristet", label: "Befristet angestellt" },
  { value: "selbststaendig", label: "Selbstständig" },
  { value: "rentner", label: "Rentner (mit Bürgen)" },
  { value: "student", label: "Student (mit Bürgen)" },
];

const DOC_TYPE_OPTIONS = Object.entries(DOC_TYPE_LABELS) as [ApplicantDocType, string][];

interface FormState {
  target_rent_cold: string;
  min_net_income: string;
  income_to_rent_ratio_min: string;
  employment_types_accepted: string[];
  household_size_min: string;
  household_size_max: string;
  pets_allowed: boolean | null;
  smoking_allowed: boolean | null;
  move_in_earliest: string;
  move_in_latest: string;
  schufa_required: boolean;
  required_documents: ApplicantDocType[];
  weights: Record<CriterionKey, number>;
}

function toFormState(p: Profile | null): FormState {
  return {
    target_rent_cold: p?.target_rent_cold?.toString() ?? "",
    min_net_income: p?.min_net_income?.toString() ?? "",
    income_to_rent_ratio_min: p?.income_to_rent_ratio_min?.toString() ?? "3.0",
    employment_types_accepted: p?.employment_types_accepted ?? [],
    household_size_min: p?.household_size_min?.toString() ?? "",
    household_size_max: p?.household_size_max?.toString() ?? "",
    pets_allowed: p?.pets_allowed ?? null,
    smoking_allowed: p?.smoking_allowed ?? null,
    move_in_earliest: p?.move_in_earliest ?? "",
    move_in_latest: p?.move_in_latest ?? "",
    schufa_required: p?.schufa_required ?? false,
    required_documents: (p?.required_documents as ApplicantDocType[] | undefined) ?? [],
    weights: { ...DEFAULT_WEIGHTS, ...(p?.weights as Partial<Record<CriterionKey, number>> | undefined) },
  };
}

export function ProfileEditor({
  unitId, profile, onChange, onError,
}: {
  unitId: string; profile: Profile | null; onChange: () => void; onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(profile));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setForm(toFormState(profile));
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      unit_id: unitId,
      target_rent_cold: form.target_rent_cold ? Number(form.target_rent_cold) : null,
      min_net_income: form.min_net_income ? Number(form.min_net_income) : null,
      income_to_rent_ratio_min: Number(form.income_to_rent_ratio_min) || 3.0,
      employment_types_accepted: form.employment_types_accepted,
      household_size_min: form.household_size_min ? Number(form.household_size_min) : null,
      household_size_max: form.household_size_max ? Number(form.household_size_max) : null,
      pets_allowed: form.pets_allowed,
      smoking_allowed: form.smoking_allowed,
      move_in_earliest: form.move_in_earliest || null,
      move_in_latest: form.move_in_latest || null,
      schufa_required: form.schufa_required,
      required_documents: form.required_documents,
      weights: form.weights,
    };

    const res = profile
      ? await fetch(`/api/mietermatching/profiles/${profile.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })
      : await fetch("/api/mietermatching/profiles", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });

    if (res.ok) {
      setEditing(false);
      onChange();
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      onError(err.error);
    }
    setSaving(false);
  }

  function toggleEmploymentType(value: string) {
    setForm((f) => ({
      ...f,
      employment_types_accepted: f.employment_types_accepted.includes(value)
        ? f.employment_types_accepted.filter((v) => v !== value)
        : [...f.employment_types_accepted, value],
    }));
  }

  function toggleRequiredDocument(value: ApplicantDocType) {
    setForm((f) => ({
      ...f,
      required_documents: f.required_documents.includes(value)
        ? f.required_documents.filter((v) => v !== value)
        : [...f.required_documents, value],
    }));
  }

  const weightSum = WEIGHT_CRITERIA.reduce((sum, k) => sum + (form.weights[k] || 0), 0);

  if (!editing) {
    return (
      <div className={`${cardCls} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Wunschmieter-Profil
          </h3>
          <button
            onClick={startEditing}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            {profile ? "Profil bearbeiten" : "Profil anlegen"}
          </button>
        </div>
        {!profile ? (
          <p className="text-sm text-gray-400 py-2">
            Noch kein Wunschmieter-Profil angelegt — ohne Profil können keine Bewerber erfasst werden.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Zielmiete kalt</p><p className="text-gray-700 dark:text-gray-300">{profile.target_rent_cold ? `${profile.target_rent_cold} €` : "–"}</p></div>
            <div><p className="text-xs text-gray-400">Einkommen/Miete-Quote</p><p className="text-gray-700 dark:text-gray-300">min. {profile.income_to_rent_ratio_min}×</p></div>
            <div><p className="text-xs text-gray-400">Haushaltsgröße</p><p className="text-gray-700 dark:text-gray-300">{profile.household_size_min ?? "–"}–{profile.household_size_max ?? "–"}</p></div>
            <div><p className="text-xs text-gray-400">Einzugszeitraum</p><p className="text-gray-700 dark:text-gray-300">{profile.move_in_earliest ?? "–"} – {profile.move_in_latest ?? "–"}</p></div>
            <div><p className="text-xs text-gray-400">Beschäftigung</p><p className="text-gray-700 dark:text-gray-300">{profile.employment_types_accepted.length ? profile.employment_types_accepted.join(", ") : "beliebig"}</p></div>
            <div><p className="text-xs text-gray-400">SCHUFA erforderlich</p><p className="text-gray-700 dark:text-gray-300">{profile.schufa_required ? "Ja" : "Nein"}</p></div>
            <div>
              <p className="text-xs text-gray-400">Benötigte Dokumente</p>
              <p className="text-gray-700 dark:text-gray-300">
                {profile.required_documents.length
                  ? profile.required_documents.map((d) => DOC_TYPE_LABELS[d as ApplicantDocType] ?? d).join(", ")
                  : "keine"}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-gray-400">Gewichtung der Kriterien</p>
              <p className="text-gray-700 dark:text-gray-300">
                {WEIGHT_CRITERIA.map((k) => `${CRITERION_LABELS[k]} ${(profile.weights as Record<CriterionKey, number> | undefined)?.[k] ?? DEFAULT_WEIGHTS[k]} %`).join(" · ")}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={save} className={`${cardCls} p-4 space-y-4`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Wunschmieter-Profil</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Zielmiete kalt (€)</label>
          <input type="number" step="0.01" value={form.target_rent_cold} onChange={(e) => setForm({ ...form, target_rent_cold: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Einkommen/Miete-Quote (min.)</label>
          <input type="number" step="0.1" value={form.income_to_rent_ratio_min} onChange={(e) => setForm({ ...form, income_to_rent_ratio_min: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Mindest-Nettoeinkommen (€)</label>
          <input type="number" step="0.01" value={form.min_net_income} onChange={(e) => setForm({ ...form, min_net_income: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Haushaltsgröße min.</label>
          <input type="number" value={form.household_size_min} onChange={(e) => setForm({ ...form, household_size_min: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Haushaltsgröße max.</label>
          <input type="number" value={form.household_size_max} onChange={(e) => setForm({ ...form, household_size_max: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Einzug frühestens</label>
          <input type="date" value={form.move_in_earliest} onChange={(e) => setForm({ ...form, move_in_earliest: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Einzug spätestens</label>
          <input type="date" value={form.move_in_latest} onChange={(e) => setForm({ ...form, move_in_latest: e.target.value })} className={`${inputCls} w-full`} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Akzeptierte Beschäftigungsarten</label>
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
            <button
              type="button" key={opt.value} onClick={() => toggleEmploymentType(opt.value)}
              className={`px-2.5 py-1 text-xs rounded-full border ${
                form.employment_types_accepted.includes(opt.value)
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="schufa_required" checked={form.schufa_required} onChange={(e) => setForm({ ...form, schufa_required: e.target.checked })} />
        <label htmlFor="schufa_required" className="text-sm text-gray-600 dark:text-gray-300">SCHUFA-Auskunft erforderlich</label>
      </div>

      <div>
        <label className={labelCls}>Benötigte Dokumente</label>
        <div className="flex flex-wrap gap-2">
          {DOC_TYPE_OPTIONS.map(([value, label]) => (
            <button
              type="button" key={value} onClick={() => toggleRequiredDocument(value)}
              className={`px-2.5 py-1 text-xs rounded-full border ${
                form.required_documents.includes(value)
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Gewichtung der Kriterien</label>
          <span className={`text-xs ${weightSum === 100 ? "text-gray-400" : "text-amber-600 dark:text-amber-400"}`}>
            Summe: {weightSum} % {weightSum !== 100 && "(sollte 100 % ergeben)"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {WEIGHT_CRITERIA.map((k) => (
            <div key={k}>
              <label className={labelCls}>{CRITERION_LABELS[k]} (%)</label>
              <input
                type="number" min={0} max={100} value={form.weights[k]}
                onChange={(e) => setForm({ ...form, weights: { ...form.weights, [k]: Number(e.target.value) } })}
                className={`${inputCls} w-full`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
      </div>
    </form>
  );
}
