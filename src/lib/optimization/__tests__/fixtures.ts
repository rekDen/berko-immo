import type { EngineContext, MassnahmeInput, Objekt, Regel } from "../types";

export const leipzigRegeln: Regel[] = [
  { regel_code: "kappungsgrenze", parameter: { kappung_pct: 15 }, gueltig_von: "2024-07-01", gueltig_bis: "2027-06-30" },
  { regel_code: "mietpreisbremse", parameter: { aufschlag_pct: 10 }, gueltig_von: "2026-01-01", gueltig_bis: "2027-06-30" },
  { regel_code: "modernisierung_deckel", parameter: { umlage_pct: 8, deckel_eur_qm_6j: 3, deckel_unter_7eur: 2 }, gueltig_von: "2019-01-01", gueltig_bis: null },
];

export function objekt(overrides: Partial<Objekt> = {}): Objekt {
  return {
    id: "obj-1",
    objektfaktor: 20,
    wohnflaeche_qm: 500,
    denkmalschutz: false,
    erhaltungssatzung: false,
    nicht_umlagefaehige_kosten_pa_eur: 0,
    ...overrides,
  };
}

/** Rent-Roll mit 12.000 €/Jahr Kaltmiete (1.000 €/Monat). */
export function ctx(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    objekt: objekt(),
    mietvertraege: [{ id: "mv-1", unit_id: "u-1", mietart: "standard", kaltmiete_eur: 1000 }],
    regeln: leipzigRegeln,
    stichtag: "2026-06-14",
    ...overrides,
  };
}

export function massnahme(
  typ_code: string,
  params: MassnahmeInput["params"],
  overrides: Partial<MassnahmeInput> = {},
): MassnahmeInput {
  return {
    id: `m-${typ_code}`,
    typ_code,
    kategorie: "zusatzerloes",
    klasse: "quick_win",
    constraint_codes: [],
    params,
    ...overrides,
  };
}
