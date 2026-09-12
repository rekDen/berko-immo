/**
 * Largest-remainder (Hare-Niemeyer) proportional split, per spec 5.11.
 * Reused here for the 2-way operating/reserve split of a partial advance
 * payment (B7.7); the N-unit variant with natural-sort tie-break belongs to
 * the settlement engine (weg-settlement `allocate()`, spec 7).
 *
 * Deterministic: same input -> same output. Negative `total` handled via
 * absolute value + sign re-applied (spec 5.11.2).
 */
export function allocateProportional(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (sumWeights === 0) return weights.map(() => 0);

  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);

  const exact = weights.map((w) => (absTotal * w) / sumWeights);
  const floors = exact.map(Math.floor);
  const allocated = floors.reduce((a, b) => a + b, 0);
  const remainder = absTotal - allocated;

  const remainders = exact
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[remainders[k].i] += 1;
  }
  return result.map((v) => v * sign);
}
