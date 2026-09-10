import { describe, expect, it } from "vitest";
import { filterGueltig, pruefeMassnahme } from "../constraints";
import { berechneMassnahme } from "../engine";
import { ctx, leipzigRegeln, massnahme, objekt } from "./fixtures";

// Tabellengetriebene Tests: Regel × Objektzustand × Stichtag.
describe("Constraint-Gating", () => {
  it("milieuschutz greift nur bei Erhaltungssatzung am Objekt", () => {
    const m = massnahme("modernisierung", { capex_eur: 100000 }, { constraint_codes: ["milieuschutz"] });

    const ohne = pruefeMassnahme(m, ctx({ objekt: objekt({ erhaltungssatzung: false }) }));
    expect(ohne.zulaessigkeit).toBe("zulaessig");

    const mit = pruefeMassnahme(m, ctx({ objekt: objekt({ erhaltungssatzung: true }) }));
    expect(mit.zulaessigkeit).toBe("bedingt");
    expect(mit.auflagen.join(" ")).toMatch(/Erhaltungssatzung/);
  });

  it("denkmal: bedingt + §7i-AfA-Hinweis nur bei Denkmalschutz", () => {
    const m = massnahme("dg_ausbau", { neue_flaeche_qm: 80 }, { constraint_codes: ["denkmal"] });
    const res = pruefeMassnahme(m, ctx({ objekt: objekt({ denkmalschutz: true }) }));
    expect(res.zulaessigkeit).toBe("bedingt");
    expect(res.begruendung).toMatch(/§7i/);
  });

  it("umwandlungsverordnung ist immer genehmigungspflichtig (bedingt)", () => {
    const res = pruefeMassnahme(
      massnahme("aufteilung_etw", {}, { constraint_codes: ["umwandlungsverordnung"] }),
      ctx(),
    );
    expect(res.zulaessigkeit).toBe("bedingt");
    expect(res.auflagen.join(" ")).toMatch(/§250 BauGB/);
  });
});

describe("Geltungsdatum (vor/nach 30.06.2027)", () => {
  it("Kappungsgrenze gilt am 14.06.2026 → begrenzt", () => {
    const gueltig = filterGueltig(leipzigRegeln, "2026-06-14");
    expect(gueltig.some((r) => r.regel_code === "kappungsgrenze")).toBe(true);
  });

  it("Kappungsgrenze läuft am 01.07.2027 aus → keine Begrenzung mehr", () => {
    const gueltig = filterGueltig(leipzigRegeln, "2027-07-01");
    expect(gueltig.some((r) => r.regel_code === "kappungsgrenze")).toBe(false);

    // Ohne Kappung greift die Zielmarktmiete voll: 10 €/m² × 500 × 12 − 12.000 = 48.000
    const res = berechneMassnahme(
      massnahme("vergleichsmiete", { zielmiete_eur_qm: 10 }, { kategorie: "mietertrag", constraint_codes: ["kappungsgrenze"] }),
      ctx({ regeln: gueltig, stichtag: "2027-07-01" }),
    );
    expect(res.ertragswirkung_pa_eur).toBe(48000);
  });
});
