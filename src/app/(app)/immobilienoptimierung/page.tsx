"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Search, Loader2, ChevronRight, Info } from "lucide-react";

type Property = {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  type: string;
  units: { count: number }[];
};

const TYPE_LABELS: Record<string, string> = {
  weg: "WEG",
  miethaus: "Miethaus",
  sondereigentum: "Sondereigentum",
  gewerbe: "Gewerbe",
  mixed: "Gemischt",
};

export default function ImmobilienoptimierungPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/properties?${params}`);
      if (res.ok) setProperties(await res.json());
      setLoading(false);
    }
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto bg-slate-50 dark:bg-gray-950">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Immobilienoptimierung</h1>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Objekt suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
              dark:bg-gray-900 dark:border-gray-800 dark:text-white
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-3xl">
        Bewerte ein Objekt auf Rendite- und Wertsteigerungspotenzial: Maßnahmen stapeln,
        Wirtschaftlichkeit deterministisch rechnen, rechtliche Zulässigkeit prüfen.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">Keine Objekte gefunden.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/immobilienoptimierung/${p.id}`}
              className="group rounded-2xl p-5 bg-white border border-gray-200 hover:border-indigo-400
                dark:bg-gray-900 dark:border-gray-800 dark:hover:border-indigo-500/60 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                    {TYPE_LABELS[p.type] ?? p.type}
                  </p>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">{p.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-500 truncate">
                    {[p.street, p.city].filter(Boolean).join(", ") || "—"}
                  </p>
                  {(() => {
                    const n = p.units?.[0]?.count ?? 0;
                    return n > 0 ? (
                      <p className="text-xs text-gray-400 mt-2">{n} Einheit{n !== 1 ? "en" : ""}</p>
                    ) : null;
                  })()}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 max-w-3xl">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Steuerliche Hebel (Denkmal-AfA §7i, 3-Objekt-Grenze, Spekulationsfrist) liefern nur
          Größenordnungen und ersetzen keine Steuer- oder Rechtsberatung. Verordnungs-Geltungsdaten
          vor Produktivnahme prüfen.
        </span>
      </div>
    </div>
  );
}
