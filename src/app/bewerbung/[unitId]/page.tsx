"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle, Upload, FileText } from "lucide-react";
import Logo from "@/components/Logo";
import { DOC_TYPE_LABELS, type ApplicantDocType } from "@/lib/mietermatching/scoring";

interface PublicUnitInfo {
  unit_number: string;
  property_name: string;
  property_address: string;
  employment_types_accepted: string[];
  household_size_min: number | null;
  household_size_max: number | null;
  move_in_earliest: string | null;
  move_in_latest: string | null;
  schufa_required: boolean;
  required_documents: ApplicantDocType[];
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  unbefristet: "Unbefristet angestellt", befristet: "Befristet angestellt",
  selbststaendig: "Selbstständig", rentner: "Rentner (mit Bürgen)", student: "Student (mit Bürgen)",
};

const inputCls =
  "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
const labelCls = "block text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400";

// Öffentliches Bewerbungsformular für Mietinteressenten — kein Login nötig,
// der Link (/bewerbung/<unitId>) wird vom Verwalter direkt verschickt.
// Speichern legt den Bewerber an und löst die Score-Berechnung serverseitig
// aus (POST /api/public/mietermatching/[unitId]/apply); der Bewerber sieht
// seinen eigenen Score nie — nur eine Erfolgsbestätigung.
export default function BewerbungPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const [info, setInfo] = useState<PublicUnitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [netIncome, setNetIncome] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [desiredMoveIn, setDesiredMoveIn] = useState("");
  const [files, setFiles] = useState<Partial<Record<ApplicantDocType, File>>>({});

  useEffect(() => {
    fetch(`/api/public/mietermatching/${unitId}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        setInfo(await res.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [unitId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData();
    form.set("first_name", firstName);
    form.set("last_name", lastName);
    form.set("contact_email", email);
    if (phone) form.set("contact_phone", phone);
    if (netIncome) form.set("net_income", netIncome);
    if (employmentType) form.set("employment_type", employmentType);
    if (householdSize) form.set("household_size", householdSize);
    if (desiredMoveIn) form.set("desired_move_in", desiredMoveIn);
    for (const [docType, file] of Object.entries(files)) {
      if (file) form.set(`doc_${docType}`, file);
    }

    const res = await fetch(`/api/public/mietermatching/${unitId}/apply`, { method: "POST", body: form });
    if (res.ok) {
      setSubmitted(true);
    } else {
      const err = await res.json().catch(() => ({ error: "Die Bewerbung konnte nicht übermittelt werden" }));
      setError(err.error);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Für diesen Link ist aktuell keine Bewerbung möglich. Bitte wende dich an die Hausverwaltung.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-gray-950">
        <div className="w-full max-w-md text-center">
          <Logo className="h-10 w-auto max-w-[70%] mx-auto mb-6 text-gray-900 dark:text-white" />
          <div className="bg-white border border-gray-200 rounded-2xl p-8 dark:bg-gray-900 dark:border-gray-800">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Vielen Dank!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ihre Bewerbung für {info.property_name}, Einheit {info.unit_number} ist eingegangen. Die Hausverwaltung meldet sich bei Ihnen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-gray-950">
      <div className="w-full max-w-lg py-8">
        <div className="text-center mb-6">
          <Logo className="h-10 w-auto max-w-[70%] mx-auto mb-4 text-gray-900 dark:text-white" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Bewerbung — {info.property_name}, Einheit {info.unit_number}
          </h1>
          {info.property_address && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{info.property_address}</p>}
        </div>

        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-5 dark:bg-gray-900 dark:border-gray-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Vorname *</label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nachname *</label>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>E-Mail *</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Netto-Einkommen (€/Monat)</label>
              <input type="number" step="0.01" value={netIncome} onChange={(e) => setNetIncome(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Beschäftigungsart</label>
              <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className={inputCls}>
                <option value="">– bitte wählen –</option>
                {(info.employment_types_accepted.length ? info.employment_types_accepted : Object.keys(EMPLOYMENT_LABELS)).map((v) => (
                  <option key={v} value={v}>{EMPLOYMENT_LABELS[v] ?? v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Haushaltsgröße{(info.household_size_min || info.household_size_max) && ` (gesucht: ${info.household_size_min ?? "–"}–${info.household_size_max ?? "–"})`}
              </label>
              <input type="number" min={1} value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                Wunsch-Einzugstermin{(info.move_in_earliest || info.move_in_latest) && ` (gesucht: ${info.move_in_earliest ?? "–"} – ${info.move_in_latest ?? "–"})`}
              </label>
              <input type="date" value={desiredMoveIn} onChange={(e) => setDesiredMoveIn(e.target.value)} className={inputCls} />
            </div>
          </div>

          {info.required_documents.length > 0 && (
            <div>
              <label className={labelCls}>Unterlagen (PDF oder Foto, je max. 10 MB)</label>
              <div className="space-y-2">
                {info.required_documents.map((docType) => (
                  <div key={docType} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{DOC_TYPE_LABELS[docType]}</span>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      {files[docType] ? files[docType]!.name : "Datei wählen"}
                      <input
                        type="file" accept="application/pdf,image/png,image/jpeg" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; setFiles((prev) => ({ ...prev, [docType]: f })); }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Bewerbung absenden
          </button>
        </form>
      </div>
    </div>
  );
}
