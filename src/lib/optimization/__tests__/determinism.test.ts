import { describe, expect, it } from "vitest";
import { berechneSzenario } from "../engine";
import { ENGINE_VERSION } from "../types";
import { ctx, massnahme } from "./fixtures";

describe("Determinismus (Spec §6.3)", () => {
  const inputs = [
    massnahme("werbeflaeche_giebel", { miete_pa_eur: 1200 }),
    massnahme("vergleichsmiete", { zielmiete_eur_qm: 10 }, { kategorie: "mietertrag", constraint_codes: ["kappungsgrenze"] }),
    massnahme("modernisierung", { capex_eur: 100000, ausgangsmiete_eur_qm: 6 }, { kategorie: "mietertrag", klasse: "capex", constraint_codes: ["modernisierung_deckel"] }),
  ];

  it("gleiche Inputs → identische Outputs", () => {
    const a = berechneSzenario(inputs, ctx());
    const b = berechneSzenario(inputs, ctx());
    expect(a).toEqual(b);
  });

  it("Snapshot trägt die Engine-Version", () => {
    const snap = berechneSzenario(inputs, ctx());
    expect(snap.engine_version).toBe(ENGINE_VERSION);
  });
});
