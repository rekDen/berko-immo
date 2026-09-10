"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Users, Mail, Phone, Search } from "lucide-react";
import { contactDisplayName, type RoleType } from "@/types/crm";
import PersonAvatar from "@/components/crm/PersonAvatar";
import RoleChip from "@/components/crm/RoleChip";
import PropertyTabBar from "@/components/dms/PropertyTabBar";

type Property = { id: string; name: string };

type RoleWithContact = {
  id: string;
  contact_id: string;
  role: RoleType;
  valid_from: string;
  valid_to: string | null;
  is_primary: boolean;
  property_id: string | null;
  unit_id: string | null;
  contacts: {
    id: string;
    type: "natural_person" | "legal_entity";
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    emails: { type: string; value: string }[];
    phones: { type: string; value: string }[];
  };
  units: { id: string; unit_number: string; floor: string | null } | null;
};

const ROLE_GROUPS: { key: string; label: string; matcher: (r: string) => boolean }[] = [
  { key: "all", label: "Alle", matcher: () => true },
  { key: "owner", label: "Eigentümer", matcher: (r) => r === "owner" },
  { key: "tenant", label: "Mieter", matcher: (r) => r === "tenant" || r === "subtenant" },
  { key: "beirat", label: "Beirat", matcher: (r) => r === "beirat" },
  { key: "service", label: "Dienstleister", matcher: (r) => r === "service_provider" || r === "caretaker" },
  { key: "other", label: "Sonstige", matcher: (r) => r === "proxy" || r === "other" },
];

export default function PropertyNutzerPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [roles, setRoles] = useState<RoleWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [includeEnded, setIncludeEnded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ property_id: propertyId, limit: "500" });
    if (includeEnded) params.set("include_ended", "true");
    const [propRes, rolesRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/contacts?${params}`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    setLoading(false);
  }, [propertyId, includeEnded]);

  useEffect(() => { load(); }, [load]);

  const groupMatcher = ROLE_GROUPS.find((g) => g.key === filter)?.matcher ?? (() => true);
  const q = search.trim().toLowerCase();

  const filtered = roles.filter((r) => {
    if (!groupMatcher(r.role)) return false;
    if (q) {
      const hay = [
        contactDisplayName(r.contacts),
        r.units?.unit_number,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

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
              placeholder="Nach Name oder Einheit suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
                dark:bg-gray-900 dark:border-gray-800 dark:text-white
                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeEnded}
              onChange={(e) => setIncludeEnded(e.target.checked)}
              className="rounded"
            />
            Beendete Rollen anzeigen
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ROLE_GROUPS.map((g) => {
            const count = g.key === "all"
              ? roles.length
              : roles.filter((r) => g.matcher(r.role)).length;
            return (
              <button
                key={g.key}
                onClick={() => setFilter(g.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filter === g.key
                    ? "bg-orange-500 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                {g.label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Users className="w-12 h-12 mb-3" />
            <p className="text-sm">
              {q || filter !== "all" ? "Keine Treffer" : "Keine Nutzer hinterlegt"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Kontakt</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Rolle</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Einheit</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Zeitraum</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Kontakt</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isActive = !r.valid_to || new Date(r.valid_to) > new Date();
                  const email = r.contacts.emails?.[0]?.value;
                  const phone = r.contacts.phones?.[0]?.value;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/kontakte/${r.contacts.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <PersonAvatar
                            firstName={r.contacts.first_name}
                            lastName={r.contacts.last_name}
                            companyName={r.contacts.company_name}
                            size="sm"
                          />
                          <span className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 truncate">
                            {contactDisplayName(r.contacts)}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <RoleChip role={r.role} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {r.units ? (
                          <Link
                            href={`/objekte/${propertyId}/einheiten/${r.units.id}`}
                            className="hover:text-orange-600 dark:hover:text-orange-400"
                          >
                            {r.units.unit_number}
                            {r.units.floor && <span className="text-gray-400 ml-1">· {r.units.floor}</span>}
                          </Link>
                        ) : "–"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell whitespace-nowrap">
                        seit {new Date(r.valid_from).toLocaleDateString("de-DE")}
                        {r.valid_to && ` – ${new Date(r.valid_to).toLocaleDateString("de-DE")}`}
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {email && (
                            <a href={`mailto:${email}`} className="flex items-center gap-1 hover:text-orange-600 dark:hover:text-orange-400 truncate">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{email}</span>
                            </a>
                          )}
                          {phone && (
                            <a href={`tel:${phone}`} className="flex items-center gap-1 hover:text-orange-600 dark:hover:text-orange-400">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              {phone}
                            </a>
                          )}
                          {!email && !phone && "–"}
                        </div>
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
    </div>
  );
}
