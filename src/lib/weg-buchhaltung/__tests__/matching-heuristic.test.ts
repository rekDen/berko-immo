import { describe, it, expect } from "vitest";
import {
  nameSimilarity, purposeReferencesUnit, computeStage2IncomingSuggestions, computeStage2OutgoingSuggestion,
  STAGE2_SHOW_THRESHOLD, STAGE2_HIGHLIGHT_THRESHOLD,
  type HeuristicOwnerCandidate,
} from "../matching-heuristic";

describe("nameSimilarity", () => {
  it("liefert 1 für identische Namen (unabhängig von Groß-/Kleinschreibung)", () => {
    expect(nameSimilarity("Erika Musterfrau", "erika musterfrau")).toBe(1);
  });

  it("liefert 0 für völlig unterschiedliche Namen", () => {
    expect(nameSimilarity("Erika Musterfrau", "Hans Beispiel")).toBe(0);
  });

  it("normalisiert Umlaute", () => {
    expect(nameSimilarity("Jörg Müller", "Joerg Mueller")).toBe(1);
  });

  it("liefert einen Zwischenwert bei teilweiser Übereinstimmung (z. B. vertauschte Reihenfolge mit Zusatz)", () => {
    const s = nameSimilarity("Erika Musterfrau", "Musterfrau Erika GbR");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it("liefert 0, wenn einer der beiden Namen fehlt", () => {
    expect(nameSimilarity(null, "Erika Musterfrau")).toBe(0);
  });
});

describe("purposeReferencesUnit", () => {
  it("erkennt die Einheitennummer unabhängig von Trennzeichen", () => {
    expect(purposeReferencesUnit("Hausgeld W-01 März", "W01")).toBe(true);
    expect(purposeReferencesUnit("Hausgeld W01 März", "W-01")).toBe(true);
  });

  it("liefert false ohne Treffer", () => {
    expect(purposeReferencesUnit("Hausgeld März", "W01")).toBe(false);
  });

  it("liefert false bei fehlendem Verwendungszweck", () => {
    expect(purposeReferencesUnit(null, "W01")).toBe(false);
  });
});

describe("computeStage2IncomingSuggestions", () => {
  const candidates: HeuristicOwnerCandidate[] = [
    { ownerId: "o1", unitId: "u1", ownerName: "Erika Musterfrau", unitNumber: "W01", monthlyAdvanceCents: 30000, openReceivablesCents: 30000 },
    { ownerId: "o2", unitId: "u2", ownerName: "Hans Beispiel", unitNumber: "W02", monthlyAdvanceCents: 25000, openReceivablesCents: null },
  ];

  it("bewertet Name + Betrag + Einheit hoch und schlägt die richtige Eigentümerpartei vor", () => {
    const result = computeStage2IncomingSuggestions(
      { amountCents: 30000, purpose: "Hausgeld W01 März", counterpartyName: "Erika Musterfrau" },
      candidates,
    );
    expect(result[0].ownerId).toBe("o1");
    expect(result[0].score).toBe(1);
    expect(result[0].highlight).toBe(true);
    expect(result[0].reasons.length).toBe(3);
  });

  it("filtert Kandidaten unterhalb des Anzeige-Schwellenwerts (Standard 0,6) heraus", () => {
    const result = computeStage2IncomingSuggestions(
      { amountCents: 111, purpose: "Sonstiges", counterpartyName: "Jemand Unbekanntes" },
      candidates,
    );
    expect(result).toEqual([]);
  });

  it("markiert nur ab dem Hervorhebungs-Schwellenwert (Standard 0,85) als highlight", () => {
    // Nur Namensähnlichkeit (Gewicht 0,45) — unter 0,6, wird also ohnehin gefiltert;
    // hier wird stattdessen der Grenzfall Name+Betrag ohne Einheitentreffer geprüft (0,80).
    const result = computeStage2IncomingSuggestions(
      { amountCents: 30000, purpose: "ohne Bezug", counterpartyName: "Erika Musterfrau" },
      candidates,
    );
    expect(result[0].score).toBeCloseTo(0.8, 5);
    expect(result[0].highlight).toBe(false);
    expect(result[0].score).toBeGreaterThanOrEqual(STAGE2_SHOW_THRESHOLD);
    expect(result[0].score).toBeLessThan(STAGE2_HIGHLIGHT_THRESHOLD);
  });

  it("erkennt ein Vielfaches des Monatshausgelds als Betragstreffer", () => {
    const result = computeStage2IncomingSuggestions(
      { amountCents: 60000, purpose: "Hausgeld W01", counterpartyName: "Erika Musterfrau" },
      candidates,
    );
    expect(result[0].ownerId).toBe("o1");
    expect(result[0].reasons.some((r) => r.includes("Vielfachen"))).toBe(true);
  });

  it("sortiert absteigend nach Punktwert", () => {
    // Beide Kandidaten liegen über dem Anzeige-Schwellenwert (Name+Betrag),
    // unterscheiden sich aber in der Namensähnlichkeit (Zusatz "GbR").
    const mixed: HeuristicOwnerCandidate[] = [
      { ownerId: "low", unitId: "u1", ownerName: "Erika Musterfrau GbR", unitNumber: "W01", monthlyAdvanceCents: 30000, openReceivablesCents: 30000 },
      { ownerId: "high", unitId: "u2", ownerName: "Erika Musterfrau", unitNumber: "W02", monthlyAdvanceCents: 30000, openReceivablesCents: 30000 },
    ];
    const result = computeStage2IncomingSuggestions(
      { amountCents: 30000, purpose: "Hausgeld", counterpartyName: "Erika Musterfrau" },
      mixed,
    );
    expect(result.map((r) => r.ownerId)).toEqual(["high", "low"]);
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });
});

describe("computeStage2OutgoingSuggestion", () => {
  it("liefert null ohne vorherige Buchungen", () => {
    expect(computeStage2OutgoingSuggestion([])).toBeNull();
  });

  it("liefert null, wenn keine der vorherigen Buchungen eine Kostenart hatte", () => {
    expect(computeStage2OutgoingSuggestion([{ costTypeId: null }, { costTypeId: null }])).toBeNull();
  });

  it("schlägt die einzige bisherige Kostenart mit Score 1 vor", () => {
    const result = computeStage2OutgoingSuggestion([{ costTypeId: "ct-hausmeister" }]);
    expect(result).toEqual({
      costTypeId: "ct-hausmeister", score: 1, highlight: true,
      reasons: ["Einzige bisherige Buchung derselben Gegenpartei nutzte diese Kostenart"],
    });
  });

  it("schlägt bei uneinheitlicher Historie die häufigste Kostenart mit anteiligem Score vor", () => {
    const result = computeStage2OutgoingSuggestion([
      { costTypeId: "ct-hausmeister" }, { costTypeId: "ct-hausmeister" }, { costTypeId: "ct-instandhaltung" },
    ]);
    expect(result?.costTypeId).toBe("ct-hausmeister");
    expect(result?.score).toBeCloseTo(2 / 3, 5);
    expect(result?.highlight).toBe(false);
  });
});
