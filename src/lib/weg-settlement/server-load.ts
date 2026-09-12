import type { SupabaseClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";
import type {
  AdvanceSoll,
  AllocationKeyDef,
  AllocationKeyValueDef,
  AssetItemInput,
  BankAccountInput,
  Cents,
  CostBooking,
  CostTypeDef,
  EngineUnit,
  HeatingAllocationInput,
  LiabilityItemInput,
  OwnerReceivablesOpenInput,
  PriorYearClosingInput,
  ReserveDevelopmentInput,
  SettlementInput,
  SpecialLevyInput,
} from "./types";

/**
 * Einziger Ort mit Supabase-Zugriff für dieses Modul (Kapitel 7, Muster wie
 * `src/lib/optimization/server-load.ts`): lädt DB-Zeilen der `weg-buchhaltung`-
 * Tabellen und der M1-Tabellen (`heating_imports`, `asset_items`,
 * `liability_items`) und mappt sie auf `SettlementInput`. Der Rechenkern
 * selbst (`engine.ts`, `checks.ts`, `allocation.ts`, ...) bleibt davon
 * unberührt und DB-frei.
 *
 * Vorzeichenkonvention für `CostBooking.amount`: `costType.direction === 'expense'
 * ? -transactions.amount : transactions.amount` — unabhängig von der
 * Buchungsart (`kind`). Das bildet sowohl den Normalfall als auch eine
 * Gutschrift (8.2 C17) einheitlich ab, ohne die Buchungsart selbst als
 * Vorzeichenquelle zu verwenden.
 *
 * Bekannte Lücke: `priorYearSettlementPayments` ist immer 0, weil die
 * Buchungsart `settlement_payment` (B8.1) noch nicht Teil des
 * `transactions.kind`-Check-Constraints ist — dafür braucht es eine eigene,
 * kleine Migration, sobald die erste Abrechnung den Status `RESOLVED`
 * erreicht und tatsächlich Zahlungen darauf verbucht werden.
 */
export async function loadSettlementInput(
  supabase: SupabaseClient,
  propertyId: string,
  year: number,
): Promise<SettlementInput> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const priorYearEnd = `${year - 1}-12-31`;

  const [{ data: unitRows }, { data: keyRows }, { data: costTypeRows }, { data: bankAccountRows }] = await Promise.all([
    supabase.from("units").select("id, unit_number").eq("property_id", propertyId).is("deleted_at", null),
    supabase.from("allocation_keys").select("id, name, type").eq("property_id", propertyId),
    supabase.from("cost_types").select("id, name, direction, allocation_key_id, is_heating, allows_direct_charge, apportionable, betrkv_no, resolution_ref").eq("property_id", propertyId),
    supabase.from("community_bank_accounts").select("id, kind, ledger_account_id").eq("property_id", propertyId),
  ]);

  const units: EngineUnit[] = (unitRows ?? []).map((u) => ({ id: u.id, sortKey: u.unit_number }));
  const allocationKeys: AllocationKeyDef[] = (keyRows ?? []).map((k) => ({ id: k.id, name: k.name, type: k.type }));
  const costTypes: CostTypeDef[] = (costTypeRows ?? []).map((c) => ({
    id: c.id, name: c.name, direction: c.direction, allocationKeyId: c.allocation_key_id,
    isHeating: c.is_heating, allowsDirectCharge: c.allows_direct_charge, apportionable: c.apportionable,
    betrkvNo: c.betrkv_no, resolutionRef: c.resolution_ref,
  }));
  const costTypeById = new Map(costTypes.map((c) => [c.id, c]));

  const keyIds = allocationKeys.map((k) => k.id);
  const { data: keyValueRows } = keyIds.length
    ? await supabase.from("allocation_key_values").select("key_id, unit_id, value, valid_from, valid_to").in("key_id", keyIds)
    : { data: [] as { key_id: string; unit_id: string; value: number; valid_from: string; valid_to: string | null }[] };
  const allocationKeyValues: AllocationKeyValueDef[] = (keyValueRows ?? []).map((v) => ({
    keyId: v.key_id, unitId: v.unit_id, value: new Decimal(v.value), validFrom: v.valid_from, validTo: v.valid_to,
  }));

  const bankAccountIds = (bankAccountRows ?? []).map((b) => b.id);

  const { data: expenseIncomeTx } = bankAccountIds.length
    ? await supabase
        .from("transactions")
        .select("id, cost_type_id, amount, direct_unit_id, labor_amount, par35a_category")
        .in("bank_account_id", bankAccountIds)
        .in("kind", ["expense", "income"])
        .not("cost_type_id", "is", null)
        .eq("status", "confirmed")
        .gte("booking_date", yearStart)
        .lte("booking_date", yearEnd)
    : { data: [] };

  const costBookings: CostBooking[] = (expenseIncomeTx ?? []).map((t) => {
    const costType = costTypeById.get(t.cost_type_id as string);
    const sign = costType?.direction === "expense" ? -1 : 1;
    return {
      id: t.id,
      costTypeId: t.cost_type_id as string,
      amount: sign * (t.amount as number),
      directUnitId: t.direct_unit_id ?? undefined,
      laborAmount: t.labor_amount ?? undefined,
      par35aCategory: t.par35a_category ?? undefined,
    };
  });

  // Heizkosten (5.5)
  const { data: heatingImportRows } = await supabase
    .from("heating_imports")
    .select("id, cost_type_id, total_amount, confirmed_difference, reconciliation_note")
    .eq("property_id", propertyId)
    .eq("year", year);

  const heatingAllocations: HeatingAllocationInput[] = [];
  for (const imp of heatingImportRows ?? []) {
    const { data: unitRowsForImport } = await supabase
      .from("heating_import_units")
      .select("unit_id, heating, hot_water, co2_cost, co2_landlord_share_pct, labor_amount")
      .eq("import_id", imp.id);
    heatingAllocations.push({
      costTypeId: imp.cost_type_id,
      totalAmount: imp.total_amount,
      perUnit: (unitRowsForImport ?? []).map((u) => ({
        unitId: u.unit_id, heating: u.heating, hotWater: u.hot_water,
        co2Cost: u.co2_cost ?? undefined,
        co2LandlordSharePct: u.co2_landlord_share_pct !== null ? new Decimal(u.co2_landlord_share_pct) : undefined,
        laborAmount: u.labor_amount ?? undefined,
      })),
      confirmedRoundingDifference: imp.confirmed_difference,
      reconciliationNote: imp.reconciliation_note,
    });
  }

  // Soll-Vorschüsse (B7.2) — aus Receivables, unabhängig vom Zahlungsstatus
  const { data: advanceReceivables } = await supabase
    .from("receivables")
    .select("unit_id, components")
    .eq("property_id", propertyId)
    .eq("kind", "advance")
    .gte("due_date", yearStart)
    .lte("due_date", yearEnd);

  const advanceByUnit = new Map<string, { operating: Cents; reserve: Cents }>();
  for (const r of advanceReceivables ?? []) {
    const comp = (r.components as { operating: number; reserve: number } | null) ?? { operating: 0, reserve: 0 };
    const prev = advanceByUnit.get(r.unit_id) ?? { operating: 0, reserve: 0 };
    advanceByUnit.set(r.unit_id, { operating: prev.operating + comp.operating, reserve: prev.reserve + comp.reserve });
  }
  const advances: AdvanceSoll[] = units.map((u) => ({
    unitId: u.id,
    operatingCents: advanceByUnit.get(u.id)?.operating ?? 0,
    reserveCents: advanceByUnit.get(u.id)?.reserve ?? 0,
  }));
  const sollZufuehrungTotal = [...advanceByUnit.values()].reduce((s, v) => s + v.reserve, 0);

  // Ist-Zahlungen (5.2) — Hausgeld/Sonderumlage
  const { data: advancePaymentTx } = bankAccountIds.length
    ? await supabase.from("transactions").select("id, amount").in("bank_account_id", bankAccountIds).eq("kind", "advance_payment").eq("status", "confirmed").gte("booking_date", yearStart).lte("booking_date", yearEnd)
    : { data: [] };
  const advancePaymentsIst = (advancePaymentTx ?? []).reduce((s, t) => s + t.amount, 0);
  const advancePaymentTxIds = (advancePaymentTx ?? []).map((t) => t.id);

  const { data: specialLevyPaymentTx } = bankAccountIds.length
    ? await supabase.from("transactions").select("amount").in("bank_account_id", bankAccountIds).eq("kind", "special_levy_payment").eq("status", "confirmed").gte("booking_date", yearStart).lte("booking_date", yearEnd)
    : { data: [] };
  const specialLevyPaymentsIst = (specialLevyPaymentTx ?? []).reduce((s, t) => s + t.amount, 0);

  const { data: internalTransferTx } = bankAccountIds.length
    ? await supabase.from("transactions").select("amount").in("bank_account_id", bankAccountIds).eq("kind", "internal_transfer").eq("status", "confirmed").gte("booking_date", yearStart).lte("booking_date", yearEnd)
    : { data: [] };
  const internalTransfersNet = (internalTransferTx ?? []).reduce((s, t) => s + t.amount, 0);

  // Bankkonten / Kontenabstimmung (5.12) + Rücklagenentwicklung (5.6)
  const { data: propertyJournalEntries } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("property_id", propertyId)
    .gte("date", yearStart)
    .lte("date", yearEnd);
  const journalEntryIds = (propertyJournalEntries ?? []).map((e) => e.id);

  const bankAccounts: BankAccountInput[] = [];
  const reserveDevelopments: ReserveDevelopmentInput[] = [];
  const priorYearClosings: PriorYearClosingInput[] = [];

  for (const account of bankAccountRows ?? []) {
    const { data: lines } = journalEntryIds.length
      ? await supabase.from("journal_entry_lines").select("debit, credit").eq("account_id", account.ledger_account_id).in("journal_entry_id", journalEntryIds)
      : { data: [] };
    const totalIn = (lines ?? []).reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalOut = (lines ?? []).reduce((s, l) => s + (l.credit ?? 0), 0);

    const { data: closingConf } = await supabase.from("balance_confirmations").select("balance").eq("bank_account_id", account.id).eq("date", yearEnd).maybeSingle();
    const { data: openingConf } = await supabase.from("balance_confirmations").select("balance").eq("bank_account_id", account.id).eq("date", priorYearEnd).maybeSingle();

    const openingBalance = openingConf?.balance ?? 0;
    bankAccounts.push({
      id: account.id, kind: account.kind, openingBalance, totalIn, totalOut,
      confirmedClosingBalance: closingConf?.balance ?? null,
    });
    if (openingConf) priorYearClosings.push({ bankAccountId: account.id, closingBalance: openingConf.balance });

    if (account.kind === "reserve") {
      const { data: reserveAdvanceReceivables } = await supabase
        .from("receivables").select("id").eq("property_id", propertyId).eq("kind", "advance");
      const receivableIds = (reserveAdvanceReceivables ?? []).map((r) => r.id);

      let istZufuehrung = 0;
      if (receivableIds.length && advancePaymentTxIds.length) {
        const { data: allocs } = await supabase
          .from("payment_allocations")
          .select("components")
          .in("receivable_id", receivableIds)
          .in("transaction_id", advancePaymentTxIds)
          .is("reversed_at", null);
        istZufuehrung = (allocs ?? []).reduce((s, a) => {
          const comp = a.components as { reserve?: number } | null;
          return s + (comp?.reserve ?? 0);
        }, 0);
      }

      const { data: entnahmenTx } = await supabase
        .from("transactions").select("amount, resolution_ref")
        .eq("bank_account_id", account.id).eq("kind", "reserve_expense").eq("status", "confirmed")
        .gte("booking_date", yearStart).lte("booking_date", yearEnd);
      const { data: zinsenTx } = await supabase
        .from("transactions").select("amount")
        .eq("bank_account_id", account.id).eq("kind", "income").eq("status", "confirmed")
        .gte("booking_date", yearStart).lte("booking_date", yearEnd);

      reserveDevelopments.push({
        bankAccountId: account.id,
        sollZufuehrung: sollZufuehrungTotal,
        istZufuehrung,
        entnahmen: (entnahmenTx ?? []).map((t) => ({ amount: Math.abs(t.amount), resolutionRef: t.resolution_ref })),
        zinsen: (zinsenTx ?? []).reduce((s, t) => s + t.amount, 0),
      });
    }
  }

  // Sonderumlagen (5.8)
  const { data: levyRows } = await supabase.from("special_levies").select("id, purpose").eq("property_id", propertyId);
  const specialLevies: SpecialLevyInput[] = [];
  for (const levy of levyRows ?? []) {
    const { data: levyUnits } = await supabase.from("special_levy_units").select("id, unit_id, amount").eq("levy_id", levy.id);
    const unitAmounts = [];
    for (const lu of levyUnits ?? []) {
      const { data: recv } = await supabase.from("receivables").select("id").eq("source_special_levy_unit_id", lu.id).maybeSingle();
      let ist = 0;
      if (recv) {
        const { data: allocs } = await supabase.from("payment_allocations").select("amount").eq("receivable_id", recv.id).is("reversed_at", null);
        ist = (allocs ?? []).reduce((s, a) => s + a.amount, 0);
      }
      unitAmounts.push({ unitId: lu.unit_id, soll: lu.amount, ist });
    }
    specialLevies.push({ id: levy.id, purpose: levy.purpose, unitAmounts });
  }

  // Offene Sollstellungen je Einheit (Infoblock 5.4.5)
  const { data: openReceivables } = await supabase
    .from("receivables").select("id, unit_id, kind, amount")
    .eq("property_id", propertyId).in("status", ["open", "partial"]).in("kind", ["advance", "special_levy"]);
  const openIds = (openReceivables ?? []).map((r) => r.id);
  const { data: openAllocs } = openIds.length
    ? await supabase.from("payment_allocations").select("receivable_id, amount").in("receivable_id", openIds).is("reversed_at", null)
    : { data: [] };
  const allocatedByReceivable = new Map<string, number>();
  for (const a of openAllocs ?? []) allocatedByReceivable.set(a.receivable_id, (allocatedByReceivable.get(a.receivable_id) ?? 0) + a.amount);

  const ownerReceivablesOpenMap = new Map<string, { openAdvances: Cents; openSpecialLevies: Cents }>();
  for (const u of units) ownerReceivablesOpenMap.set(u.id, { openAdvances: 0, openSpecialLevies: 0 });
  for (const r of openReceivables ?? []) {
    const remaining = Math.abs(r.amount) - (allocatedByReceivable.get(r.id) ?? 0);
    const entry = ownerReceivablesOpenMap.get(r.unit_id);
    if (!entry) continue;
    if (r.kind === "advance") entry.openAdvances += remaining; else entry.openSpecialLevies += remaining;
  }
  const ownerReceivablesOpen: OwnerReceivablesOpenInput[] = units.map((u) => ({
    unitId: u.id, ...(ownerReceivablesOpenMap.get(u.id) ?? { openAdvances: 0, openSpecialLevies: 0 }),
  }));

  // Vermögensbericht — manuelle Positionen (5.13)
  const { data: assetRows } = await supabase.from("asset_items").select("label, amount, note").eq("property_id", propertyId).eq("year", year);
  const assetItems: AssetItemInput[] = (assetRows ?? []).map((a) => ({ label: a.label, amount: a.amount, note: a.note ?? undefined }));

  const { data: liabilityRows } = await supabase.from("liability_items").select("label, amount").eq("property_id", propertyId).eq("year", year);
  const liabilityItems: LiabilityItemInput[] = (liabilityRows ?? []).map((l) => ({ label: l.label, amount: l.amount }));

  return {
    propertyId,
    year,
    units,
    allocationKeys,
    allocationKeyValues,
    costTypes,
    costBookings,
    heatingAllocations,
    advances,
    advancePaymentsIst,
    specialLevyPaymentsIst,
    internalTransfersNet,
    priorYearSettlementPayments: 0, // s. Hinweis oben: 'settlement_payment' noch kein zulässiger transactions.kind
    bankAccounts,
    priorYearClosings,
    reserveDevelopments,
    specialLevies,
    ownerReceivablesOpen,
    assetItems,
    liabilityItems,
  };
}
