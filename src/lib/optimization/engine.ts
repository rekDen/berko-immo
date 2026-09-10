// Deterministische Szenario-Engine (Spec §6.3).
// berechneMassnahme: eine Maßnahme → Ergebnis (Invest/ΔErtrag/Werthebel/Zulässigkeit).
// berechneSzenario: stapelt Maßnahmen auf das Ist und aggregiert zum Snapshot.
import { pruefeMassnahme } from "./constraints";
import {
  amortisation,
  bruttorendite,
  ekRendite,
  jahreskaltmiete,
  nettorendite,
  noi as noiFn,
  werthebel as werthebelFn,
} from "./kennzahlen";
import { getCalculator } from "./massnahmen";
import {
  ENGINE_VERSION,
  type CalcResult,
  type EngineContext,
  type KennzahlenSnapshot,
  type MassnahmeErgebnis,
  type MassnahmeInput,
} from "./types";

/** Calculator + Gating einmalig auswerten und zum Ergebnis verdichten. */
function auswerten(m: MassnahmeInput, ctx: EngineContext): { res: MassnahmeErgebnis; calc: CalcResult } {
  const calc = getCalculator(m.typ_code)(m, ctx);
  const gating = pruefeMassnahme(m, ctx);
  const faktor = ctx.objekt.objektfaktor;

  const gesperrt = gating.zulaessigkeit === "gesperrt";
  const noiWirksam = calc.noi_wirksam !== false;
  const ertrag = gesperrt ? 0 : calc.ertragswirkung_pa_eur;
  const werthebel = gesperrt
    ? 0
    : calc.werthebel_override ?? (noiWirksam ? werthebelFn(ertrag, faktor) : 0);

  const res: MassnahmeErgebnis = {
    massnahme_id: m.id,
    typ_code: m.typ_code,
    label: m.label,
    kategorie: m.kategorie,
    klasse: m.klasse,
    invest_eur: round2(calc.invest_eur),
    ertragswirkung_pa_eur: round2(ertrag),
    werthebel_eur: round2(werthebel),
    amortisation_jahre: roundNullable(amortisation(calc.invest_eur, ertrag)),
    zulaessigkeit: gating.zulaessigkeit,
    begruendung: gating.begruendung,
    auflagen: gating.auflagen,
    hinweise: calc.hinweise ?? [],
  };
  return { res, calc };
}

/** Berechnet eine einzelne Maßnahme inkl. Constraint-Gating und Kennzahlen. */
export function berechneMassnahme(m: MassnahmeInput, ctx: EngineContext): MassnahmeErgebnis {
  return auswerten(m, ctx).res;
}

/** Stapelt alle Maßnahmen auf das Ist-Objekt und liefert den Kennzahlen-Snapshot. */
export function berechneSzenario(
  massnahmen: MassnahmeInput[],
  ctx: EngineContext,
): KennzahlenSnapshot {
  const { objekt } = ctx;
  const faktor = objekt.objektfaktor;
  const nichtUml = objekt.nicht_umlagefaehige_kosten_pa_eur ?? 0;

  const istJahresmiete = jahreskaltmiete(ctx.mietvertraege);
  const istNoi = noiFn(istJahresmiete, nichtUml);

  const ausgewertet = massnahmen.map((m) => auswerten(m, ctx));

  let deltaNoi = 0;
  let zusatzMietertrag = 0; // mietsteigernde Hebel (für Bruttorendite)
  let aufteilungsgewinn = 0;
  let afa = 0;
  let nichtNoiWerthebel = 0;

  for (const { res, calc } of ausgewertet) {
    const noiWirksam = calc.noi_wirksam !== false;
    if (noiWirksam) {
      deltaNoi += res.ertragswirkung_pa_eur;
      if (["mietertrag", "zusatzerloes", "flaeche"].includes(res.kategorie))
        zusatzMietertrag += res.ertragswirkung_pa_eur;
    } else {
      nichtNoiWerthebel += res.werthebel_eur;
    }
    aufteilungsgewinn += calc.aufteilungsgewinn_eur ?? 0;
    afa += calc.afa_effekt_eur ?? 0;
  }

  const neuNoi = istNoi + deltaNoi;
  const verkehrswert = neuNoi * faktor + nichtNoiWerthebel;
  const neuJahresmiete = istJahresmiete + zusatzMietertrag;
  const fkZins =
    objekt.fremdkapital_eur && objekt.fk_zins_pct
      ? (objekt.fremdkapital_eur * objekt.fk_zins_pct) / 100
      : 0;

  return {
    engine_version: ENGINE_VERSION,
    ist_noi_eur: round2(istNoi),
    delta_noi_eur: round2(deltaNoi),
    noi_eur: round2(neuNoi),
    faktor,
    verkehrswert_eur: round2(verkehrswert),
    bruttorendite: roundNullable(bruttorendite(neuJahresmiete, objekt.kaufpreis_eur)),
    nettorendite: roundNullable(nettorendite(neuNoi, objekt.kaufpreis_eur, objekt.erwerbsnebenkosten_eur ?? 0)),
    ek_rendite: roundNullable(ekRendite(neuNoi, fkZins, objekt.eingesetztes_ek_eur)),
    irr: null, // MVP: IRR nur mit vollständiger Halteperiode (spätere Phase)
    aufteilungsgewinn_eur: round2(aufteilungsgewinn),
    afa_effekt_eur: round2(afa),
    massnahmen: ausgewertet.map((e) => e.res),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function roundNullable(n: number | null): number | null {
  return n === null ? null : Math.round(n * 1e6) / 1e6;
}
