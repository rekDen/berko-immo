"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileSignature, Loader2, Search, SlidersHorizontal, X, Plus,
} from "lucide-react";
import { contactDisplayName } from "@/types/crm";
import Combobox from "@/components/Combobox";

type ContractRow = {
  id: string;
  type: string;
  start_date: string;
  end_date: string | null;
  cold_rent: number | null;
  hausgeld: number | null;
  deposit_type: string | null;
  notes: string | null;
  contact_roles: {
    id: string;
    contact_id: string;
    role: string;
    property_id: string | null;
    unit_id: string | null;
    contacts: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      type: "natural_person" | "legal_entity";
    };
    units: { id: string; unit_number: string } | null;
    properties: { id: string; name: string } | null;
  };
};

type ContactOption = {
  id: string;
  type: "natural_person" | "legal_entity";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};
type PropertyOption = { id: string; name: string };

const TYPE_LABELS: Record<string, string> = {
  rental_residential: "Wohnraummiete",
  rental_commercial: "Gewerbemiete",
  management_weg: "WEG-Verwaltung",
  management_mv: "MV-Verwaltung",
  management_se: "SE-Verwaltung",
};

const TYPE_OPTIONS = [
  { value: "", label: "Alle Typen" },
  { value: "rental_residential", label: "Wohnraummiete" },
  { value: "rental_commercial", label: "Gewerbemiete" },
  { value: "management_weg", label: "WEG-Verwaltung" },
  { value: "management_mv", label: "MV-Verwaltung" },
  { value: "management_se", label: "SE-Verwaltung" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "active", label: "Nur aktive" },
  { value: "ended", label: "Nur beendete" },
];

function formatCurrency(amount: number | null): string {
  if (amount == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

export default function ContractListPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Einfache Suche (Volltext über Typ-Label, Kontakt, Objekt, Einheit, Notizen)
  const [search, setSearch] = useState("");

  // Erweiterte Suche
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [startTo, setStartTo] = useState("");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");

  const [contacts, setContactsList] = useState<ContactOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/contracts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/properties").then((r) => (r.ok ? r.json() : [])),
    ]).then(([co, c, p]) => {
      setContracts(co);
      setContactsList(c);
      setProperties(p);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const today = new Date();
    const fromDate = startFrom ? new Date(startFrom) : null;
    const toDate = startTo ? new Date(startTo + "T23:59:59") : null;
    const minRentNum = minRent ? parseFloat(minRent) : null;
    const maxRentNum = maxRent ? parseFloat(maxRent) : null;
    const q = search.trim().toLowerCase();

    return contracts.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;

      if (statusFilter === "active") {
        if (c.end_date && new Date(c.end_date) <= today) return false;
      } else if (statusFilter === "ended") {
        if (!c.end_date || new Date(c.end_date) > today) return false;
      }

      if (contactFilter && c.contact_roles?.contacts?.id !== contactFilter) return false;
      if (propertyFilter && c.contact_roles?.properties?.id !== propertyFilter) return false;

      const start = new Date(c.start_date);
      if (fromDate && start < fromDate) return false;
      if (toDate && start > toDate) return false;

      const rent = c.cold_rent ?? c.hausgeld;
      if (minRentNum != null && (rent ?? -Infinity) < minRentNum) return false;
      if (maxRentNum != null && (rent ?? Infinity) > maxRentNum) return false;

      if (q) {
        const cr = c.contact_roles;
        const haystack = [
          TYPE_LABELS[c.type] ?? c.type,
          cr?.contacts ? contactDisplayName(cr.contacts) : "",
          cr?.properties?.name,
          cr?.units?.unit_number,
          c.notes,
          c.deposit_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    contracts, search, typeFilter, statusFilter,
    contactFilter, propertyFilter, startFrom, startTo, minRent, maxRent,
  ]);

  const activeAdvancedCount = [
    typeFilter, statusFilter, contactFilter, propertyFilter,
    startFrom, startTo, minRent, maxRent,
  ].filter(Boolean).length;

  function resetAll() {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setContactFilter("");
    setPropertyFilter("");
    setStartFrom("");
    setStartTo("");
    setMinRent("");
    setMaxRent("");
  }

  const inputCls =
    "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto bg-slate-50 dark:bg-gray-950">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verträge</h1>
        <Link
          href="/vertraege/neu"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neuer Vertrag
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
            placeholder="Suche nach Kontakt, Objekt, Einheit, Notiz…"
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

      {advancedOpen && (
        <div className="mb-6 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Vertragstyp</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={inputCls}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
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
                <label className={labelCls}>Beginn von</label>
                <input
                  type="date"
                  value={startFrom}
                  onChange={(e) => setStartFrom(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>bis</label>
                <input
                  type="date"
                  value={startTo}
                  onChange={(e) => setStartTo(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Miete/Hausgeld ab (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={minRent}
                  onChange={(e) => setMinRent(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>bis (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={maxRent}
                  onChange={(e) => setMaxRent(e.target.value)}
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <FileSignature className="w-12 h-12 mb-3" />
          <p className="text-sm">
            {search || activeAdvancedCount > 0 ? "Keine Treffer" : "Keine Verträge gefunden"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Art</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Person</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Objekt / Einheit</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden sm:table-cell">Beginn</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Miete / Hausgeld</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const cr = c.contact_roles;
                const isActive = !c.end_date || new Date(c.end_date) > new Date();
                return (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/vertraege/${c.id}`}
                        className="font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400"
                      >
                        {TYPE_LABELS[c.type] ?? c.type}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {cr?.contacts ? (
                        <Link
                          href={`/kontakte/${cr.contacts.id}`}
                          className="text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400"
                        >
                          {contactDisplayName(cr.contacts)}
                        </Link>
                      ) : "–"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {cr?.properties?.name ?? "–"}
                      {cr?.units && ` / ${cr.units.unit_number}`}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {new Date(c.start_date).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {c.cold_rent != null ? formatCurrency(c.cold_rent) : c.hausgeld != null ? formatCurrency(c.hausgeld) : "–"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                        }`}
                      >
                        {isActive ? "Aktiv" : "Beendet"}
                      </span>
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
