// Priorisierung (Spec §8): Quick Wins vor CapEx, dann Werthebel/Invest und
// Amortisation. Liefert Rangliste + Bubble-Matrix-Daten (x=Invest, y=Werthebel,
// Größe=1/Amortisation).
import type { MassnahmeErgebnis } from "./types";

const KLASSE_RANG: Record<string, number> = { quick_win: 0, capex: 1, analyse: 2 };

export interface BubblePunkt {
  massnahme_id: string;
  label?: string;
  typ_code: string;
  klasse: string;
  x_invest: number;
  y_werthebel: number;
  groesse: number; // 1 / Amortisation (∞ → groß), 0 wenn keine Amortisation
  zulaessigkeit: string;
}

/** Verhältnis Werthebel/Invest (Invest 0 → sehr hoch, sortiert nach oben). */
function effizienz(m: MassnahmeErgebnis): number {
  if (m.invest_eur <= 0) return m.werthebel_eur > 0 ? Infinity : 0;
  return m.werthebel_eur / m.invest_eur;
}

/** Sortierte Rangliste der Maßnahmen. */
export function priorisiere(massnahmen: MassnahmeErgebnis[]): MassnahmeErgebnis[] {
  return [...massnahmen].sort((a, b) => {
    const k = (KLASSE_RANG[a.klasse] ?? 9) - (KLASSE_RANG[b.klasse] ?? 9);
    if (k !== 0) return k;
    const e = effizienz(b) - effizienz(a);
    if (e !== 0 && Number.isFinite(e)) return e;
    if (effizienz(a) !== effizienz(b)) return effizienz(b) > effizienz(a) ? 1 : -1;
    const aAmort = a.amortisation_jahre ?? Infinity;
    const bAmort = b.amortisation_jahre ?? Infinity;
    return aAmort - bAmort;
  });
}

export function bubbleMatrix(massnahmen: MassnahmeErgebnis[]): BubblePunkt[] {
  return massnahmen.map((m) => ({
    massnahme_id: m.massnahme_id,
    label: m.label,
    typ_code: m.typ_code,
    klasse: m.klasse,
    x_invest: m.invest_eur,
    y_werthebel: m.werthebel_eur,
    groesse: m.amortisation_jahre && m.amortisation_jahre > 0 ? 1 / m.amortisation_jahre : 0,
    zulaessigkeit: m.zulaessigkeit,
  }));
}

/** Trennt Quick Wins von CapEx (Spec §8: Quick Wins gebündelt vorab ausweisen). */
export function gruppiereNachKlasse(massnahmen: MassnahmeErgebnis[]): {
  quick_wins: MassnahmeErgebnis[];
  capex: MassnahmeErgebnis[];
  sonstige: MassnahmeErgebnis[];
} {
  return {
    quick_wins: massnahmen.filter((m) => m.klasse === "quick_win"),
    capex: massnahmen.filter((m) => m.klasse === "capex"),
    sonstige: massnahmen.filter((m) => m.klasse !== "quick_win" && m.klasse !== "capex"),
  };
}
