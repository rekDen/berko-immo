import { describe, expect, it } from "vitest";
import { berechneMassnahme, berechneSzenario } from "../engine";
import { ctx, massnahme, objekt } from "./fixtures";

// Golden-Master: fixe Inputs → fixe Outputs je Maßnahmentyp.
describe("Maßnahmen-Calculators (Golden Master)", () => {
  it("werbeflaeche_giebel: ΔNOI = miete_pa, Werthebel = miete_pa × Faktor (Spec-Beispiel 1.200 × 20)", () => {
    const res = berechneMassnahme(
      massnahme("werbeflaeche_giebel", { miete_pa_eur: 1200 }, { constraint_codes: ["denkmal"] }),
      ctx(),
    );
    expect(res.ertragswirkung_pa_eur).toBe(1200);
    expect(res.werthebel_eur).toBe(24000);
    expect(res.amortisation_jahre).toBeNull(); // kein Invest
    expect(res.zulaessigkeit).toBe("zulaessig"); // kein Denkmalschutz am Objekt
  });

  it("vergleichsmiete: durch Kappungsgrenze 15% begrenzt", () => {
    // Ist 12.000 €/J; Markt 10 €/m² × 500 × 12 = 60.000; Cap 12.000 × 1,15 = 13.800 → Δ 1.800
    const res = berechneMassnahme(
      massnahme(
        "vergleichsmiete",
        { zielmiete_eur_qm: 10 },
        { kategorie: "mietertrag", constraint_codes: ["kappungsgrenze", "mietspiegel"] },
      ),
      ctx(),
    );
    expect(res.ertragswirkung_pa_eur).toBe(1800);
    expect(res.werthebel_eur).toBe(36000);
    expect(res.begruendung).toMatch(/Kappungsgrenze/);
  });

  it("modernisierung: §559-Umlage durch Deckel begrenzt (Ausgangsmiete < 7 → 2 €/m²)", () => {
    // capex 300.000 × 8% = 24.000; Deckel 2 €/m² × 500 × 12 = 12.000 → 12.000
    const res = berechneMassnahme(
      massnahme(
        "modernisierung",
        { capex_eur: 300000, ausgangsmiete_eur_qm: 6 },
        { kategorie: "mietertrag", klasse: "capex", constraint_codes: ["modernisierung_deckel", "milieuschutz"] },
      ),
      ctx(),
    );
    expect(res.invest_eur).toBe(300000);
    expect(res.ertragswirkung_pa_eur).toBe(12000);
    expect(res.amortisation_jahre).toBe(25); // 300.000 / 12.000
  });

  it("stellplatz_anlegen: Menge × Miete/Monat × 12", () => {
    const res = berechneMassnahme(
      massnahme("stellplatz_anlegen", { menge: 5, miete_pm_eur: 40, invest_eur: 10000 }, { constraint_codes: ["baurecht"] }),
      ctx(),
    );
    expect(res.ertragswirkung_pa_eur).toBe(2400); // 5 × 40 × 12
    expect(res.zulaessigkeit).toBe("bedingt"); // baurecht → Feasibility prüfen
    expect(res.auflagen.join(" ")).toMatch(/B-Plan/);
  });

  it("aufteilung_etw: Wertheber ohne NOI; Aufteilungsgewinn aus Faktordifferenz", () => {
    // Ist-NOI 12.000; global 20× = 240.000; einzel 28× = 336.000; − 20.000 Split = 76.000
    const res = berechneMassnahme(
      massnahme(
        "aufteilung_etw",
        { global_faktor: 20, einzel_faktor: 28, splitkosten_eur: 20000 },
        { kategorie: "flaeche", klasse: "capex", constraint_codes: ["umwandlungsverordnung", "weg"] },
      ),
      ctx(),
    );
    expect(res.ertragswirkung_pa_eur).toBe(0);
    expect(res.werthebel_eur).toBe(76000);
    expect(res.zulaessigkeit).toBe("bedingt");
  });

  it("refinanzierung: Cashflow-Ersparnis, kein Werthebel", () => {
    const res = berechneMassnahme(
      massnahme("refinanzierung", { darlehen_eur: 1000000, alt_zins_pct: 4, neu_zins_pct: 2.5 }, { kategorie: "kosten" }),
      ctx(),
    );
    expect(res.ertragswirkung_pa_eur).toBe(15000); // 1.000.000 × 1,5%
    expect(res.werthebel_eur).toBe(0);
  });
});

describe("Szenario-Aggregation", () => {
  it("stapelt NOI-wirksame Hebel und hebt Verkehrswert; Aufteilung kommt obendrauf", () => {
    const snap = berechneSzenario(
      [
        massnahme("werbeflaeche_giebel", { miete_pa_eur: 1200 }),
        massnahme(
          "aufteilung_etw",
          { global_faktor: 20, einzel_faktor: 28, splitkosten_eur: 20000 },
          { kategorie: "flaeche", klasse: "capex" },
        ),
      ],
      ctx(),
    );
    expect(snap.ist_noi_eur).toBe(12000);
    expect(snap.delta_noi_eur).toBe(1200);
    expect(snap.noi_eur).toBe(13200);
    // Verkehrswert = 13.200 × 20 + Aufteilungsgewinn 76.000 = 264.000 + 76.000
    expect(snap.verkehrswert_eur).toBe(340000);
    expect(snap.aufteilungsgewinn_eur).toBe(76000);
  });

  it("Renditen werden berechnet, wenn Kaufpreis/EK vorhanden", () => {
    const snap = berechneSzenario([massnahme("werbeflaeche_giebel", { miete_pa_eur: 1200 })], ctx({
      objekt: objekt({ kaufpreis_eur: 200000, eingesetztes_ek_eur: 50000, fremdkapital_eur: 150000, fk_zins_pct: 3 }),
    }));
    expect(snap.nettorendite).toBeCloseTo(13200 / 200000, 6);
    expect(snap.ek_rendite).toBeCloseTo((13200 - 4500) / 50000, 6);
  });
});
