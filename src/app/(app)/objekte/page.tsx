"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Search, Loader2, Plus } from "lucide-react";

type Property = {
  id: string;
  name: string;
  street: string | null;
  house_number: string | null;
  zip_code: string | null;
  city: string | null;
  type: string;
  unit_count: number | null;
  year_built: number | null;
  managed_since: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  weg: "WEG",
  miethaus: "Miethaus",
  sondereigentum: "Sondereigentum",
  gewerbe: "Gewerbe",
  mixed: "Gemischt",
};

export default function ObjektePage() {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Objekte</h1>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Objekt suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
                dark:bg-gray-900 dark:border-gray-800 dark:text-white
                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>
          <Link
            href="/objekte/neu"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap
              bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Objekt
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <Building2 className="w-12 h-12 mb-3" />
          <p className="text-sm">
            {search ? `Keine Ergebnisse für "${search}"` : "Noch keine Objekte angelegt"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden sm:table-cell">Adresse</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Typ</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell text-right">Einheiten</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Baujahr</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Verwaltet seit</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => {
                const address = [p.street, p.house_number].filter(Boolean).join(" ");
                const location = [p.zip_code, p.city].filter(Boolean).join(" ");
                const fullAddress = [address, location].filter(Boolean).join(", ");
                return (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/objekte/${p.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex-shrink-0">
                          <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 truncate">
                          {p.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {fullAddress || "–"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 uppercase whitespace-nowrap">
                        {TYPE_LABELS[p.type] ?? p.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell text-right">
                      {p.unit_count ?? "–"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {p.year_built ?? "–"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {p.managed_since
                        ? new Date(p.managed_since).toLocaleDateString("de-DE")
                        : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
