"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PropertyTabBar from "@/components/dms/PropertyTabBar";
import PropertyCommunications from "@/components/dms/PropertyCommunications";

type Property = { id: string; name: string };

export default function PropertyCommunicationsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/properties/${propertyId}`);
    if (res.ok) setProperty(await res.json());
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar
        propertyId={propertyId}
        propertyName={property?.name ?? "Laden…"}
      />
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <PropertyCommunications propertyId={propertyId} />
        )}
      </div>
    </div>
  );
}
