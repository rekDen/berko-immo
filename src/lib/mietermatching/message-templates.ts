/**
 * KI-Mietermatching MM3 — Einladen/Ablehnen mit E-Mail-Vorlagen (Spec §6).
 * Reine Funktionen — keine DB-/Netzwerkzugriffe, isomorph (Client + Server
 * nutzbar, wie scoring.ts). `renderTemplate()` selbst ist bereits als reine
 * `{{key}}`-Ersetzung in src/lib/weg-settlement/template.ts vorhanden und
 * wird von hier aus wiederverwendet statt dupliziert — dort historisch
 * gewachsen, aber ohne WEG-spezifische Abhängigkeit.
 */

export { renderTemplate } from "@/lib/weg-settlement/template";

export type MessageTemplateType = "invitation" | "rejection";

// Spec §6.2: feste Platzhalterliste. {{besichtigungstermin}} nur bei Einladung.
export const DEFAULT_INVITATION_SUBJECT = "Einladung zur Besichtigung — {{einheit_bezeichnung}}";
export const DEFAULT_INVITATION_BODY = `Sehr geehrte/r {{vorname}} {{nachname}},

vielen Dank für Ihr Interesse an der Wohnung {{einheit_bezeichnung}}, {{einheit_adresse}}.

Wir laden Sie herzlich zu einer Besichtigung ein: {{besichtigungstermin}}.

Bitte teilen Sie uns kurz mit, ob der Termin für Sie passt.

Mit freundlichen Grüßen
{{verwalter_name}}
{{firma_name}}`;

export const DEFAULT_REJECTION_SUBJECT = "Ihre Bewerbung für {{einheit_bezeichnung}}";
export const DEFAULT_REJECTION_BODY = `Sehr geehrte/r {{vorname}} {{nachname}},

vielen Dank für Ihr Interesse an der Wohnung {{einheit_bezeichnung}}, {{einheit_adresse}}.

Nach sorgfältiger Prüfung aller Bewerbungen haben wir uns für eine andere Interessentin bzw. einen anderen Interessenten entschieden.

Wir wünschen Ihnen für Ihre weitere Wohnungssuche viel Erfolg.

Mit freundlichen Grüßen
{{verwalter_name}}
{{firma_name}}`;

export interface ApplicantMessageVarsInput {
  firstName: string;
  lastName: string;
  unitLabel: string;
  unitAddress: string;
  managerName: string;
  firmName: string;
  /** Nur bei Einladung befüllt (Spec §6.2) — freies Textfeld, da im Repo
   * kein Kalendermodul existiert (s. MM1-Plan, Entscheidung "zurückgestellt"). */
  viewingAppointment?: string;
}

export function buildApplicantMessageVars(input: ApplicantMessageVarsInput): Record<string, string> {
  const vars: Record<string, string> = {
    vorname: input.firstName,
    nachname: input.lastName,
    einheit_bezeichnung: input.unitLabel,
    einheit_adresse: input.unitAddress,
    verwalter_name: input.managerName,
    firma_name: input.firmName,
  };
  if (input.viewingAppointment) vars.besichtigungstermin = input.viewingAppointment;
  return vars;
}

/** Findet `{{platzhalter}}`, die nach dem Rendern unverändert stehen
 * geblieben sind (Spec §6.2: "fehlende Platzhalterwerte lösen eine Warnung
 * statt eines fehlerhaften Versands aus"). */
export function findUnfilledPlaceholders(rendered: string): string[] {
  const matches = rendered.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}
