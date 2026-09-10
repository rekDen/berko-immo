"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, MapPin, Calendar, Home, Ruler, Building2, Pencil,
  Plus, Trash2, X, Check,
} from "lucide-react";
import { contactDisplayName, type RoleType } from "@/types/crm";
import PropertyTabBar from "@/components/dms/PropertyTabBar";
import PersonAvatar from "@/components/crm/PersonAvatar";
import Combobox from "@/components/Combobox";

type UnitRow = {
  id: string;
  unit_number: string;
  floor: string | null;
  type: string;
  area: number | null;
  room_count: number | null;
  mea: number | null;
  contact_roles: {
    id: string;
    contact_id: string;
    role: RoleType;
    valid_from: string;
    valid_to: string | null;
    is_primary: boolean;
    contacts: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      type: "natural_person" | "legal_entity";
    };
  }[];
};

type Insurance = {
  type?: string;
  provider?: string;
  policy_number?: string;
  premium?: number;
  expires_at?: string;
};

type PropertyDetail = {
  id: string;
  name: string;
  type: string;
  usage_type: string | null;
  year_built: number | null;
  last_renovation_year: number | null;
  last_renovation_notes: string | null;
  managed_since: string | null;

  street: string | null;
  house_number: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  location_description: string | null;

  total_area: number | null;
  living_area: number | null;
  usable_area: number | null;
  plot_area: number | null;
  unit_count: number | null;
  room_count: number | null;
  bathroom_count: number | null;
  floor: string | null;

  gemarkung: string | null;
  flur: string | null;
  flurstueck: string | null;
  land_register_volume: string | null;
  land_register_sheet: string | null;
  is_weg: boolean | null;

  heating_type: string | null;
  energy_class: string | null;
  has_elevator: boolean | null;
  parking_spaces: number | null;
  has_balcony: boolean | null;
  has_terrace: boolean | null;
  is_furnished: boolean | null;

  rental_status: string | null;
  short_term_rental_allowed: boolean | null;

  monthly_reserve: number | null;
  monthly_operating_costs: number | null;
  monthly_management_costs: number | null;

  insurances: Insurance[];

  building_permit_info: string | null;
  usage_change_info: string | null;
  misuse_status: string | null;
  is_monument: boolean | null;

  notes: string | null;
};

type Tab = "stammdaten" | "einheiten";

const TYPE_LABELS: Record<string, string> = {
  weg: "WEG",
  miethaus: "Miethaus",
  sondereigentum: "Sondereigentum",
  gewerbe: "Gewerbe",
  mixed: "Gemischt",
};

const USAGE_TYPE_LABELS: Record<string, string> = {
  residential: "Wohnen",
  commercial: "Gewerbe",
  mixed: "Mischnutzung",
};

const RENTAL_STATUS_LABELS: Record<string, string> = {
  free: "Frei",
  rented: "Vermietet",
  airbnb: "Airbnb / Kurzzeit",
  mixed: "Gemischt",
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: "Wohnung",
  commercial: "Gewerbe",
  parking: "Stellplatz",
  storage: "Lager",
  other: "Sonstige",
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function formatBool(v: boolean | null | undefined): string {
  if (v == null) return "–";
  return v ? "Ja" : "Nein";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{value ?? "–"}</p>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("stammdaten");

  // Unit edit modal
  type UnitEdit = {
    id: string | null;
    unit_number: string;
    floor: string;
    location_description: string;
    type: string;
    area: string;
    room_count: string;
    mea: string;
    land_register_sheet: string;
    land_register_number: string;
    heating_type: string;
    notes: string;
    tenant_contact_id: string;
    current_tenant_role_id: string | null;
    original_tenant_contact_id: string;
  };
  const emptyUnit: UnitEdit = {
    id: null, unit_number: "", floor: "", location_description: "",
    type: "apartment", area: "", room_count: "", mea: "",
    land_register_sheet: "", land_register_number: "", heating_type: "", notes: "",
    tenant_contact_id: "", current_tenant_role_id: null, original_tenant_contact_id: "",
  };
  const [unitEdit, setUnitEdit] = useState<UnitEdit | null>(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitError, setUnitError] = useState("");

  type ContactOption = {
    id: string;
    type: "natural_person" | "legal_entity";
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setContacts);
  }, []);

  function openNewUnit() {
    setUnitEdit({ ...emptyUnit });
    setUnitError("");
  }

  function openEditUnit(u: UnitRow) {
    const activeTenantRole = u.contact_roles.find(
      (r) => r.role === "tenant" && (!r.valid_to || new Date(r.valid_to) > new Date())
    );
    setUnitEdit({
      id: u.id,
      unit_number: u.unit_number,
      floor: u.floor ?? "",
      location_description: "",
      type: u.type,
      area: u.area?.toString() ?? "",
      room_count: u.room_count?.toString() ?? "",
      mea: u.mea?.toString() ?? "",
      land_register_sheet: "",
      land_register_number: "",
      heating_type: "",
      notes: "",
      tenant_contact_id: activeTenantRole?.contact_id ?? "",
      current_tenant_role_id: activeTenantRole?.id ?? null,
      original_tenant_contact_id: activeTenantRole?.contact_id ?? "",
    });
    // Vollen Datensatz nachladen, damit alle Felder gefüllt sind
    fetch(`/api/units/${u.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((full) => {
        if (full) setUnitEdit((prev) => prev ? {
          ...prev,
          unit_number: full.unit_number ?? "",
          floor: full.floor ?? "",
          location_description: full.location_description ?? "",
          type: full.type ?? "apartment",
          area: full.area?.toString() ?? "",
          room_count: full.room_count?.toString() ?? "",
          mea: full.mea?.toString() ?? "",
          land_register_sheet: full.land_register_sheet ?? "",
          land_register_number: full.land_register_number ?? "",
          heating_type: full.heating_type ?? "",
          notes: full.notes ?? "",
        } : prev);
      });
    setUnitError("");
  }

  async function saveUnit() {
    if (!unitEdit || !unitEdit.unit_number.trim()) {
      setUnitError("Einheitsnummer ist erforderlich");
      return;
    }
    setUnitSaving(true);
    setUnitError("");

    const payload = {
      unit_number: unitEdit.unit_number,
      floor: unitEdit.floor || null,
      location_description: unitEdit.location_description || null,
      type: unitEdit.type,
      area: unitEdit.area ? parseFloat(unitEdit.area) : null,
      room_count: unitEdit.room_count ? parseFloat(unitEdit.room_count) : null,
      mea: unitEdit.mea ? parseFloat(unitEdit.mea) : null,
      land_register_sheet: unitEdit.land_register_sheet || null,
      land_register_number: unitEdit.land_register_number || null,
      heating_type: unitEdit.heating_type || null,
      notes: unitEdit.notes || null,
    };

    const res = unitEdit.id
      ? await fetch(`/api/units/${unitEdit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/properties/${propertyId}/units`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setUnitError(err.error ?? "Fehler beim Speichern");
      setUnitSaving(false);
      return;
    }

    const savedUnit = await res.json();
    const unitId = savedUnit.id;

    // Mieter-Rolle synchronisieren, falls geändert
    const newTenantId = unitEdit.tenant_contact_id || null;
    const oldTenantId = unitEdit.original_tenant_contact_id || null;

    if (newTenantId !== oldTenantId) {
      // Alte Rolle beenden (falls vorhanden)
      if (unitEdit.current_tenant_role_id) {
        await fetch(`/api/contact-roles/${unitEdit.current_tenant_role_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ valid_to: new Date().toISOString().slice(0, 10) }),
        });
      }
      // Neue Rolle anlegen (falls Mieter ausgewählt)
      if (newTenantId) {
        await fetch("/api/contact-roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_id: newTenantId,
            role: "tenant",
            property_id: propertyId,
            unit_id: unitId,
            valid_from: new Date().toISOString().slice(0, 10),
            is_primary: true,
          }),
        });
      }
    }

    setUnitEdit(null);
    await load();
    setUnitSaving(false);
  }

  async function deleteUnit(id: string, unitNumber: string) {
    if (!confirm(`Einheit „${unitNumber}" wirklich löschen?`)) return;
    const res = await fetch(`/api/units/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [propRes, unitsRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/properties/${propertyId}/units`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (unitsRes.ok) setUnits(await unitsRes.json());
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Objekt nicht gefunden</p>
      </div>
    );
  }

  const address = [property.street, property.house_number].filter(Boolean).join(" ");
  const location = [property.zip_code, property.city].filter(Boolean).join(" ");
  const tabs: { key: Tab; label: string }[] = [
    { key: "stammdaten", label: "Stammdaten" },
    { key: "einheiten", label: `Einheiten (${units.length})` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar propertyId={propertyId} propertyName={property.name} />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 flex-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  tab === t.key
                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "stammdaten" && (
            <button
              onClick={() => router.push(`/objekte/${propertyId}/bearbeiten`)}
              className="ml-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                border border-gray-200 text-gray-600 hover:bg-gray-50
                dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </button>
          )}
        </div>

        {tab === "stammdaten" && (
          <div className="space-y-4">
            {/* 1. Identifikation */}
            <Section title="1. Identifikation & Basisdaten">
              <Field label="Objektname" value={property.name} />
              <Field label="Objekttyp" value={TYPE_LABELS[property.type] ?? property.type} />
              <Field label="Nutzungsart" value={property.usage_type ? USAGE_TYPE_LABELS[property.usage_type] : null} />
              <Field label="Baujahr" value={property.year_built} />
              <Field label="Letzte Sanierung" value={property.last_renovation_year} />
              <Field label="Sanierungs-Notiz" value={property.last_renovation_notes} />
              <Field
                label="Verwaltet seit"
                value={property.managed_since ? new Date(property.managed_since).toLocaleDateString("de-DE") : null}
              />
            </Section>

            {/* 2. Adresse */}
            <Section title="2. Adresse">
              <div className="sm:col-span-2">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {address && <p className="font-medium">{address}</p>}
                    {location && <p>{location}</p>}
                    {(property.state || property.country) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {[property.state, property.country].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {property.location_description && (
                <div className="sm:col-span-3">
                  <p className="text-xs text-gray-400">Lagebeschreibung</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{property.location_description}</p>
                </div>
              )}
            </Section>

            {/* 3. Flächen */}
            <Section title="3. Flächen & Größen">
              <Field label="Gesamtfläche" value={property.total_area != null ? `${property.total_area} m²` : null} />
              <Field label="Wohnfläche" value={property.living_area != null ? `${property.living_area} m²` : null} />
              <Field label="Nutzfläche" value={property.usable_area != null ? `${property.usable_area} m²` : null} />
              <Field label="Grundstücksfläche" value={property.plot_area != null ? `${property.plot_area} m²` : null} />
              <Field label="Anzahl Einheiten" value={property.unit_count} />
              <Field label="Anzahl Zimmer" value={property.room_count} />
              <Field label="Anzahl Badezimmer" value={property.bathroom_count} />
              <Field label="Etage" value={property.floor} />
            </Section>

            {/* 4. Eigentumsverhältnisse */}
            <Section title="4. Eigentumsverhältnisse">
              <Field label="WEG?" value={formatBool(property.is_weg)} />
              <Field label="Gemarkung" value={property.gemarkung} />
              <Field label="Flur" value={property.flur} />
              <Field label="Flurstück" value={property.flurstueck} />
              <Field label="Grundbuchband" value={property.land_register_volume} />
              <Field label="Grundbuchblatt" value={property.land_register_sheet} />
            </Section>

            {/* 5. Technik */}
            <Section title="5. Technische Ausstattung">
              <Field label="Heizungsart" value={property.heating_type} />
              <Field label="Energieklasse" value={property.energy_class} />
              <Field label="Stellplätze" value={property.parking_spaces} />
              <Field label="Aufzug" value={formatBool(property.has_elevator)} />
              <Field label="Balkon" value={formatBool(property.has_balcony)} />
              <Field label="Terrasse" value={formatBool(property.has_terrace)} />
              <Field label="Möbliert" value={formatBool(property.is_furnished)} />
            </Section>

            {/* 6. Miete & Nutzung */}
            <Section title="6. Miet- & Nutzungsdaten">
              <Field label="Vermietungsstatus" value={property.rental_status ? RENTAL_STATUS_LABELS[property.rental_status] : null} />
              <Field label="Kurzzeitvermietung" value={formatBool(property.short_term_rental_allowed)} />
            </Section>

            {/* 7. Kosten */}
            <Section title="7. Betriebs- & Kostenstruktur">
              <Field label="Rücklage / Monat" value={formatCurrency(property.monthly_reserve)} />
              <Field label="Betriebskosten / Monat" value={formatCurrency(property.monthly_operating_costs)} />
              <Field label="Verwaltungskosten / Monat" value={formatCurrency(property.monthly_management_costs)} />
            </Section>

            {/* 8. Versicherungen */}
            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">8. Versicherungen</h3>
              {!property.insurances || property.insurances.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Versicherungen hinterlegt</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {property.insurances.map((ins, i) => (
                    <div key={i} className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 space-y-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ins.type ?? "Versicherung"}</p>
                      {ins.provider && <p className="text-xs text-gray-500 dark:text-gray-400">{ins.provider}</p>}
                      <div className="flex gap-3 text-xs text-gray-400">
                        {ins.policy_number && <span>Nr. {ins.policy_number}</span>}
                        {ins.premium != null && <span>{formatCurrency(ins.premium)}/Jahr</span>}
                        {ins.expires_at && <span>läuft {new Date(ins.expires_at).toLocaleDateString("de-DE")}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 9. Recht & Behörden */}
            <Section title="9. Rechtliche & behördliche Daten">
              <Field label="Denkmalschutz" value={formatBool(property.is_monument)} />
              <Field label="Zweckentfremdung" value={property.misuse_status} />
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-gray-400 mb-1">Baugenehmigung</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {property.building_permit_info ?? "–"}
                </p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-gray-400 mb-1">Nutzungsänderung</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {property.usage_change_info ?? "–"}
                </p>
              </div>
            </Section>

            {/* Notizen */}
            {property.notes && (
              <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Notizen</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{property.notes}</p>
              </div>
            )}
          </div>
        )}

        {tab === "einheiten" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={openNewUnit}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Neue Einheit
              </button>
            </div>
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            {units.length === 0 ? (
              <p className="text-sm text-gray-400 py-12 text-center">Keine Einheiten</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Einheit</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden sm:table-cell">Typ</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Fläche</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">MEA</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Eigentümer</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Mieter</th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => {
                    const activeRoles = u.contact_roles.filter(
                      (r) => !r.valid_to || new Date(r.valid_to) > new Date()
                    );
                    const owner = activeRoles.find((r) => r.role === "owner");
                    const tenant = activeRoles.find((r) => r.role === "tenant");

                    return (
                      <tr key={u.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 group">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/objekte/${propertyId}/einheiten/${u.id}`}
                            className="font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400"
                          >
                            {u.unit_number}
                          </Link>
                          {u.floor && <span className="text-xs text-gray-400 ml-2">{u.floor}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          {UNIT_TYPE_LABELS[u.type] ?? u.type}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {u.area != null ? `${u.area} m²` : "–"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {u.mea != null ? `${u.mea}‰` : "–"}
                        </td>
                        <td className="px-4 py-2.5">
                          {owner ? (
                            <Link
                              href={`/kontakte/${owner.contacts.id}`}
                              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400"
                            >
                              <PersonAvatar
                                firstName={owner.contacts.first_name}
                                lastName={owner.contacts.last_name}
                                companyName={owner.contacts.company_name}
                                size="sm"
                              />
                              <span className="truncate">{contactDisplayName(owner.contacts)}</span>
                            </Link>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          {tenant ? (
                            <Link
                              href={`/kontakte/${tenant.contacts.id}`}
                              className="text-sm text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400"
                            >
                              {contactDisplayName(tenant.contacts)}
                            </Link>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditUnit(u)}
                              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                              title="Bearbeiten"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteUnit(u.id, u.unit_number)}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          </div>
        )}

        {/* Einheit Edit Modal */}
        {unitEdit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !unitSaving && setUnitEdit(null)}
          >
            <div
              className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {unitEdit.id ? "Einheit bearbeiten" : "Neue Einheit"}
                </h3>
                <button
                  onClick={() => setUnitEdit(null)}
                  disabled={unitSaving}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Einheitsnr. *</label>
                    <input
                      value={unitEdit.unit_number}
                      onChange={(e) => setUnitEdit({ ...unitEdit, unit_number: e.target.value })}
                      placeholder="z.B. W01, M03, G01"
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Typ</label>
                    <select
                      value={unitEdit.type}
                      onChange={(e) => setUnitEdit({ ...unitEdit, type: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    >
                      <option value="apartment">Wohnung</option>
                      <option value="commercial">Gewerbe</option>
                      <option value="parking">Stellplatz</option>
                      <option value="storage">Lager</option>
                      <option value="other">Sonstige</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Etage</label>
                    <input
                      value={unitEdit.floor}
                      onChange={(e) => setUnitEdit({ ...unitEdit, floor: e.target.value })}
                      placeholder="z.B. 1. OG links"
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Lagebeschreibung</label>
                  <input
                    value={unitEdit.location_description}
                    onChange={(e) => setUnitEdit({ ...unitEdit, location_description: e.target.value })}
                    placeholder="z.B. Hofseite mit Balkon"
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Fläche (m²)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={unitEdit.area}
                      onChange={(e) => setUnitEdit({ ...unitEdit, area: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Zimmer</label>
                    <input
                      type="number"
                      step="0.5"
                      value={unitEdit.room_count}
                      onChange={(e) => setUnitEdit({ ...unitEdit, room_count: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">MEA (‰)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={unitEdit.mea}
                      onChange={(e) => setUnitEdit({ ...unitEdit, mea: e.target.value })}
                      placeholder="z.B. 152.5"
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Heizungsart</label>
                  <input
                    value={unitEdit.heating_type}
                    onChange={(e) => setUnitEdit({ ...unitEdit, heating_type: e.target.value })}
                    placeholder="z.B. Zentralheizung Gas, Fernwärme"
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Grundbuchblatt</label>
                    <input
                      value={unitEdit.land_register_sheet}
                      onChange={(e) => setUnitEdit({ ...unitEdit, land_register_sheet: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Lfd. Nr.</label>
                    <input
                      value={unitEdit.land_register_number}
                      onChange={(e) => setUnitEdit({ ...unitEdit, land_register_number: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Mieter</label>
                  <Combobox
                    value={unitEdit.tenant_contact_id}
                    onChange={(v) => setUnitEdit({ ...unitEdit, tenant_contact_id: v })}
                    options={contacts.map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
                    placeholder="Kontakt suchen…"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Beim Speichern wird die bestehende Mieter-Rolle ggf. beendet und eine neue erstellt.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Notizen</label>
                  <textarea
                    value={unitEdit.notes}
                    onChange={(e) => setUnitEdit({ ...unitEdit, notes: e.target.value })}
                    rows={3}
                    className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>

                {unitError && <p className="text-sm text-red-500">{unitError}</p>}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <button
                  onClick={() => setUnitEdit(null)}
                  disabled={unitSaving}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveUnit}
                  disabled={unitSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {unitSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
