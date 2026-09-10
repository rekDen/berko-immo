// Maßnahmen-Calculators (Spec §6.2). Ein Calculator je typ_code, Registry am Ende.
// Jeder Calculator liefert Invest, ΔErtrag p.a. und optionale Spezialwerte
// (Aufteilungsgewinn, AfA, kein-NOI-Hebel). Numerische Regel-Kappungen werden
// hier angewendet (Kappungsgrenze, §559-Deckel, Mietpreisbremse).
import { findeRegel } from "./constraints";
import { jahreskaltmiete } from "./kennzahlen";
import type { CalcResult, EngineContext, MassnahmeInput, Regel } from "./types";

type Calculator = (m: MassnahmeInput, ctx: EngineContext) => CalcResult;

// ── Param-Helfer ──
function num(m: MassnahmeInput, key: string, fallback = 0): number {
  const v = m.params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function param(r: Regel | undefined, key: string, fallback: number): number {
  const v = r?.parameter[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function wohnflaeche(m: MassnahmeInput, ctx: EngineContext): number {
  return num(m, "flaeche_qm") || num(m, "wohnflaeche_qm") || ctx.objekt.wohnflaeche_qm || 0;
}

// ── Mietertrag ──
const vergleichsmiete: Calculator = (m, ctx) => {
  const flaeche = wohnflaeche(m, ctx);
  const istPa = num(m, "ist_miete_pa_eur") || jahreskaltmiete(ctx.mietvertraege);
  const zielMarktPa = num(m, "zielmiete_eur_qm") * flaeche * 12;
  const kapp = findeRegel(ctx.regeln, "kappungsgrenze");
  const cap = kapp ? istPa * (1 + param(kapp, "kappung_pct", 0) / 100) : Infinity;
  const ziel = Math.min(zielMarktPa, cap);
  const delta = Math.max(0, ziel - istPa);
  const hinweise: string[] = [];
  if (kapp && zielMarktPa > cap)
    hinweise.push(`Zielmiete durch Kappungsgrenze (${param(kapp, "kappung_pct", 0)}%) auf ${Math.round(cap)} €/Jahr begrenzt.`);
  hinweise.push("Wartefrist 15 Monate seit letzter Erhöhung beachten.");
  return { invest_eur: 0, ertragswirkung_pa_eur: delta, hinweise };
};

const index_umstellung: Calculator = (m, ctx) => {
  const istPa = num(m, "ist_miete_pa_eur") || jahreskaltmiete(ctx.mietvertraege);
  return { invest_eur: 0, ertragswirkung_pa_eur: istPa * (num(m, "index_pct") / 100) };
};

const staffel_umstellung: Calculator = (m) => ({
  invest_eur: 0,
  ertragswirkung_pa_eur: num(m, "steigerung_pa_eur"),
});

const modernisierung: Calculator = (m, ctx) => {
  const capex = num(m, "capex_eur");
  const flaeche = wohnflaeche(m, ctx);
  const r = findeRegel(ctx.regeln, "modernisierung_deckel");
  const umlagePct = num(m, "umlage_pct") || param(r, "umlage_pct", 8);
  const ausgangsmiete = num(m, "ausgangsmiete_eur_qm");
  const deckelHoch = param(r, "deckel_eur_qm_6j", 3);
  const deckelNiedrig = param(r, "deckel_unter_7eur", 2);
  const deckelQmMonat = ausgangsmiete > 0 && ausgangsmiete < 7 ? deckelNiedrig : deckelHoch;
  const umlageRoh = (capex * umlagePct) / 100;
  const deckelPa = flaeche > 0 ? deckelQmMonat * flaeche * 12 : Infinity;
  const umlage = Math.min(umlageRoh, deckelPa);
  const hinweise: string[] = [];
  if (deckelPa < umlageRoh)
    hinweise.push(`§559-Umlage durch Deckel (${deckelQmMonat} €/m²/Monat) auf ${Math.round(deckelPa)} €/Jahr begrenzt.`);
  hinweise.push("Modernisierungsumlage ist nicht von der Kappungsgrenze erfasst.");
  return { invest_eur: capex, ertragswirkung_pa_eur: umlage, hinweise };
};

const neuvermietung_sanierung: Calculator = (m, ctx) => {
  const flaeche = wohnflaeche(m, ctx);
  const capex = num(m, "capex_eur");
  const vergleich = num(m, "vergleichsmiete_eur_qm");
  const r = findeRegel(ctx.regeln, "mietpreisbremse");
  const aufschlag = param(r, "aufschlag_pct", 10);
  const cap = vergleich > 0 ? vergleich * (1 + aufschlag / 100) : Infinity;
  const ziel = Math.min(num(m, "zielmiete_eur_qm") || cap, cap);
  const istQm = num(m, "ist_miete_eur_qm");
  const deltaPa = Math.max(0, (ziel - istQm) * flaeche * 12);
  const hinweise = ["Mietpreisbremse-Ausnahmen (Vormiete/umfassende Modernisierung/Neubau) ggf. prüfen."];
  return { invest_eur: capex, ertragswirkung_pa_eur: deltaPa, hinweise };
};

// ── Zusatzerlöse ──
const proStueckMonat = (key = "miete_pm_eur"): Calculator => (m) => ({
  invest_eur: num(m, "invest_eur"),
  ertragswirkung_pa_eur: num(m, "menge") * num(m, key) * 12,
});

const werbeflaeche_giebel: Calculator = (m) => ({
  invest_eur: num(m, "invest_eur"),
  ertragswirkung_pa_eur: num(m, "miete_pa_eur"),
});

const dachpacht_mobilfunk: Calculator = (m) => ({
  invest_eur: 0,
  ertragswirkung_pa_eur: num(m, "pacht_pa_eur"),
});

const pv_dachpacht: Calculator = (m) => ({
  invest_eur: num(m, "capex_eur"),
  ertragswirkung_pa_eur: num(m, "pacht_pa_eur"),
});

const pv_mieterstrom: Calculator = (m) => ({
  invest_eur: num(m, "capex_eur"),
  ertragswirkung_pa_eur: num(m, "ertrag_pa_eur"),
});

const muenzwaschraum: Calculator = (m) => ({
  invest_eur: num(m, "invest_eur"),
  ertragswirkung_pa_eur: num(m, "ertrag_pa_eur"),
});

// ── Flächenaktivierung ──
const ausbau: Calculator = (m) => {
  const flaeche = num(m, "neue_flaeche_qm");
  return {
    invest_eur: flaeche * num(m, "baukosten_qm_eur"),
    ertragswirkung_pa_eur: flaeche * num(m, "zielmiete_eur_qm") * 12,
  };
};

const grundriss_teilen: Calculator = (m) => ({
  invest_eur: num(m, "invest_eur"),
  ertragswirkung_pa_eur: num(m, "zusatzmiete_pa_eur"),
});

const balkonanbau: Calculator = (m) => ({
  invest_eur: num(m, "kosten_eur") || num(m, "menge") * num(m, "kosten_pro_stueck_eur"),
  ertragswirkung_pa_eur: num(m, "zusatzmiete_pa_eur"),
});

const umwidmung_gewerbe_wohnen: Calculator = (m) => {
  const flaeche = num(m, "flaeche_qm");
  return {
    invest_eur: num(m, "invest_eur"),
    ertragswirkung_pa_eur: flaeche * num(m, "zielmiete_eur_qm") * 12,
  };
};

const nachverdichtung: Calculator = (m) => ({
  invest_eur: num(m, "invest_eur"),
  ertragswirkung_pa_eur: num(m, "ertrag_pa_eur"),
});

const aufteilung_etw: Calculator = (m, ctx) => {
  // Wertheber, kein laufender NOI. Globalwert/Einzelwert über Faktoren × Ist-NOI.
  const istNoi = jahreskaltmiete(ctx.mietvertraege) - (ctx.objekt.nicht_umlagefaehige_kosten_pa_eur ?? 0);
  const globalFaktor = num(m, "global_faktor") || ctx.objekt.objektfaktor;
  const einzelFaktor = num(m, "einzel_faktor");
  const globalwert = num(m, "global_wert_eur") || istNoi * globalFaktor;
  const einzelwert = num(m, "einzel_summe_eur") || istNoi * einzelFaktor;
  const splitkosten = num(m, "splitkosten_eur");
  const gewinn = einzelwert - globalwert - splitkosten;
  return {
    invest_eur: splitkosten,
    ertragswirkung_pa_eur: 0,
    noi_wirksam: false,
    werthebel_override: gewinn,
    aufteilungsgewinn_eur: gewinn,
    hinweise: [
      "3-Objekt-Grenze und Spekulationsfrist als Warnung prüfen (Steuerberater-Vorbehalt).",
    ],
  };
};

// ── Kostenseite ──
const einsparung: Calculator = (m) => ({
  invest_eur: 0,
  ertragswirkung_pa_eur: num(m, "einsparung_pa_eur"),
});

const leerstandsabbau: Calculator = (m) => ({
  invest_eur: 0,
  ertragswirkung_pa_eur: num(m, "miete_pa_eur"),
});

const refinanzierung: Calculator = (m) => {
  const ersparnis = num(m, "darlehen_eur") * ((num(m, "alt_zins_pct") - num(m, "neu_zins_pct")) / 100);
  return {
    invest_eur: 0,
    ertragswirkung_pa_eur: Math.max(0, ersparnis),
    noi_wirksam: false, // Finanzierung hebt den Asset-Wert nicht
    werthebel_override: 0,
    hinweise: ["Wirkt auf Cashflow/EK-Rendite, nicht auf NOI/Verkehrswert."],
  };
};

// ── Portfolio (Befüllung spätere Phase) ──
const portfolioNoop: Calculator = (m) => ({
  invest_eur: num(m, "invest_eur"),
  ertragswirkung_pa_eur: num(m, "ertrag_pa_eur"),
});

export const CALCULATORS: Record<string, Calculator> = {
  vergleichsmiete,
  index_umstellung,
  staffel_umstellung,
  neuvermietung_sanierung,
  modernisierung,
  stellplatz_anlegen: proStueckMonat(),
  werbeflaeche_giebel,
  dachpacht_mobilfunk,
  pv_dachpacht,
  pv_mieterstrom,
  kellerlager: proStueckMonat(),
  fahrradbox: proStueckMonat(),
  muenzwaschraum,
  garten_parzelle: proStueckMonat(),
  container_stellplatz: proStueckMonat(),
  dg_ausbau: ausbau,
  souterrain_ausbau: ausbau,
  grundriss_teilen,
  balkonanbau,
  umwidmung_gewerbe_wohnen,
  nachverdichtung,
  aufteilung_etw,
  betriebskosten_buendeln: einsparung,
  versorgerwechsel: einsparung,
  leerstandsabbau,
  refinanzierung,
  standardpaket_rollout: portfolioNoop,
  exit_vergleich: portfolioNoop,
};

/** Fallback für unbekannte Codes: nutzt explizite Parameter, sonst 0. */
export function getCalculator(typ_code: string): Calculator {
  return CALCULATORS[typ_code] ?? portfolioNoop;
}
