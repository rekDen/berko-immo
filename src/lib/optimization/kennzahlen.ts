// Universelle Kennzahlen-Formeln (Spec §6.1). Reine Funktionen.
import type { Mietvertrag } from "./types";

/** Jahres-Kaltmiete aus dem Rent-Roll (Leerstand zählt nicht). */
export function jahreskaltmiete(mietvertraege: Mietvertrag[]): number {
  return mietvertraege
    .filter((m) => !m.leerstand)
    .reduce((sum, m) => sum + m.kaltmiete_eur * 12, 0);
}

/** NOI = Jahresnettomiete − nicht umlagefähige Kosten. */
export function noi(jahresnettomiete: number, nichtUmlagefaehigeKosten = 0): number {
  return jahresnettomiete - nichtUmlagefaehigeKosten;
}

/** Werthebel = ΔNOI p.a. × Objektfaktor. */
export function werthebel(deltaNoiPa: number, faktor: number): number {
  return deltaNoiPa * faktor;
}

/** Amortisation = Invest / ΔNetto-Ertrag p.a. (Jahre).
 *  null, wenn kein Invest (nichts zu amortisieren) oder kein laufender Ertrag. */
export function amortisation(invest: number, deltaNettoErtragPa: number): number | null {
  if (invest <= 0 || deltaNettoErtragPa <= 0) return null;
  return invest / deltaNettoErtragPa;
}

/** Verkehrswert = NOI × Faktor. */
export function verkehrswert(noiEur: number, faktor: number): number {
  return noiEur * faktor;
}

/** Bruttorendite = Jahresmiete / Kaufpreis. */
export function bruttorendite(jahresmiete: number, kaufpreis?: number | null): number | null {
  if (!kaufpreis || kaufpreis <= 0) return null;
  return jahresmiete / kaufpreis;
}

/** Nettorendite = NOI / (Kaufpreis + Erwerbsnebenkosten). */
export function nettorendite(
  noiEur: number,
  kaufpreis?: number | null,
  nebenkosten = 0,
): number | null {
  const basis = (kaufpreis ?? 0) + nebenkosten;
  if (basis <= 0) return null;
  return noiEur / basis;
}

/** EK-Rendite = (NOI − Fremdkapitalzins) / eingesetztes Eigenkapital. */
export function ekRendite(
  noiEur: number,
  fkZins: number,
  eigenkapital?: number | null,
): number | null {
  if (!eigenkapital || eigenkapital <= 0) return null;
  return (noiEur - fkZins) / eigenkapital;
}

/** Aufteilungsgewinn = Σ Einzelverkaufspreise − Globalwert − Aufteilungskosten. */
export function aufteilungsgewinn(
  einzelpreiseSumme: number,
  globalwert: number,
  splitkosten = 0,
): number {
  return einzelpreiseSumme - globalwert - splitkosten;
}

/**
 * IRR über eine Zahlungsreihe (Index 0 = heute). Bisektion auf dem NPV.
 * Gibt null zurück, wenn keine Vorzeichenwechsel / keine Lösung im Bereich.
 */
export function irr(cashflows: number[], unten = -0.9, oben = 1.0): number | null {
  if (cashflows.length < 2) return null;
  const npv = (r: number) =>
    cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);

  let lo = unten;
  let hi = oben;
  let flo = npv(lo);
  let fhi = npv(hi);
  if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}
