"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PropertyTabBar from "@/components/dms/PropertyTabBar";
import {
  type Property, type Unit, type AllocationKey, type CostType, type BankAccount,
  type ChartAccount, type Transaction, type EconomicPlan, type SpecialLevy, type MatchingRule, type Owner,
} from "@/components/weg-buchhaltung/shared";
import { BankAccountsSection } from "@/components/weg-buchhaltung/BankAccountsSection";
import { TransactionsSection } from "@/components/weg-buchhaltung/TransactionsSection";
import { AllocationKeysSection } from "@/components/weg-buchhaltung/AllocationKeysSection";
import { CostTypesSection } from "@/components/weg-buchhaltung/CostTypesSection";
import { EconomicPlansSection } from "@/components/weg-buchhaltung/EconomicPlansSection";
import { SpecialLeviesSection } from "@/components/weg-buchhaltung/SpecialLeviesSection";
import { MatchingRulesSection } from "@/components/weg-buchhaltung/MatchingRulesSection";
import { ReportsSection } from "@/components/weg-buchhaltung/ReportsSection";

export default function PropertyBuchhaltungPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [keys, setKeys] = useState<AllocationKey[]>([]);
  const [costTypes, setCostTypes] = useState<CostType[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [economicPlans, setEconomicPlans] = useState<EconomicPlan[]>([]);
  const [specialLevies, setSpecialLevies] = useState<SpecialLevy[]>([]);
  const [matchingRules, setMatchingRules] = useState<MatchingRule[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [propRes, unitsRes, keysRes, costTypesRes, bankRes, chartRes, txRes, plansRes, leviesRes, rulesRes, ownersRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/properties/${propertyId}/units`),
      fetch(`/api/weg-buchhaltung/allocation-keys?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/cost-types?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/bank-accounts?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/accounts?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/transactions?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/economic-plans?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/special-levies?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/matching-rules?property_id=${propertyId}`),
      fetch(`/api/contacts?role=owner&property_id=${propertyId}`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (unitsRes.ok) setUnits(await unitsRes.json());
    if (keysRes.ok) setKeys(await keysRes.json());
    if (costTypesRes.ok) setCostTypes(await costTypesRes.json());
    if (bankRes.ok) setBankAccounts(await bankRes.json());
    if (chartRes.ok) setChartAccounts(await chartRes.json());
    if (txRes.ok) setTransactions(await txRes.json());
    if (plansRes.ok) setEconomicPlans(await plansRes.json());
    if (leviesRes.ok) setSpecialLevies(await leviesRes.json());
    if (rulesRes.ok) setMatchingRules(await rulesRes.json());
    if (ownersRes.ok) {
      const roles: { contact_id: string; contacts: { first_name: string | null; last_name: string | null; company_name: string | null } }[] = await ownersRes.json();
      const uniqueOwners = new Map<string, Owner>();
      for (const r of roles) {
        uniqueOwners.set(r.contact_id, {
          id: r.contact_id,
          name: r.contacts.company_name ?? [r.contacts.first_name, r.contacts.last_name].filter(Boolean).join(" "),
        });
      }
      setOwners(Array.from(uniqueOwners.values()));
    }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar propertyId={propertyId} propertyName={property?.name ?? "Laden…"} />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <BankAccountsSection
              bankAccounts={bankAccounts}
              onChange={load}
              onError={setError}
            />

            <TransactionsSection
              propertyId={propertyId}
              bankAccounts={bankAccounts}
              chartAccounts={chartAccounts}
              costTypes={costTypes}
              units={units}
              owners={owners}
              transactions={transactions}
              onChange={load}
              onError={setError}
            />

            <AllocationKeysSection
              propertyId={propertyId}
              units={units}
              keys={keys}
              onChange={load}
              onError={setError}
            />

            <CostTypesSection
              propertyId={propertyId}
              keys={keys}
              costTypes={costTypes}
              onChange={load}
              onError={setError}
            />

            <EconomicPlansSection
              propertyId={propertyId}
              units={units}
              plans={economicPlans}
              onChange={load}
              onError={setError}
            />

            <SpecialLeviesSection
              propertyId={propertyId}
              units={units}
              levies={specialLevies}
              onChange={load}
              onError={setError}
            />

            <MatchingRulesSection
              propertyId={propertyId}
              units={units}
              owners={owners}
              costTypes={costTypes}
              rules={matchingRules}
              onChange={load}
              onError={setError}
            />

            <ReportsSection
              propertyId={propertyId}
              chartAccounts={chartAccounts}
              costTypes={costTypes}
              units={units}
              onEntryCreated={load}
              onError={setError}
            />
          </>
        )}
      </div>
    </div>
  );
}
