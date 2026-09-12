/**
 * B8.2 Stufe 2 (Heuristik) — hausgeldabrechnung-spec.md: "für verbliebene
 * Umsätze [nach Stufe 1]. Bei Eingängen werden die Eigentümer der WEG
 * bewertet nach Namensähnlichkeit zwischen Zahler und Eigentümer,
 * Übereinstimmung des Betrags mit offenen Sollstellungen oder einem
 * Vielfachen des Monatshausgelds sowie Einheitennummern [...] im
 * Verwendungszweck. Bei Ausgängen dient die bisherige Buchung derselben
 * Gegenpartei als Vorschlag. Das Ergebnis ist eine Vorschlagsliste mit
 * Punktwert zwischen 0 und 1; Schwellenwerte sind konfigurierbar (Standard:
 * Anzeige ab 0,6, Hervorhebung ab 0,85)."
 *
 * Reine Funktionen — keine DB-/Datei-/Netzwerkzugriffe. Der Aufrufer
 * (API-Route) lädt Eigentümer-Kandidaten bzw. vorherige Buchungen und
 * übergibt sie hier hinein.
 *
 * Bewusst vereinfacht ggü. der vollen Spec-Formulierung: "Monatsangaben im
 * Verwendungszweck" fließen nicht als eigenes Gewicht ein, da ein Monatsname
 * allein nicht zwischen Eigentümern unterscheidet (jede Zahlung eines
 * Monats betrifft potenziell jeden Eigentümer gleichermaßen) — das
 * unterscheidungskräftige Signal ist die Einheitennummer, die bleibt erhalten.
 */

export const STAGE2_SHOW_THRESHOLD = 0.6;
export const STAGE2_HIGHLIGHT_THRESHOLD = 0.85;

const WEIGHT_NAME = 0.45;
const WEIGHT_AMOUNT = 0.35;
const WEIGHT_UNIT = 0.2;

function normalizeNameText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

function tokenize(s: string): Set<string> {
  return new Set(normalizeNameText(s).split(/\s+/).filter(Boolean));
}

/** Jaccard-Ähnlichkeit über die Wort-Tokens beider Namen (0 = kein gemeinsames Token, 1 = identisch). */
export function nameSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap++;
  const union = tokensA.size + tokensB.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

/** Prüft, ob eine Einheitennummer (unabhängig von Groß-/Kleinschreibung und Trennzeichen) im Verwendungszweck vorkommt. */
export function purposeReferencesUnit(purpose: string | null, unitNumber: string): boolean {
  if (!purpose || !unitNumber.trim()) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, "");
  return normalize(purpose).includes(normalize(unitNumber));
}

function amountMatchesReceivablesOrMultiple(
  amountCents: number,
  openReceivablesCents: number | null,
  monthlyAdvanceCents: number | null,
): boolean {
  if (amountCents <= 0) return false;
  if (openReceivablesCents !== null && openReceivablesCents > 0 && amountCents === openReceivablesCents) return true;
  if (monthlyAdvanceCents !== null && monthlyAdvanceCents > 0 && amountCents % monthlyAdvanceCents === 0) return true;
  return false;
}

export interface HeuristicOwnerCandidate {
  ownerId: string;
  unitId: string;
  /** Anzeigename des Eigentümers (Person oder Firma) für den Namensabgleich. */
  ownerName: string;
  unitNumber: string;
  /** Bewirtschaftung + Rücklage/Monat laut gültigem Wirtschaftsplan, falls vorhanden. */
  monthlyAdvanceCents: number | null;
  /** Σ offene/teilweise offene Sollstellungen dieser Eigentümerpartei (Cents). */
  openReceivablesCents: number | null;
}

export interface HeuristicSuggestion {
  ownerId: string;
  unitId: string;
  score: number;
  highlight: boolean;
  reasons: string[];
}

/** B8.2 Stufe 2, Eingänge: bewertet jeden Eigentümer-Kandidaten der WEG. */
export function computeStage2IncomingSuggestions(
  transaction: { amountCents: number; purpose: string | null; counterpartyName: string | null },
  candidates: HeuristicOwnerCandidate[],
): HeuristicSuggestion[] {
  const scored = candidates.map((c): HeuristicSuggestion => {
    const reasons: string[] = [];
    let score = 0;

    const nameScore = nameSimilarity(transaction.counterpartyName, c.ownerName);
    if (nameScore > 0) {
      score += WEIGHT_NAME * nameScore;
      reasons.push(`Namensähnlichkeit zu „${c.ownerName}" (${Math.round(nameScore * 100)} %)`);
    }

    if (amountMatchesReceivablesOrMultiple(transaction.amountCents, c.openReceivablesCents, c.monthlyAdvanceCents)) {
      score += WEIGHT_AMOUNT;
      reasons.push("Betrag entspricht einer offenen Sollstellung oder einem Vielfachen des Monatshausgelds");
    }

    if (purposeReferencesUnit(transaction.purpose, c.unitNumber)) {
      score += WEIGHT_UNIT;
      reasons.push(`Einheit „${c.unitNumber}" im Verwendungszweck erkannt`);
    }

    const clamped = Math.min(1, score);
    return { ownerId: c.ownerId, unitId: c.unitId, score: clamped, highlight: clamped >= STAGE2_HIGHLIGHT_THRESHOLD, reasons };
  });

  return scored
    .filter((s) => s.score >= STAGE2_SHOW_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

export interface PriorExpenseBooking {
  costTypeId: string | null;
}

export interface Stage2OutgoingSuggestion {
  costTypeId: string;
  score: number;
  highlight: boolean;
  reasons: string[];
}

/** B8.2 Stufe 2, Ausgänge: "die bisherige Buchung derselben Gegenpartei" als Vorschlag. */
export function computeStage2OutgoingSuggestion(priorBookings: PriorExpenseBooking[]): Stage2OutgoingSuggestion | null {
  const counts = new Map<string, number>();
  let totalWithCostType = 0;
  for (const b of priorBookings) {
    if (!b.costTypeId) continue;
    totalWithCostType++;
    counts.set(b.costTypeId, (counts.get(b.costTypeId) ?? 0) + 1);
  }
  if (totalWithCostType === 0) return null;

  let bestCostTypeId = "";
  let bestCount = 0;
  for (const [costTypeId, count] of counts) {
    if (count > bestCount) { bestCostTypeId = costTypeId; bestCount = count; }
  }

  const score = bestCount / totalWithCostType;
  const reasons = [
    totalWithCostType === 1
      ? "Einzige bisherige Buchung derselben Gegenpartei nutzte diese Kostenart"
      : `${bestCount} von ${totalWithCostType} bisherigen Buchungen derselben Gegenpartei nutzten diese Kostenart`,
  ];
  return { costTypeId: bestCostTypeId, score, highlight: score >= STAGE2_HIGHLIGHT_THRESHOLD, reasons };
}
