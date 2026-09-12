"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PropertyTabBar from "@/components/dms/PropertyTabBar";
import { type SettlementListItem } from "@/components/weg-settlement/shared";
import { SettlementsListSection } from "@/components/weg-settlement/SettlementsListSection";
import { SettlementDetail } from "@/components/weg-settlement/SettlementDetail";

type Property = { id: string; name: string };

export default function PropertyAbrechnungPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [settlements, setSettlements] = useState<SettlementListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [propRes, settlementsRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/weg-settlement/settlements?property_id=${propertyId}`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (settlementsRes.ok) {
      const data: SettlementListItem[] = await settlementsRes.json();
      setSettlements(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar propertyId={propertyId} propertyName={property?.name ?? "Laden…"} />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <SettlementsListSection
              propertyId={propertyId}
              settlements={settlements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={load}
              onError={setError}
            />

            {selectedId && (
              <SettlementDetail propertyId={propertyId} settlementId={selectedId} onChange={load} onError={setError} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
