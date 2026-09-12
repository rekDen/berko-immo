import Decimal from "decimal.js";
import {
  ENGINE_VERSION,
  type ApportionableShare,
  type AssetReport,
  type BankAccountReconciliation,
  type Cents,
  type CostTypeBreakdown,
  type Dec,
  type HeatingReconciliation,
  type Par35aShare,
  type ReserveDevelopmentResult,
  type SettlementInput,
  type SettlementResult,
  type SpecialLevyReport,
  type UnitInfoBlock,
  type UnitSettlement,
} from "./types";
import { computeKeyWeights } from "./weights";
import { distributeCostType, distributeLaborShares, weightsForKey } from "./distribution";
import type { AllocationWeight } from "./allocation";

export { ENGINE_VERSION };

/**
 * Rechenschritte nach Kapitel 7 (ohne UI, ohne DB — reine Funktion über
 * `SettlementInput`). Das Filtern auf Buchungen des Jahres (Schritt 1 der
 * Spec) ist Aufgabe der noch nicht gebauten I/O-Brücke (`server-load.ts`,
 * M4) — `SettlementInput` enthält per Vertrag bereits nur die bestätigten
 * Daten des betreffenden Jahres.
 */
export function computeSettlement(input: SettlementInput): SettlementResult {
  const costTypeById = new Map(input.costTypes.map((c) => [c.id, c]));

  const weightsByKey = new Map<string, Map<string, Dec>>();
  for (const key of input.allocationKeys) {
    weightsByKey.set(key.id, computeKeyWeights(input.units, input.allocationKeyValues, key.id, input.year));
  }

  const costTypeBreakdowns: CostTypeBreakdown[] = [];
  const heatingReconciliations: HeatingReconciliation[] = [];

  // K/E je Einheit, akkumuliert über alle Kostenarten (inkl. Heizkosten laut Messdienst).
  const costPerUnit = new Map<string, Cents>();
  const incomePerUnit = new Map<string, Cents>();
  for (const u of input.units) {
    costPerUnit.set(u.id, 0);
    incomePerUnit.set(u.id, 0);
  }

  const par35aByUnit = new Map<string, Map<string, Cents>>();
  const apportionableByUnit = new Map<string, Map<number, Cents>>();
  const nonApportionableByUnit = new Map<string, Cents>();
  const co2ByUnit = new Map<string, { amount: Cents; landlordSharePct: Dec | null }[]>();
  for (const u of input.units) {
    par35aByUnit.set(u.id, new Map());
    apportionableByUnit.set(u.id, new Map());
    nonApportionableByUnit.set(u.id, 0);
    co2ByUnit.set(u.id, []);
  }

  const addToUnitMap = (map: Map<string, Cents>, unitId: string, amount: Cents) => {
    map.set(unitId, (map.get(unitId) ?? 0) + amount);
  };

  for (const costType of input.costTypes) {
    if (costType.isHeating) continue; // separat unten, s. 5.5

    const weights: AllocationWeight[] = costType.allocationKeyId
      ? weightsForKey(input.units, weightsByKey.get(costType.allocationKeyId) ?? new Map())
      : input.units.map((u) => ({ unitId: u.id, sortKey: u.sortKey, weight: new Decimal(0) }));

    const dist = distributeCostType(costType, input.costBookings, weights);
    const keyTotalWeight = costType.allocationKeyId
      ? weights.reduce((s, w) => s.plus(w.weight), new Decimal(0))
      : null;

    costTypeBreakdowns.push({
      costTypeId: costType.id,
      direction: costType.direction,
      total: dist.total,
      allocationKeyId: costType.allocationKeyId,
      keyTotalWeight,
      perUnit: input.units.map((u) => ({
        unitId: u.id,
        weight: dist.weightPerUnit.get(u.id) ?? null,
        exactShare: dist.exactPerUnit.get(u.id) ?? null,
        amount: dist.perUnit.get(u.id) ?? 0,
      })),
      blockedZeroWeight: dist.blockedZeroWeight,
      directChargeErrors: dist.directChargeErrors,
    });

    const target = costType.direction === "expense" ? costPerUnit : incomePerUnit;
    for (const [unitId, amount] of dist.perUnit) addToUnitMap(target, unitId, amount);

    if (costType.direction === "expense") {
      if (costType.apportionable && costType.betrkvNo !== null) {
        for (const [unitId, amount] of dist.perUnit) {
          const perUnit = apportionableByUnit.get(unitId)!;
          perUnit.set(costType.betrkvNo, (perUnit.get(costType.betrkvNo) ?? 0) + amount);
        }
      } else if (!costType.apportionable) {
        for (const [unitId, amount] of dist.perUnit) {
          nonApportionableByUnit.set(unitId, (nonApportionableByUnit.get(unitId) ?? 0) + amount);
        }
      }
    }

    if (input.costBookings.some((b) => b.costTypeId === costType.id && (b.laborAmount ?? 0) > 0)) {
      const labor = distributeLaborShares(costType, input.costBookings, weights);
      for (const [unitId, byCategory] of labor) {
        const target = par35aByUnit.get(unitId)!;
        for (const [category, amount] of byCategory) target.set(category, (target.get(category) ?? 0) + amount);
      }
    }
  }

  // Heizkosten (5.5): Verteilung je Einheit kommt aus dem Messdienst-Import,
  // nicht aus allocate(). Tatsächlich gezahlte Beträge (costBookings dieser
  // Kostenart) fließen weiterhin in die Kontenabstimmung/Gesamtabrechnung ein,
  // aber nicht in K — die Differenz ist die Überleitungsrechnung (5.5.3).
  for (const heating of input.heatingAllocations) {
    const costType = costTypeById.get(heating.costTypeId);
    if (!costType) continue;

    const perUnitSum = heating.perUnit.reduce((s, u) => s + u.heating + u.hotWater, 0);
    const actualPaid = input.costBookings
      .filter((b) => b.costTypeId === heating.costTypeId)
      .reduce((s, b) => s + b.amount, 0);

    heatingReconciliations.push({
      costTypeId: heating.costTypeId,
      messdienstTotal: heating.totalAmount,
      actualPaid,
      difference: actualPaid - heating.totalAmount,
      perUnitSumMismatch: perUnitSum - heating.totalAmount,
    });

    costTypeBreakdowns.push({
      costTypeId: heating.costTypeId,
      direction: costType.direction,
      total: heating.totalAmount,
      allocationKeyId: null,
      keyTotalWeight: null,
      perUnit: input.units.map((u) => {
        const entry = heating.perUnit.find((p) => p.unitId === u.id);
        return { unitId: u.id, weight: null, exactShare: null, amount: entry ? entry.heating + entry.hotWater : 0 };
      }),
      blockedZeroWeight: false,
      directChargeErrors: [],
    });

    const target = costType.direction === "expense" ? costPerUnit : incomePerUnit;
    for (const entry of heating.perUnit) {
      addToUnitMap(target, entry.unitId, entry.heating + entry.hotWater);
      if (costType.direction === "expense") {
        if (costType.apportionable && costType.betrkvNo !== null) {
          const perUnit = apportionableByUnit.get(entry.unitId)!;
          perUnit.set(costType.betrkvNo, (perUnit.get(costType.betrkvNo) ?? 0) + entry.heating + entry.hotWater);
        } else if (!costType.apportionable) {
          nonApportionableByUnit.set(entry.unitId, (nonApportionableByUnit.get(entry.unitId) ?? 0) + entry.heating + entry.hotWater);
        }
      }
      if (entry.co2Cost !== undefined) {
        co2ByUnit.get(entry.unitId)!.push({ amount: entry.co2Cost, landlordSharePct: entry.co2LandlordSharePct ?? null });
      }
      if (entry.laborAmount) {
        const perUnit = par35aByUnit.get(entry.unitId)!;
        // Heizkosten-Lohnanteile sind bereits je Einheit vorgegeben (Messdienst),
        // keine eigene Kategorie im Import vorgesehen -> als 'craftsman' geführt
        // (Standardannahme, s. hausgeldabrechnung-plan.md offene Fragen).
        perUnit.set("craftsman", (perUnit.get("craftsman") ?? 0) + entry.laborAmount);
      }
    }
  }

  const advanceByUnit = new Map(input.advances.map((a) => [a.unitId, a]));
  const receivablesByUnit = new Map(input.ownerReceivablesOpen.map((r) => [r.unitId, r]));

  const units: UnitSettlement[] = input.units.map((u) => {
    const costs = costPerUnit.get(u.id) ?? 0;
    const income = incomePerUnit.get(u.id) ?? 0;
    const result = costs - income;
    const advancesSoll = advanceByUnit.get(u.id)?.operatingCents ?? 0;
    const balance = result - advancesSoll;
    const receivables = receivablesByUnit.get(u.id);

    const info: UnitInfoBlock = {
      openAdvances: receivables?.openAdvances ?? 0,
      openSpecialLevies: receivables?.openSpecialLevies ?? 0,
      par35a: [...(par35aByUnit.get(u.id) ?? new Map())].map(
        ([category, amount]): Par35aShare => ({ category: category as Par35aShare["category"], amount }),
      ),
      apportionable: [...(apportionableByUnit.get(u.id) ?? new Map())].map(
        ([betrkvNo, amount]): ApportionableShare => ({ betrkvNo, amount }),
      ),
      nonApportionable: nonApportionableByUnit.get(u.id) ?? 0,
      co2: co2ByUnit.get(u.id) ?? [],
    };

    return { unitId: u.id, costs, income, result, advancesSoll, balance, info };
  });

  const bankReconciliations: BankAccountReconciliation[] = input.bankAccounts.map((b) => {
    const computedClosing = b.openingBalance + b.totalIn - b.totalOut;
    return {
      bankAccountId: b.id,
      openingBalance: b.openingBalance,
      totalIn: b.totalIn,
      totalOut: b.totalOut,
      computedClosing,
      confirmedClosing: b.confirmedClosingBalance,
      matches: b.confirmedClosingBalance !== null && computedClosing === b.confirmedClosingBalance,
    };
  });

  const bankAccountById = new Map(input.bankAccounts.map((b) => [b.id, b]));
  const reserveDevelopments: ReserveDevelopmentResult[] = input.reserveDevelopments.map((r) => {
    const account = bankAccountById.get(r.bankAccountId);
    const entnahmen = r.entnahmen.reduce((s, e) => s + e.amount, 0);
    const computedClosing = account ? account.openingBalance + r.istZufuehrung - entnahmen + r.zinsen : 0;
    const confirmedClosing = account?.confirmedClosingBalance ?? null;
    return {
      bankAccountId: r.bankAccountId,
      openingBalance: account?.openingBalance ?? 0,
      sollZufuehrung: r.sollZufuehrung,
      istZufuehrung: r.istZufuehrung,
      zufuehrungDifferenz: r.sollZufuehrung - r.istZufuehrung,
      entnahmen,
      zinsen: r.zinsen,
      computedClosing,
      confirmedClosing,
      matches: confirmedClosing !== null && computedClosing === confirmedClosing,
    };
  });

  const assetReport: AssetReport = {
    bankBalances: input.bankAccounts.map((b) => ({ bankAccountId: b.id, kind: b.kind, balance: b.confirmedClosingBalance })),
    reserves: reserveDevelopments,
    receivablesTotal: input.ownerReceivablesOpen.reduce((s, r) => s + r.openAdvances + r.openSpecialLevies, 0),
    liabilities: input.liabilityItems,
    otherAssets: input.assetItems,
  };

  const specialLevies: SpecialLevyReport[] = input.specialLevies.map((levy) => {
    const soll = levy.unitAmounts.reduce((s, u) => s + u.soll, 0);
    const ist = levy.unitAmounts.reduce((s, u) => s + u.ist, 0);
    return { id: levy.id, purpose: levy.purpose, soll, ist, offen: soll - ist };
  });

  // Realer Zahlungsmittelfluss (5.2/5.12) — inkl. Heizkosten-Kostenart, deren
  // costBookings die tatsächlichen Zahlungen sind (nicht die Messdienst-Werte,
  // die stattdessen K speisen, s. oben).
  const expenseTotal = input.costBookings
    .filter((b) => costTypeById.get(b.costTypeId)?.direction === "expense")
    .reduce((s, b) => s + b.amount, 0);

  const otherIncomeTotal = input.costBookings
    .filter((b) => costTypeById.get(b.costTypeId)?.direction === "income")
    .reduce((s, b) => s + b.amount, 0);

  return {
    engineVersion: ENGINE_VERSION,
    propertyId: input.propertyId,
    year: input.year,
    costTypeBreakdowns,
    heatingReconciliations,
    units,
    bankReconciliations,
    reserveDevelopments,
    assetReport,
    specialLevies,
    overall: {
      advancePaymentsIst: input.advancePaymentsIst,
      specialLevyPaymentsIst: input.specialLevyPaymentsIst,
      otherIncomeTotal,
      expenseTotal,
      internalTransfersNet: input.internalTransfersNet,
      priorYearSettlementPayments: input.priorYearSettlementPayments,
    },
  };
}
