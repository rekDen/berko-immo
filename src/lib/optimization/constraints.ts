// Regel- & Baurecht-Gating (Spec §7).
// Klassifiziert eine Maßnahme als zulaessig|bedingt|gesperrt und liefert
// Klartext-Begründung + Auflagen. Numerische Kappungen (Kappungsgrenze,
// §559-Deckel, Mietpreisbremse) werden in den Maßnahmen-Calculators
// angewendet — hier geht es um die rechtliche Einordnung.
import type { ConstraintErgebnis, EngineContext, MassnahmeInput, Regel, Zulaessigkeit } from "./types";

const RANG: Record<Zulaessigkeit, number> = { zulaessig: 0, bedingt: 1, gesperrt: 2 };

export function findeRegel(regeln: Regel[], code: string): Regel | undefined {
  return regeln.find((r) => r.regel_code === code);
}

/** Filtert Regeln auf die zum Stichtag gültigen (gueltig_von ≤ Stichtag ≤ gueltig_bis). */
export function filterGueltig(regeln: Regel[], stichtag: string): Regel[] {
  return regeln.filter(
    (r) => r.gueltig_von <= stichtag && (r.gueltig_bis === null || r.gueltig_bis >= stichtag),
  );
}

/** Prüft alle constraint_codes einer Maßnahme; aggregiert zum „schärfsten" Status. */
export function pruefeMassnahme(m: MassnahmeInput, ctx: EngineContext): ConstraintErgebnis {
  const { objekt, regeln } = ctx;
  const auflagen: string[] = [];
  const gruende: string[] = [];
  let status: Zulaessigkeit = "zulaessig";

  const verschaerfe = (s: Zulaessigkeit) => {
    if (RANG[s] > RANG[status]) status = s;
  };

  for (const code of m.constraint_codes) {
    switch (code) {
      case "kappungsgrenze": {
        const r = findeRegel(regeln, "kappungsgrenze");
        if (r) gruende.push(`Mieterhöhung durch Kappungsgrenze (${r.parameter.kappung_pct}%) begrenzt.`);
        break;
      }
      case "mietpreisbremse": {
        const r = findeRegel(regeln, "mietpreisbremse");
        if (r) gruende.push(`Neuvertragsmiete durch Mietpreisbremse (Vergleichsmiete +${r.parameter.aufschlag_pct}%) begrenzt.`);
        break;
      }
      case "modernisierung_deckel": {
        const r = findeRegel(regeln, "modernisierung_deckel");
        if (r) gruende.push(`§559-Umlage durch Modernisierungsdeckel begrenzt (${r.parameter.umlage_pct}% / ${r.parameter.deckel_eur_qm_6j} €/m² in 6 J).`);
        break;
      }
      case "milieuschutz": {
        if (objekt.erhaltungssatzung) {
          verschaerfe("bedingt");
          auflagen.push("Genehmigung nach Erhaltungssatzung (Milieuschutz) erforderlich.");
        }
        break;
      }
      case "umwandlungsverordnung": {
        verschaerfe("bedingt");
        auflagen.push("Genehmigung nach §250 BauGB (Umwandlungsverordnung) in angespanntem Wohnungsmarkt erforderlich.");
        break;
      }
      case "denkmal": {
        if (objekt.denkmalschutz) {
          verschaerfe("bedingt");
          auflagen.push("Denkmalschutzrechtliche Genehmigung erforderlich.");
          gruende.push("Denkmalschutz schaltet §7i-AfA frei (Steuerberater-Vorbehalt).");
        }
        break;
      }
      case "zwevs": {
        verschaerfe("bedingt");
        auflagen.push("Zweckentfremdungs-Genehmigung (ZwEVS) für Kurzzeit-/möblierte Vermietung erforderlich.");
        break;
      }
      case "baurecht":
      case "grz_gfz": {
        verschaerfe("bedingt");
        auflagen.push("Feasibility gegen B-Plan/GRZ-GFZ prüfen.");
        break;
      }
      case "statik": {
        verschaerfe("bedingt");
        auflagen.push("Statische Eignung (Reserve) prüfen.");
        break;
      }
      case "weg": {
        verschaerfe("bedingt");
        auflagen.push("WEG-rechtliche Voraussetzungen (Teilungserklärung) prüfen.");
        break;
      }
      // index_deckel, mietspiegel: rein numerisch im Calculator, kein Gating
      default:
        break;
    }
  }

  const begruendung =
    gruende.length || auflagen.length
      ? [...gruende, ...auflagen].join(" ")
      : "Keine einschränkenden Regeln zum Stichtag.";

  return { zulaessigkeit: status, begruendung, auflagen };
}
