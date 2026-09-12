import { describe, it, expect } from "vitest";
import { pickAllocationTargets, splitAdvancePayment, type OpenReceivable } from "../allocation-order";

describe("pickAllocationTargets", () => {
  const receivables: OpenReceivable[] = [
    { id: "r-march", dueDate: "2026-03-01", kind: "advance", openAmount: 30000 },
    { id: "r-jan", dueDate: "2026-01-01", kind: "advance", openAmount: 30000 },
    { id: "r-feb", dueDate: "2026-02-01", kind: "advance", openAmount: 30000 },
  ];

  it("allocates oldest due date first", () => {
    const result = pickAllocationTargets(receivables, 30000);
    expect(result).toEqual([{ receivableId: "r-jan", amount: 30000 }]);
  });

  it("spills over into the next oldest receivable once the first is covered", () => {
    const result = pickAllocationTargets(receivables, 45000);
    expect(result).toEqual([
      { receivableId: "r-jan", amount: 30000 },
      { receivableId: "r-feb", amount: 15000 },
    ]);
  });

  it("leaves a remainder unallocated when payment exceeds all open receivables", () => {
    const result = pickAllocationTargets(receivables, 1000000);
    const total = result.reduce((s, a) => s + a.amount, 0);
    expect(total).toBe(90000);
  });

  it("honors an explicit Tilgungsbestimmung ahead of due-date order", () => {
    const result = pickAllocationTargets(receivables, 30000, "r-march");
    expect(result).toEqual([{ receivableId: "r-march", amount: 30000 }]);
  });

  it("breaks ties on same due date by kind, then id", () => {
    const tied: OpenReceivable[] = [
      { id: "r-b", dueDate: "2026-01-01", kind: "special_levy", openAmount: 10000 },
      { id: "r-a", dueDate: "2026-01-01", kind: "advance", openAmount: 10000 },
    ];
    const result = pickAllocationTargets(tied, 10000);
    expect(result).toEqual([{ receivableId: "r-a", amount: 10000 }]);
  });

  it("returns nothing for a zero or negative payment", () => {
    expect(pickAllocationTargets(receivables, 0)).toEqual([]);
    expect(pickAllocationTargets(receivables, -100)).toEqual([]);
  });

  it("is deterministic and independent of input order", () => {
    const shuffled = [receivables[2], receivables[0], receivables[1]];
    expect(pickAllocationTargets(shuffled, 45000)).toEqual(pickAllocationTargets(receivables, 45000));
  });
});

describe("splitAdvancePayment", () => {
  it("splits proportionally to open operating/reserve components", () => {
    expect(splitAdvancePayment(10000, 8000, 2000)).toEqual({ operating: 8000, reserve: 2000 });
  });

  it("rounds the remainder deterministically", () => {
    const result = splitAdvancePayment(100, 1, 1);
    expect(result.operating + result.reserve).toBe(100);
  });
});
