/**
 * Anschreiben/Beschlussvorlage-Vorlagen (Spec 8.3): "Anschreiben und
 * Beschlussvorlage stammen aus pflegbaren Vorlagen und sind nicht hart
 * codiert." Einfache `{{platzhalter}}`-Ersetzung statt einer Templating-
 * Bibliothek (Handlebars o. ä.) — die Codebasis hatte bislang kein
 * vergleichbares Muster, ein voller Templating-Layer wäre für zwei simple
 * Textbausteine überdimensioniert.
 *
 * Reine Funktionen: `renderTemplate()` kennt keine Vorlagen-Herkunft (DB vs.
 * Default), `buildAnschreibenVars()`/`buildBeschlussvorlageVars()` kennen
 * keine PDF-Erzeugung. Die Verdrahtung (DB-Vorlage laden, Werte aus dem
 * Settlement-Snapshot holen, PDF rendern) liegt im Aufrufer (API-Route).
 */

/** Ersetzt bekannte `{{key}}`-Platzhalter; unbekannte bleiben sichtbar stehen
 * (Debug-Hilfe bei Tippfehlern in einer vom Verwalter gepflegten Vorlage). */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

/** Leerzeilen trennen Absätze (Vorlagentext); einzelne Zeilenumbrüche innerhalb
 * eines Absatzes werden zu Leerzeichen zusammengezogen, da `@react-pdf/renderer`s
 * `Text` keinen harten Zeilenumbruch aus `\n` erzeugt. */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
}

function formatEuroDE(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export const DEFAULT_ANSCHREIBEN_SUBJECT = "Ihre Jahresabrechnung {{jahr}} — {{objekt_name}}, Einheit {{einheit}}";

export const DEFAULT_ANSCHREIBEN_BODY = `Sehr geehrte Damen und Herren,

anbei erhalten Sie die Abrechnung über die Bewirtschaftungskosten für das Jahr {{jahr}} der Wohnungseigentümergemeinschaft {{objekt_name}}, Einheit {{einheit}}.

Aus der Abrechnung ergibt sich für Sie eine Abrechnungsspitze von {{spitze_betrag}} ({{spitze_art}}).

Bei Rückfragen zur Abrechnung stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Die Verwaltung`;

export const DEFAULT_BESCHLUSSVORLAGE_BODY = `Beschlussvorlage zur Jahresabrechnung {{jahr}}

Die Eigentümerversammlung der Wohnungseigentümergemeinschaft {{objekt_name}} beschließt die Jahresabrechnung für das Wirtschaftsjahr {{jahr}} mit einem Gesamtkostenvolumen von {{gesamtkosten}} und Gesamteinnahmen von {{gesamteinnahmen}} sowie die sich daraus ergebenden Abrechnungsspitzen der einzelnen Einheiten gemäß den beigefügten Einzelabrechnungen.

Guthaben werden an die jeweiligen Eigentümer ausgezahlt; Nachschüsse sind binnen eines Monats nach Beschlussfassung fällig.

Der Verwaltungsbeirat hat die Abrechnung geprüft und empfiehlt die Zustimmung.`;

export function buildAnschreibenVars(input: {
  objektName: string;
  jahr: number;
  einheit: string;
  spitzeCents: number;
}): Record<string, string> {
  const spitzeArt = input.spitzeCents > 0 ? "Nachschuss" : input.spitzeCents < 0 ? "Guthaben" : "ausgeglichen";
  return {
    objekt_name: input.objektName,
    jahr: String(input.jahr),
    einheit: input.einheit,
    spitze_betrag: formatEuroDE(Math.abs(input.spitzeCents)),
    spitze_art: spitzeArt,
  };
}

export function buildBeschlussvorlageVars(input: {
  objektName: string;
  jahr: number;
  gesamtkostenCents: number;
  gesamteinnahmenCents: number;
}): Record<string, string> {
  return {
    objekt_name: input.objektName,
    jahr: String(input.jahr),
    gesamtkosten: formatEuroDE(input.gesamtkostenCents),
    gesamteinnahmen: formatEuroDE(input.gesamteinnahmenCents),
  };
}
