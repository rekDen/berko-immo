import { describe, it, expect } from "vitest";
import { generateAdvanceMonths } from "../advance-schedule";

describe("generateAdvanceMonths", () => {
  it("generates one entry per month in a closed range", () => {
    const result = generateAdvanceMonths({
      validFrom: "2026-01-01",
      validTo: "2026-03-01",
      horizonEnd: "2027-01-01",
      dueDayOfMonth: 1,
      monthlyOperating: 20000,
      monthlyReserve: 5000,
    });
    expect(result.map((r) => r.periodMonth)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(result[0]).toEqual({
      periodMonth: "2026-01-01",
      dueDate: "2026-01-01",
      operating: 20000,
      reserve: 5000,
      amount: 25000,
    });
  });

  it("stops at the horizon when validTo is open-ended", () => {
    const result = generateAdvanceMonths({
      validFrom: "2026-01-01",
      validTo: null,
      horizonEnd: "2026-04-01",
      dueDayOfMonth: 1,
      monthlyOperating: 10000,
      monthlyReserve: 0,
    });
    expect(result.map((r) => r.periodMonth)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("clamps dueDayOfMonth to the last day of shorter months", () => {
    const result = generateAdvanceMonths({
      validFrom: "2026-02-01",
      validTo: "2026-02-01",
      horizonEnd: "2027-01-01",
      dueDayOfMonth: 31,
      monthlyOperating: 1000,
      monthlyReserve: 0,
    });
    expect(result[0].dueDate).toBe("2026-02-28");
  });

  it("spans a year boundary correctly", () => {
    const result = generateAdvanceMonths({
      validFrom: "2026-11-01",
      validTo: "2027-02-01",
      horizonEnd: "2028-01-01",
      dueDayOfMonth: 5,
      monthlyOperating: 1000,
      monthlyReserve: 0,
    });
    expect(result.map((r) => r.periodMonth)).toEqual([
      "2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01",
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const params = {
      validFrom: "2026-01-01", validTo: "2026-06-01", horizonEnd: "2027-01-01",
      dueDayOfMonth: 3, monthlyOperating: 500, monthlyReserve: 100,
    };
    expect(generateAdvanceMonths(params)).toEqual(generateAdvanceMonths(params));
  });
});
