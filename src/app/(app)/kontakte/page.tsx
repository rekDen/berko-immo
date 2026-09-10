"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Search, Plus, Loader2, Users } from "lucide-react";
import { type RoleType, contactDisplayName } from "@/types/crm";
import PersonAvatar from "@/components/crm/PersonAvatar";
import RoleChip from "@/components/crm/RoleChip";

type ContactRow = {
  id: string;
  type: "natural_person" | "legal_entity";
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  emails: { type: string; value: string }[];
  phones: { type: string; value: string }[];
  language: string;
  created_at: string;
};

type RoleRow = {
  contact_id: string;
  role: RoleType;
  valid_from: string;
  valid_to: string | null;
  property_id: string | null;
  unit_id: string | null;
  contacts: ContactRow;
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Alle Rollen" },
  { value: "owner", label: "Eigentümer" },
  { value: "tenant", label: "Mieter" },
  { value: "beirat", label: "Beirat" },
  { value: "proxy", label: "Bevollmächtigter" },
  { value: "service_provider", label: "Dienstleister" },
  { value: "caretaker", label: "Hausmeister" },
];

export default function ContactListPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLoading(true);
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/contacts?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (roleFilter) {
          const mapped = (data as RoleRow[]).map((r) => ({
            ...r.contacts,
            _roles: [r.role],
          }));
          const unique = new Map<string, ContactRow & { _roles: RoleType[] }>();
          for (const c of mapped) {
            const existing = unique.get(c.id);
            if (existing) {
              existing._roles = [...new Set([...existing._roles, ...c._roles])];
            } else {
              unique.set(c.id, c);
            }
          }
          setContacts([...unique.values()]);
        } else {
          setContacts(data);
        }
      }
      setLoading(false);
    }, search ? 300 : 0);

    return () => clearTimeout(timerRef.current);
  }, [search, roleFilter]);

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto bg-slate-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kontakte</h1>
        <Link
          href="/kontakte/neu"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neuer Kontakt
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Name, E-Mail, Firma suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
              dark:bg-gray-900 dark:border-gray-800 dark:text-white
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-sm rounded-xl border border-gray-200 bg-white px-4 py-2.5
            dark:bg-gray-900 dark:border-gray-800 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <Users className="w-12 h-12 mb-3" />
          <p className="text-sm">
            {search ? `Keine Ergebnisse für "${search}"` : "Noch keine Kontakte angelegt"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 hidden md:table-cell">
                  E-Mail
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 hidden lg:table-cell">
                  Telefon
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 hidden sm:table-cell">
                  Typ
                </th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/kontakte/${c.id}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <PersonAvatar
                        firstName={c.first_name}
                        lastName={c.last_name}
                        companyName={c.company_name}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                          {contactDisplayName(c)}
                        </p>
                        {(c as unknown as { _roles?: RoleType[] })._roles && (
                          <div className="flex gap-1 mt-0.5">
                            {(c as unknown as { _roles: RoleType[] })._roles.map((r) => (
                              <RoleChip key={r} role={r} />
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {c.emails?.[0]?.value ?? "–"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {c.phones?.[0]?.value ?? "–"}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {c.type === "legal_entity" ? "Firma" : "Person"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
