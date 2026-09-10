"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ClipboardList, AlertTriangle, Plus, Search,
} from "lucide-react";
import { contactDisplayName } from "@/types/crm";
import PropertyTabBar from "@/components/dms/PropertyTabBar";

type Property = { id: string; name: string };

type TicketRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
  contacts: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    type: "natural_person" | "legal_entity";
  } | null;
  units: { id: string; unit_number: string } | null;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: "Neu", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  in_progress: { label: "In Bearbeitung", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  waiting: { label: "Wartend", cls: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  resolved: { label: "Erledigt", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  closed: { label: "Geschlossen", cls: "bg-gray-100 text-gray-400 dark:bg-gray-800" },
};

const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Dringend", cls: "text-red-600 dark:text-red-400" },
  high: { label: "Hoch", cls: "text-amber-600 dark:text-amber-400" },
  normal: { label: "Normal", cls: "text-gray-500" },
  low: { label: "Niedrig", cls: "text-gray-400" },
};

export default function PropertyTicketsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [propRes, ticketsRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/tickets?property_id=${propertyId}`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (ticketsRes.ok) setTickets(await ticketsRes.json());
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? tickets.filter((t) =>
        [t.title, t.description, t.category].some((f) => f?.toLowerCase().includes(q))
      )
    : tickets;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar
        propertyId={propertyId}
        propertyName={property?.name ?? "Laden…"}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Vorgänge durchsuchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
                dark:bg-gray-900 dark:border-gray-800 dark:text-white
                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
          <Link
            href={`/vorgaenge/neu?property_id=${propertyId}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap
              bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neuer Vorgang
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <ClipboardList className="w-12 h-12 mb-3" />
            <p className="text-sm">{q ? "Keine Treffer" : "Keine Vorgänge"}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Titel</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden sm:table-cell">Kontakt</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Einheit</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Priorität</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const st = STATUS_LABELS[t.status] ?? STATUS_LABELS.new;
                  const pr = PRIORITY_LABELS[t.priority] ?? PRIORITY_LABELS.normal;
                  return (
                    <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/vorgaenge/${t.id}`}
                          className="font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400"
                        >
                          {t.title}
                        </Link>
                        {t.category && (
                          <p className="text-xs text-gray-400 mt-0.5">{t.category}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {t.contacts ? contactDisplayName(t.contacts) : "–"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {t.units?.unit_number ?? "–"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${pr.cls}`}>
                          {t.priority === "urgent" && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {pr.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 hidden lg:table-cell">
                        {new Date(t.created_at).toLocaleDateString("de-DE")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
