import { describe, it, expect } from "vitest";
import { allocateProportional } from "../rounding";

describe("allocateProportional", () => {
  it("splits evenly divisible amounts exactly", () => {
    expect(allocateProportional(10000, [250, 250, 300, 200])).toEqual([2500, 2500, 3000, 2000]);
  });

  it("distributes remainder cents by largest fractional remainder", () => {
    expect(allocateProportional(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
  });

  it("handles a tiny amount with more weights than cents", () => {
    expect(allocateProportional(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it("preserves sign for negative totals", () => {
    expect(allocateProportional(-10000, [1, 1, 1])).toEqual([-3334, -3333, -3333]);
  });

  it("sums to exactly the total for arbitrary weights", () => {
    const total = 123456;
    const weights = [7, 13, 1, 42, 5];
    const result = allocateProportional(total, weights);
    expect(result.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("returns zeros when total weight is zero", () => {
    expect(allocateProportional(500, [0, 0])).toEqual([0, 0]);
  });

  it("is deterministic across repeated calls", () => {
    const a = allocateProportional(10001, [3, 3, 3, 1]);
    const b = allocateProportional(10001, [3, 3, 3, 1]);
    expect(a).toEqual(b);
  });
});
