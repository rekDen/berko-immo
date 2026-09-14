"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Mail, X } from "lucide-react";
import { inputCls, labelCls, cardCls } from "./shared";
import {
  buildApplicantMessageVars, renderTemplate, findUnfilledPlaceholders,
  DEFAULT_INVITATION_SUBJECT, DEFAULT_INVITATION_BODY, DEFAULT_REJECTION_SUBJECT, DEFAULT_REJECTION_BODY,
  type MessageTemplateType,
} from "@/lib/mietermatching/message-templates";

interface Template { id: string; name: string; subject: string; body: string; is_default: boolean; active: boolean }
interface UnitInfo { unit_number: string; properties: { name: string; street: string | null; house_number: string | null; zip_code: string | null; city: string | null } | null }
interface ApplicantInfo { id: string; first_name: string; last_name: string; contact_email: string | null }

function unitLabelOf(unit: UnitInfo | null): string {
  if (!unit) return "";
  return `${unit.properties?.name ?? ""} · Einheit ${unit.unit_number}`;
}
function unitAddressOf(unit: UnitInfo | null): string {
  const p = unit?.properties;
  if (!p) return "";
  return `${p.street ?? ""} ${p.house_number ?? ""}, ${p.zip_code ?? ""} ${p.city ?? ""}`.replace(/\s+/g, " ").trim();
}

// Spec §6.1: Einladen/Ablehnen-Dialog mit Vorschau, Vorlagen-Auswahl,
// editierbarem Text vor dem Versand. Rendering läuft clientseitig über
// dieselben reinen Funktionen wie im Einstellungen-Editor (message-templates.ts,
// isomorph) — die Route versendet nur, was der Verwalter hier geprüft hat.
export function MatchingActionPanel({
  action, applicant, unit, onDone, onCancel, onError,
}: {
  action: "invited" | "rejected"; applicant: ApplicantInfo; unit: UnitInfo | null;
  onDone: () => void; onCancel: () => void; onError: (msg: string) => void;
}) {
  const type: MessageTemplateType = action === "invited" ? "invitation" : "rejection";
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [viewingAppointment, setViewingAppointment] = useState("");
  const [managerName, setManagerName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  function render(subjectTpl: string, bodyTpl: string, appointment: string) {
    const vars = buildApplicantMessageVars({
      firstName: applicant.first_name, lastName: applicant.last_name,
      unitLabel: unitLabelOf(unit), unitAddress: unitAddressOf(unit),
      managerName, firmName,
      viewingAppointment: type === "invitation" ? appointment : undefined,
    });
    setSubject(renderTemplate(subjectTpl, vars));
    setBody(renderTemplate(bodyTpl, vars));
  }

  useEffect(() => {
    async function load() {
      const [templatesRes, profileRes] = await Promise.all([
        fetch(`/api/mietermatching/message-templates?type=${type}`),
        fetch("/api/profile"),
      ]);
      let mgrName = "", firm = "";
      if (profileRes.ok) {
        const p: { name?: string; firm_name?: string | null } = await profileRes.json();
        mgrName = p.name ?? ""; firm = p.firm_name ?? "";
        setManagerName(mgrName); setFirmName(firm);
      }
      let list: Template[] = [];
      if (templatesRes.ok) list = (await templatesRes.json()).filter((t: Template) => t.active);
      setTemplates(list);

      const chosen = list.find((t) => t.is_default) ?? list[0] ?? null;
      const subjectTpl = chosen?.subject ?? (type === "invitation" ? DEFAULT_INVITATION_SUBJECT : DEFAULT_REJECTION_SUBJECT);
      const bodyTpl = chosen?.body ?? (type === "invitation" ? DEFAULT_INVITATION_BODY : DEFAULT_REJECTION_BODY);
      setTemplateId(chosen?.id ?? "");

      const vars = buildApplicantMessageVars({
        firstName: applicant.first_name, lastName: applicant.last_name,
        unitLabel: unitLabelOf(unit), unitAddress: unitAddressOf(unit),
        managerName: mgrName, firmName: firm,
        viewingAppointment: undefined,
      });
      setSubject(renderTemplate(subjectTpl, vars));
      setBody(renderTemplate(bodyTpl, vars));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTemplate(id: string) {
    setTemplateId(id);
    const chosen = templates.find((t) => t.id === id) ?? null;
    const subjectTpl = chosen?.subject ?? (type === "invitation" ? DEFAULT_INVITATION_SUBJECT : DEFAULT_REJECTION_SUBJECT);
    const bodyTpl = chosen?.body ?? (type === "invitation" ? DEFAULT_INVITATION_BODY : DEFAULT_REJECTION_BODY);
    render(subjectTpl, bodyTpl, viewingAppointment);
  }

  function changeAppointment(value: string) {
    setViewingAppointment(value);
    const chosen = templates.find((t) => t.id === templateId) ?? null;
    const subjectTpl = chosen?.subject ?? DEFAULT_INVITATION_SUBJECT;
    const bodyTpl = chosen?.body ?? DEFAULT_INVITATION_BODY;
    render(subjectTpl, bodyTpl, value);
  }

  async function confirm() {
    if (!applicant.contact_email) { onError("Bewerber hat keine E-Mail-Adresse hinterlegt"); return; }
    setSending(true);
    const res = await fetch(`/api/mietermatching/applicants/${applicant.id}/matching-action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, template_id: templateId || null, subject, body }),
    });
    if (res.ok) {
      onDone();
    } else {
      const err = await res.json().catch(() => ({ error: "Versand fehlgeschlagen" }));
      onError(err.error);
    }
    setSending(false);
  }

  const unfilled = loading ? [] : findUnfilledPlaceholders(`${subject}\n${body}`);

  return (
    <div className={`${cardCls} p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Mail className="w-4 h-4 text-gray-400" />
          {action === "invited" ? "Zur Besichtigung einladen" : "Bewerber ablehnen"}
        </h3>
        <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      ) : (
        <>
          {templates.length > 1 && (
            <div>
              <label className={labelCls}>Vorlage</label>
              <select value={templateId} onChange={(e) => changeTemplate(e.target.value)} className={`${inputCls} w-full`}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {action === "invited" && (
            <div>
              <label className={labelCls}>Besichtigungstermin</label>
              <input
                value={viewingAppointment} onChange={(e) => changeAppointment(e.target.value)} className={`${inputCls} w-full`}
                placeholder="z. B. Montag, 20.10.2026, 17 Uhr"
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Betreff</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>Text</label>
            <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          {unfilled.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Nicht befüllte Platzhalter: {unfilled.map((p) => `{{${p}}}`).join(", ")}
            </p>
          )}
          {!applicant.contact_email && (
            <p className="text-xs text-red-500">Bewerber hat keine E-Mail-Adresse hinterlegt — Versand nicht möglich.</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={confirm} disabled={sending || !applicant.contact_email}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Bestätigen & senden"}
            </button>
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
          </div>
        </>
      )}
    </div>
  );
}
