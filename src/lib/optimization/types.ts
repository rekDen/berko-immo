// Immobilienoptimierung — Engine-Typen.
// Die Engine arbeitet ausschließlich auf Plain-Objekten (keine DB-Zugriffe),
// damit jede Berechnung reproduzierbar und testbar ist.

export const ENGINE_VERSION = "1.0.0";

export type Zulaessigkeit = "zulaessig" | "bedingt" | "gesperrt";
export type Klasse = "quick_win" | "capex" | "analyse";
export type Kategorie =
  | "mietertrag"
  | "zusatzerloes"
  | "flaeche"
  | "kosten"
  | "portfolio";

/** Gültige Regel (zum Stichtag & zur Gemeinde bereits vorgefiltert). */
export interface Regel {
  regel_code: string;
  parameter: Record<string, number | string | boolean>;
  gueltig_von: string; // ISO-Datum
  gueltig_bis: string | null;
  quelle?: string | null;
}

export interface Objekt {
  id: string;
  objektfaktor: number; // Verkehrswert-Multiplikator
  wohnflaeche_qm?: number | null;
  denkmalschutz?: boolean;
  erhaltungssatzung?: boolean; // Milieuschutz
  // Renditeparameter (optional — Renditen werden nur berechnet, wenn vorhanden)
  kaufpreis_eur?: number | null;
  erwerbsnebenkosten_eur?: number | null;
  eingesetztes_ek_eur?: number | null;
  fremdkapital_eur?: number | null;
  fk_zins_pct?: number | null;
  nicht_umlagefaehige_kosten_pa_eur?: number | null;
}

export interface Mietvertrag {
  id: string;
  unit_id: string;
  mietart: "standard" | "index" | "staffel";
  kaltmiete_eur: number; // monatlich
  letzte_erhoehung?: string | null;
  leerstand?: boolean;
}

export interface EngineContext {
  objekt: Objekt;
  mietvertraege: Mietvertrag[];
  regeln: Regel[]; // gültig zum Stichtag & zur Gemeinde
  stichtag: string; // ISO-Datum
}

export interface MassnahmeInput {
  id: string;
  typ_code: string;
  kategorie: Kategorie;
  klasse: Klasse;
  constraint_codes: string[];
  label?: string;
  params: Record<string, number | string | boolean | undefined>;
}

export interface ConstraintErgebnis {
  zulaessigkeit: Zulaessigkeit;
  begruendung: string;
  auflagen: string[];
}

export interface MassnahmeErgebnis {
  massnahme_id: string;
  typ_code: string;
  label?: string;
  kategorie: Kategorie;
  klasse: Klasse;
  invest_eur: number;
  ertragswirkung_pa_eur: number; // ΔNOI p.a. (nach Gating)
  werthebel_eur: number;
  amortisation_jahre: number | null;
  zulaessigkeit: Zulaessigkeit;
  begruendung: string;
  auflagen: string[];
  hinweise: string[];
}

export interface KennzahlenSnapshot {
  engine_version: string;
  ist_noi_eur: number;
  delta_noi_eur: number;
  noi_eur: number;
  faktor: number;
  verkehrswert_eur: number;
  bruttorendite: number | null;
  nettorendite: number | null;
  ek_rendite: number | null;
  irr: number | null;
  aufteilungsgewinn_eur: number;
  afa_effekt_eur: number;
  massnahmen: MassnahmeErgebnis[];
}

/** Rückgabe eines Maßnahmen-Calculators (vor Constraint-/KPI-Anreicherung). */
export interface CalcResult {
  invest_eur: number;
  ertragswirkung_pa_eur: number;
  /** zählt in NOI/Verkehrswert (Standard true). Financing/Aufteilung = false. */
  noi_wirksam?: boolean;
  /** überschreibt ΔNOI×Faktor (z.B. Aufteilungsgewinn, Refinanzierung=0). */
  werthebel_override?: number;
  aufteilungsgewinn_eur?: number;
  afa_effekt_eur?: number;
  hinweise?: string[];
}
