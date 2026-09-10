"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Loader2, ClipboardList, AlertTriangle,
  Search, SlidersHorizontal, X,
} from "lucide-react";
import { contactDisplayName } from "@/types/crm";
import Combobox from "@/components/Combobox";

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
  properties: { id: string; name: string } | null;
};

type ContactOption = {
  id: string;
  type: "natural_person" | "legal_entity";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};
type PropertyOption = { id: string; name: string };

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

const STATUS_OPTIONS = [
  { value: "", label: "Alle Status" },
  { value: "new", label: "Neu" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "waiting", label: "Wartend" },
  { value: "resolved", label: "Erledigt" },
  { value: "closed", label: "Geschlossen" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Alle Prioritäten" },
  { value: "urgent", label: "Dringend" },
  { value: "high", label: "Hoch" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Niedrig" },
];

export default function TicketListPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Einfache Suche
  const [search, setSearch] = useState("");

  // Erweiterte Suche
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  // Optionen für Comboboxen
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/properties").then((r) => (r.ok ? r.json() : [])),
    ]).then(([c, p]) => {
      setContacts(c);
      setProperties(p);
    });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (contactFilter) params.set("contact_id", contactFilter);
      if (propertyFilter) params.set("property_id", propertyFilter);
      if (createdFrom) params.set("created_from", new Date(createdFrom).toISOString());
      if (createdTo) {
        const end = new Date(createdTo);
        end.setHours(23, 59, 59, 999);
        params.set("created_to", end.toISOString());
      }
      const res = await fetch(`/api/tickets?${params}`);
      if (res.ok) setTickets(await res.json());
      setLoading(false);
    }
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [
    search, statusFilter, priorityFilter, categoryFilter,
    contactFilter, propertyFilter, createdFrom, createdTo,
  ]);

  const activeAdvancedCount = [
    statusFilter, priorityFilter, categoryFilter,
    contactFilter, propertyFilter, createdFrom, createdTo,
  ].filter(Boolean).length;

  function resetAll() {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setCategoryFilter("");
    setContactFilter("");
    setPropertyFilter("");
    setCreatedFrom("");
    setCreatedTo("");
  }

  const inputCls =
    "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto bg-slate-50 dark:bg-gray-950">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vorgänge</h1>
        <Link
          href="/vorgaenge/neu"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neuer Vorgang
        </Link>
      </div>

      {/* Suche */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche in Titel, Beschreibung, Kategorie…"
            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
              dark:bg-gray-900 dark:border-gray-800 dark:text-white
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Suche leeren"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap
            ${advancedOpen
              ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
              : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Erweiterte Suche
          {activeAdvancedCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500 text-white leading-none">
              {activeAdvancedCount}
            </span>
          )}
        </button>
        {(search || activeAdvancedCount > 0) && (
          <button
            onClick={resetAll}
            className="px-3 py-2.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Zurücksetzen
          </button>
        )}
      </div>

      {/* Erweiterte Suche – Panel */}
      {advancedOpen && (
        <div className="mb-6 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={inputCls}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priorität</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className={inputCls}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Kategorie</label>
              <input
                type="text"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="z.B. Schadensmeldung"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Kontakt</label>
              <Combobox
                value={contactFilter}
                onChange={setContactFilter}
                options={contacts.map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
                placeholder="Alle Kontakte"
              />
            </div>
            <div>
              <label className={labelCls}>Objekt</label>
              <Combobox
                value={propertyFilter}
                onChange={setPropertyFilter}
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Alle Objekte"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Erstellt von</label>
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>bis</label>
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <ClipboardList className="w-12 h-12 mb-3" />
          <p className="text-sm">
            {search || activeAdvancedCount > 0 ? "Keine Treffer" : "Keine Vorgänge"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Titel</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden sm:table-cell">Kontakt</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Objekt</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Priorität</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
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
                      {t.properties?.name ?? "–"}
                      {t.units && ` / ${t.units.unit_number}`}
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
  );
}
