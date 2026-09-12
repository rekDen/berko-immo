import { describe, it, expect } from "vitest";
import {
  renderTemplate, splitParagraphs, buildAnschreibenVars, buildBeschlussvorlageVars,
  DEFAULT_ANSCHREIBEN_SUBJECT, DEFAULT_ANSCHREIBEN_BODY, DEFAULT_BESCHLUSSVORLAGE_BODY,
} from "../template";

describe("renderTemplate", () => {
  it("ersetzt bekannte Platzhalter", () => {
    expect(renderTemplate("Hallo {{name}}, Jahr {{jahr}}.", { name: "Frau Müller", jahr: "2026" }))
      .toBe("Hallo Frau Müller, Jahr 2026.");
  });

  it("lässt unbekannte Platzhalter unverändert stehen", () => {
    expect(renderTemplate("Betrag: {{betrag}}", {})).toBe("Betrag: {{betrag}}");
  });

  it("ersetzt mehrfach vorkommende gleiche Platzhalter", () => {
    expect(renderTemplate("{{x}} und nochmal {{x}}", { x: "A" })).toBe("A und nochmal A");
  });
});

describe("splitParagraphs", () => {
  it("trennt an Leerzeilen und zieht einzelne Zeilenumbrüche zu Leerzeichen zusammen", () => {
    expect(splitParagraphs("Erster Satz.\nZweite Zeile.\n\nZweiter Absatz."))
      .toEqual(["Erster Satz. Zweite Zeile.", "Zweiter Absatz."]);
  });

  it("verwirft leere Absätze (mehrfache Leerzeilen)", () => {
    expect(splitParagraphs("A\n\n\n\nB")).toEqual(["A", "B"]);
  });
});

describe("buildAnschreibenVars", () => {
  it("markiert eine positive Spitze als Nachschuss (Betrag ohne Vorzeichen)", () => {
    const vars = buildAnschreibenVars({ objektName: "WEG Waldstraße 82", jahr: 2026, einheit: "W01", spitzeCents: 14945 });
    expect(vars.spitze_art).toBe("Nachschuss");
    expect(vars.spitze_betrag).toBe("149,45 €");
  });

  it("markiert eine negative Spitze als Guthaben (Betrag ohne Vorzeichen)", () => {
    const vars = buildAnschreibenVars({ objektName: "WEG Waldstraße 82", jahr: 2026, einheit: "W01", spitzeCents: -500 });
    expect(vars.spitze_art).toBe("Guthaben");
    expect(vars.spitze_betrag).toBe("5,00 €");
  });

  it("markiert eine Spitze von 0 als ausgeglichen", () => {
    const vars = buildAnschreibenVars({ objektName: "WEG Waldstraße 82", jahr: 2026, einheit: "W01", spitzeCents: 0 });
    expect(vars.spitze_art).toBe("ausgeglichen");
  });

  it("liefert alle für die Default-Vorlagen benötigten Schlüssel", () => {
    const vars = buildAnschreibenVars({ objektName: "X", jahr: 2026, einheit: "W01", spitzeCents: 100 });
    const rendered = renderTemplate(DEFAULT_ANSCHREIBEN_SUBJECT + DEFAULT_ANSCHREIBEN_BODY, vars);
    expect(rendered).not.toContain("{{");
  });
});

describe("buildBeschlussvorlageVars", () => {
  it("formatiert Gesamtkosten/-einnahmen als Euro-Beträge", () => {
    const vars = buildBeschlussvorlageVars({ objektName: "WEG Waldstraße 82", jahr: 2026, gesamtkostenCents: 123456, gesamteinnahmenCents: 0 });
    expect(vars.gesamtkosten).toBe("1.234,56 €");
    expect(vars.gesamteinnahmen).toBe("0,00 €");
  });

  it("liefert alle für die Default-Vorlage benötigten Schlüssel", () => {
    const vars = buildBeschlussvorlageVars({ objektName: "X", jahr: 2026, gesamtkostenCents: 100, gesamteinnahmenCents: 100 });
    expect(renderTemplate(DEFAULT_BESCHLUSSVORLAGE_BODY, vars)).not.toContain("{{");
  });
});
