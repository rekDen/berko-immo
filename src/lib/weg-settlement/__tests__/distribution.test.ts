import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { distributeCostType, distributeLaborShares } from "../distribution";
import type { AllocationWeight } from "../allocation";
import type { CostBooking, CostTypeDef } from "../types";

const weights: AllocationWeight[] = [
  { unitId: "a", sortKey: "W01", weight: new Decimal(250) },
  { unitId: "b", sortKey: "W02", weight: new Decimal(250) },
  { unitId: "c", sortKey: "W03", weight: new Decimal(300) },
  { unitId: "d", sortKey: "W04", weight: new Decimal(200) },
];

const costType: CostTypeDef = {
  id: "ct1", name: "Hausmeister", direction: "expense", allocationKeyId: "mea",
  isHeating: false, allowsDirectCharge: false, apportionable: true, betrkvNo: 14, resolutionRef: null,
};

describe("distributeCostType", () => {
  it("verteilt einen poolierten Betrag exakt nach 5.11", () => {
    const bookings: CostBooking[] = [{ id: "b1", costTypeId: "ct1", amount: 10000 }];
    const dist = distributeCostType(costType, bookings, weights);
    expect(dist.total).toBe(10000);
    expect(dist.perUnit.get("a")).toBe(2500);
    expect(dist.perUnit.get("b")).toBe(2500);
    expect(dist.perUnit.get("c")).toBe(3000);
    expect(dist.perUnit.get("d")).toBe(2000);
    expect(dist.blockedZeroWeight).toBe(false);
  });

  it("summiert mehrere Buchungen derselben Kostenart vor der Verteilung", () => {
    const bookings: CostBooking[] = [
      { id: "b1", costTypeId: "ct1", amount: 6000 },
      { id: "b2", costTypeId: "ct1", amount: 4000 },
    ];
    const dist = distributeCostType(costType, bookings, weights);
    expect(dist.total).toBe(10000);
    expect(dist.sourceBookingIds.get("a")).toEqual(["b1", "b2"]);
  });

  it("weist Direktbelastungen zu 100% der genannten Einheit zu (5.3.5)", () => {
    const directCostType: CostTypeDef = { ...costType, allowsDirectCharge: true };
    const bookings: CostBooking[] = [
      { id: "b1", costTypeId: "ct1", amount: 5000, directUnitId: "a" },
      { id: "b2", costTypeId: "ct1", amount: 10000 }, // gepoolter Rest
    ];
    const dist = distributeCostType(directCostType, bookings, weights);
    expect(dist.total).toBe(15000);
    // a bekommt 5000 direkt + Anteil am gepoolten Rest (250/1000 * 10000 = 2500)
    expect(dist.perUnit.get("a")).toBe(5000 + 2500);
    expect(dist.perUnit.get("b")).toBe(2500);
    expect(dist.directChargeErrors).toEqual([]);
  });

  it("meldet Direktbelastung auf nicht freigegebener Kostenart als Fehler, verliert den Betrag aber nicht", () => {
    const bookings: CostBooking[] = [{ id: "b1", costTypeId: "ct1", amount: 5000, directUnitId: "a" }];
    const dist = distributeCostType(costType, bookings, weights); // allowsDirectCharge: false
    expect(dist.directChargeErrors).toEqual(["b1"]);
    expect(dist.perUnit.get("a")).toBe(5000);
  });

  it("markiert blockedZeroWeight, wenn Gewichtssumme 0 aber Betrag != 0 ist (5.3.3, C04)", () => {
    const zeroWeights: AllocationWeight[] = [
      { unitId: "a", sortKey: "W01", weight: new Decimal(0) },
      { unitId: "b", sortKey: "W02", weight: new Decimal(0) },
    ];
    const bookings: CostBooking[] = [{ id: "b1", costTypeId: "ct1", amount: 1000 }];
    const dist = distributeCostType(costType, bookings, zeroWeights);
    expect(dist.blockedZeroWeight).toBe(true);
    expect(dist.perUnit.get("a")).toBeUndefined();
  });

  it("behandelt negative Beträge (Gutschrift, C17) korrekt mit Vorzeichen", () => {
    const bookings: CostBooking[] = [{ id: "b1", costTypeId: "ct1", amount: -10000 }];
    const dist = distributeCostType(costType, bookings, weights);
    expect(dist.total).toBe(-10000);
    expect(dist.perUnit.get("a")).toBe(-2500);
    expect(dist.perUnit.get("c")).toBe(-3000);
  });

  it("liefert keine Einträge, wenn keine Buchungen zur Kostenart existieren", () => {
    const dist = distributeCostType(costType, [], weights);
    expect(dist.total).toBe(0);
    expect(dist.perUnit.size).toBe(0);
  });

  it("gibt das rohe Schlüsselgewicht je Einheit zurück (Nachvollziehbarkeit, Kapitel 7/8.3)", () => {
    const bookings: CostBooking[] = [{ id: "b1", costTypeId: "ct1", amount: 10000 }];
    const dist = distributeCostType(costType, bookings, weights);
    expect(dist.weightPerUnit.get("a")?.toNumber()).toBe(250);
    expect(dist.weightPerUnit.get("c")?.toNumber()).toBe(300);
  });
});

describe("distributeLaborShares", () => {
  it("verteilt Lohnanteile gruppiert nach Kategorie mit demselben Schlüssel wie die Kostenart", () => {
    const bookings: CostBooking[] = [
      { id: "b1", costTypeId: "ct1", amount: 10000, laborAmount: 4000, par35aCategory: "craftsman" },
    ];
    const labor = distributeLaborShares(costType, bookings, weights);
    expect(labor.get("a")?.get("craftsman")).toBe(1000); // 250/1000 * 4000
    expect(labor.get("c")?.get("craftsman")).toBe(1200); // 300/1000 * 4000
  });

  it("berücksichtigt Direktbelastung auch beim Lohnanteil", () => {
    const directCostType: CostTypeDef = { ...costType, allowsDirectCharge: true };
    const bookings: CostBooking[] = [
      { id: "b1", costTypeId: "ct1", amount: 5000, directUnitId: "a", laborAmount: 3000, par35aCategory: "craftsman" },
    ];
    const labor = distributeLaborShares(directCostType, bookings, weights);
    expect(labor.get("a")?.get("craftsman")).toBe(3000);
    expect(labor.has("b")).toBe(false);
  });

  it("trennt mehrere Kategorien innerhalb derselben Kostenart", () => {
    const bookings: CostBooking[] = [
      { id: "b1", costTypeId: "ct1", amount: 5000, laborAmount: 2000, par35aCategory: "craftsman" },
      { id: "b2", costTypeId: "ct1", amount: 3000, laborAmount: 1000, par35aCategory: "household_service" },
    ];
    const labor = distributeLaborShares(costType, bookings, weights);
    expect(labor.get("a")?.get("craftsman")).toBe(500);
    expect(labor.get("a")?.get("household_service")).toBe(250);
  });
});
