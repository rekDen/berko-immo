"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Loader2, Home, Ruler, Thermometer,
} from "lucide-react";
import { contactDisplayName, type RoleType } from "@/types/crm";
import PersonAvatar from "@/components/crm/PersonAvatar";
import RoleChip from "@/components/crm/RoleChip";
import { ProfileEditor } from "@/components/mietermatching/ProfileEditor";
import { ApplicantsSection } from "@/components/mietermatching/ApplicantsSection";
import type { Profile, Applicant } from "@/components/mietermatching/shared";

type UnitDetail = {
  id: string;
  property_id: string;
  unit_number: string;
  floor: string | null;
  location_description: string | null;
  type: string;
  area: number | null;
  room_count: number | null;
  mea: number | null;
  land_register_sheet: string | null;
  land_register_number: string | null;
  heating_type: string | null;
  meter_numbers: { type: string; number: string }[];
  notes: string | null;
  properties: {
    id: string;
    name: string;
    street: string | null;
    house_number: string | null;
    zip_code: string | null;
    city: string | null;
  };
  contact_roles: {
    id: string;
    contact_id: string;
    role: RoleType;
    valid_from: string;
    valid_to: string | null;
    is_primary: boolean;
    contacts: {
      id: string;
      type: "natural_person" | "legal_entity";
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      emails: { type: string; value: string }[];
      phones: { type: string; value: string }[];
    };
  }[];
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: "Wohnung",
  commercial: "Gewerbe",
  parking: "Stellplatz",
  storage: "Lager",
  other: "Sonstige",
};

export default function UnitDetailPage() {
  const { propertyId, unitId } = useParams<{ propertyId: string; unitId: string }>();
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [unitRes, profileRes, applicantsRes] = await Promise.all([
      fetch(`/api/units/${unitId}`),
      fetch(`/api/mietermatching/profiles?unit_id=${unitId}`),
      fetch(`/api/mietermatching/applicants?unit_id=${unitId}`),
    ]);
    if (unitRes.ok) setUnit(await unitRes.json());
    if (profileRes.ok) setProfile(await profileRes.json());
    if (applicantsRes.ok) setApplicants(await applicantsRes.json());
    setLoading(false);
  }, [unitId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Einheit nicht gefunden</p>
      </div>
    );
  }

  const activeRoles = unit.contact_roles.filter(
    (r) => !r.valid_to || new Date(r.valid_to) > new Date()
  );
  const pastRoles = unit.contact_roles.filter(
    (r) => r.valid_to && new Date(r.valid_to) <= new Date()
  );

  return (
    <div className="min-h-screen px-6 py-8 max-w-5xl mx-auto bg-slate-50 dark:bg-gray-950">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/objekte" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Objekte
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link
          href={`/objekte/${propertyId}`}
          className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {unit.properties.name}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">Einheit {unit.unit_number}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Einheit {unit.unit_number}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        {unit.properties.name}
        {unit.floor && ` · ${unit.floor}`}
        {unit.location_description && ` · ${unit.location_description}`}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stammdaten */}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Stammdaten</h3>
          <div className="space-y-3">
            <Stat icon={Home} label="Typ" value={UNIT_TYPE_LABELS[unit.type] ?? unit.type} />
            {unit.area != null && <Stat icon={Ruler} label="Wohnfläche" value={`${unit.area} m²`} />}
            {unit.room_count != null && <Stat icon={Home} label="Zimmer" value={String(unit.room_count)} />}
            {unit.mea != null && <Stat icon={Ruler} label="MEA" value={`${unit.mea}‰`} />}
            {unit.heating_type && <Stat icon={Thermometer} label="Heizung" value={unit.heating_type} />}
          </div>
          {(unit.land_register_sheet || unit.land_register_number) && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400">Grundbuch</p>
              {unit.land_register_sheet && (
                <p className="text-sm text-gray-600 dark:text-gray-300">Blatt: {unit.land_register_sheet}</p>
              )}
              {unit.land_register_number && (
                <p className="text-sm text-gray-600 dark:text-gray-300">Nr.: {unit.land_register_number}</p>
              )}
            </div>
          )}
          {unit.meter_numbers.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
              <p className="text-xs text-gray-400">Zähler</p>
              {unit.meter_numbers.map((m, i) => (
                <p key={i} className="text-sm text-gray-600 dark:text-gray-300">
                  {m.type}: <span className="font-mono">{m.number}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Aktuelle Belegung */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">
              Aktuelle Belegung
            </h3>
            {activeRoles.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Keine aktiven Rollen</p>
            ) : (
              <div className="space-y-3">
                {activeRoles.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <PersonAvatar
                      firstName={r.contacts.first_name}
                      lastName={r.contacts.last_name}
                      companyName={r.contacts.company_name}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/kontakte/${r.contacts.id}`}
                          className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400"
                        >
                          {contactDisplayName(r.contacts)}
                        </Link>
                        <RoleChip role={r.role} />
                        {r.is_primary && (
                          <span className="text-[10px] text-gray-400">Hauptperson</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        seit {new Date(r.valid_from).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historie */}
          {pastRoles.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">
                Historie
              </h3>
              <div className="space-y-2">
                {pastRoles
                  .sort((a, b) => new Date(b.valid_to!).getTime() - new Date(a.valid_to!).getTime())
                  .map((r) => (
                    <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg">
                      <PersonAvatar
                        firstName={r.contacts.first_name}
                        lastName={r.contacts.last_name}
                        companyName={r.contacts.company_name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/kontakte/${r.contacts.id}`}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                          >
                            {contactDisplayName(r.contacts)}
                          </Link>
                          <RoleChip role={r.role} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(r.valid_from).toLocaleDateString("de-DE")} – {new Date(r.valid_to!).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KI-Mietermatching */}
      <div className="mt-6 space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <ProfileEditor unitId={unitId} profile={profile} onChange={load} onError={setError} />
        <ApplicantsSection
          propertyId={propertyId} unitId={unitId} profile={profile} applicants={applicants}
          onChange={load} onError={setError}
        />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-400" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{value}</p>
      </div>
    </div>
  );
}
