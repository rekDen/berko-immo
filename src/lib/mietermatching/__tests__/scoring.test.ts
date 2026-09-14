import { describe, it, expect } from "vitest";
import { computeMatchScore, type ApplicantForScoring, type DesiredTenantProfileForScoring } from "../scoring";

const baseProfile: DesiredTenantProfileForScoring = {
  targetRentCold: 1000,
  incomeToRentRatioMin: 3.0,
  employmentTypesAccepted: ["unbefristet"],
  householdSizeMin: 1,
  householdSizeMax: 2,
  moveInEarliest: "2026-01-01",
  moveInLatest: "2026-03-01",
  schufaRequired: false,
  requiredDocuments: ["income_proof"],
  weights: { income_ratio: 30, employment: 15, schufa: 25, household_size: 10, move_in: 10, documents_completeness: 10 },
};

const baseApplicant: ApplicantForScoring = {
  netIncome: 3000,
  employmentType: "unbefristet",
  householdSize: 2,
  desiredMoveIn: "2026-02-01",
  schufaResult: { classification: "none_negative" },
  uploadedDocumentTypes: ["income_proof"],
};

describe("computeMatchScore — Gesamtscore", () => {
  it("liefert 100 für einen in allen Kriterien perfekt passenden Bewerber inkl. vollständiger Unterlagen", () => {
    const result = computeMatchScore(baseProfile, baseApplicant);
    expect(result.overallScore).toBe(100);
    expect(result.confidence).toBe(1);
    expect(result.missingDocuments).toEqual([]);
  });

  it("liefert einen niedrigen Score bei klarem Ausschluss (Einkommen zu gering, SCHUFA hart negativ)", () => {
    const applicant: ApplicantForScoring = {
      ...baseApplicant,
      netIncome: 1500, // Quote 1.5, deutlich unter der harten Untergrenze (2.0)
      schufaResult: { classification: "hard_negative" },
    };
    const result = computeMatchScore(baseProfile, applicant);
    expect(result.overallScore).toBeLessThan(50);
  });

  it("zieht bei fehlenden Angaben Confidence ab, senkt aber nicht auf 0 (Spec §3.3: neutraler Mittelwert statt 0-Score)", () => {
    const applicant: ApplicantForScoring = { ...baseApplicant, netIncome: null, employmentType: null, schufaResult: null };
    const result = computeMatchScore(baseProfile, applicant);
    const incomeCriterion = result.criteriaBreakdown.find((c) => c.criterion === "income_ratio")!;
    expect(incomeCriterion.subScore).toBe(50);
    expect(incomeCriterion.note).not.toBeNull();
    expect(result.confidence).toBeLessThan(0.7);
  });
});

describe("income_ratio", () => {
  it("volle Punktzahl ab Zielquote", () => {
    const applicant = { ...baseApplicant, netIncome: 3000 }; // Quote 3.0 = Ziel
    const c = computeMatchScore(baseProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "income_ratio")!;
    expect(c.subScore).toBe(100);
    expect(c.matched).toBe(true);
  });

  it("0 Punkte an und unterhalb der harten Untergrenze (2/3 der Zielquote)", () => {
    const applicant = { ...baseApplicant, netIncome: 2000 }; // Quote 2.0 = harte Untergrenze bei Ziel 3.0
    const c = computeMatchScore(baseProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "income_ratio")!;
    expect(c.subScore).toBe(0);
  });

  it("linearer Zwischenwert zwischen Untergrenze und Ziel", () => {
    const applicant = { ...baseApplicant, netIncome: 2500 }; // Quote 2.5, Mitte zwischen 2.0 und 3.0
    const c = computeMatchScore(baseProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "income_ratio")!;
    expect(c.subScore).toBe(50);
  });
});

describe("employment", () => {
  it("exakter Treffer in employmentTypesAccepted = 100", () => {
    const c = computeMatchScore(baseProfile, baseApplicant).criteriaBreakdown.find((x) => x.criterion === "employment")!;
    expect(c.subScore).toBe(100);
  });

  it("kein Treffer = 0", () => {
    const applicant = { ...baseApplicant, employmentType: "selbststaendig" };
    const c = computeMatchScore(baseProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "employment")!;
    expect(c.subScore).toBe(0);
  });
});

describe("schufa", () => {
  it("none_negative = 100, soft_negative = 50, hard_negative = 0", () => {
    for (const [classification, expected] of [["none_negative", 100], ["soft_negative", 50], ["hard_negative", 0]] as const) {
      const applicant = { ...baseApplicant, schufaResult: { classification } };
      const c = computeMatchScore(baseProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "schufa")!;
      expect(c.subScore).toBe(expected);
    }
  });

  it("keine Auskunft: neutraler Score, niedriger falls schufaRequired", () => {
    const applicant = { ...baseApplicant, schufaResult: null };
    const normal = computeMatchScore(baseProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "schufa")!;
    expect(normal.subScore).toBe(50);

    const strictProfile = { ...baseProfile, schufaRequired: true };
    const strict = computeMatchScore(strictProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "schufa")!;
    expect(strict.subScore).toBe(40);
  });
});

describe("household_size", () => {
  it("innerhalb des Korridors = 100", () => {
    const c = computeMatchScore(baseProfile, baseApplicant).criteriaBreakdown.find((x) => x.criterion === "household_size")!;
    expect(c.subScore).toBe(100);
  });

  it("außerhalb des Korridors fällt linear ab", () => {
    const applicant = { ...baseApplicant, householdSize: 4 }; // max 2, Differenz 2
    const c = computeMatchScore(baseProfile, applicant).criteriaBreakdown.find((x) => x.criterion === "household_size")!;
    expect(c.subScore).toBe(50);
  });

  it("keine Korridor-Grenzen definiert = kein Ausschluss (100)", () => {
    const profile = { ...baseProfile, householdSizeMin: null, householdSizeMax: null };
    const c = computeMatchScore(profile, baseApplicant).criteriaBreakdown.find((x) => x.criterion === "household_size")!;
    expect(c.subScore).toBe(100);
  });
});

describe("move_in", () => {
  it("innerhalb des Zeitraums = 100", () => {
    const c = computeMatchScore(baseProfile, baseApplicant).criteriaBreakdown.find((x) => x.criterion === "move_in")!;
    expect(c.subScore).toBe(100);
  });

  it("außerhalb des Zeitraums fällt über die Toleranzspanne linear ab, danach 0", () => {
    const nearMiss = { ...baseApplicant, desiredMoveIn: "2026-03-16" }; // 15 Tage nach moveInLatest
    const cNear = computeMatchScore(baseProfile, nearMiss).criteriaBreakdown.find((x) => x.criterion === "move_in")!;
    expect(cNear.subScore).toBe(50);

    const farMiss = { ...baseApplicant, desiredMoveIn: "2026-06-01" };
    const cFar = computeMatchScore(baseProfile, farMiss).criteriaBreakdown.find((x) => x.criterion === "move_in")!;
    expect(cFar.subScore).toBe(0);
  });
});

describe("documents_completeness", () => {
  it("100 bei vollständig hochgeladenen Pflichtunterlagen", () => {
    const c = computeMatchScore(baseProfile, baseApplicant).criteriaBreakdown.find((x) => x.criterion === "documents_completeness")!;
    expect(c.subScore).toBe(100);
    expect(c.matched).toBe(true);
    expect(c.note).toBeNull();
  });

  it("Teil-Score und Hinweis bei fehlenden Pflichtunterlagen", () => {
    const profile: DesiredTenantProfileForScoring = { ...baseProfile, requiredDocuments: ["income_proof", "schufa"] };
    const applicant: ApplicantForScoring = { ...baseApplicant, uploadedDocumentTypes: ["income_proof"] };
    const result = computeMatchScore(profile, applicant);
    const c = result.criteriaBreakdown.find((x) => x.criterion === "documents_completeness")!;
    expect(c.subScore).toBe(50);
    expect(c.note).toContain("SCHUFA-Auskunft");
    expect(result.missingDocuments).toEqual(["schufa"]);
  });

  it("100 ohne festgelegte Pflichtunterlagen (kein Kriterium = kein Ausschluss)", () => {
    const profile = { ...baseProfile, requiredDocuments: [] };
    const c = computeMatchScore(profile, baseApplicant).criteriaBreakdown.find((x) => x.criterion === "documents_completeness")!;
    expect(c.subScore).toBe(100);
    expect(c.note).toBeNull();
  });
});
