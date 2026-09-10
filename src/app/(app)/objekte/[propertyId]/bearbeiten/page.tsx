"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

type Insurance = {
  type?: string;
  provider?: string;
  policy_number?: string;
  premium?: number | null;
  expires_at?: string;
};

type Form = {
  // 1. Identifikation
  name: string;
  type: string;
  usage_type: string;
  year_built: string;
  last_renovation_year: string;
  last_renovation_notes: string;
  managed_since: string;
  // 2. Adresse
  street: string;
  house_number: string;
  zip_code: string;
  city: string;
  state: string;
  country: string;
  location_description: string;
  // 3. Flächen
  total_area: string;
  living_area: string;
  usable_area: string;
  plot_area: string;
  unit_count: string;
  room_count: string;
  bathroom_count: string;
  floor: string;
  // 4. Eigentum
  gemarkung: string;
  flur: string;
  flurstueck: string;
  land_register_volume: string;
  land_register_sheet: string;
  is_weg: boolean;
  // 5. Technik
  heating_type: string;
  energy_class: string;
  has_elevator: boolean;
  parking_spaces: string;
  has_balcony: boolean;
  has_terrace: boolean;
  is_furnished: boolean;
  // 6. Miete
  rental_status: string;
  short_term_rental_allowed: boolean;
  // 7. Kosten
  monthly_reserve: string;
  monthly_operating_costs: string;
  monthly_management_costs: string;
  // 8. Versicherungen
  insurances: Insurance[];
  // 9. Recht
  building_permit_info: string;
  usage_change_info: string;
  misuse_status: string;
  is_monument: boolean;
  // Notizen
  notes: string;
};

const empty: Form = {
  name: "", type: "weg", usage_type: "", year_built: "",
  last_renovation_year: "", last_renovation_notes: "", managed_since: "",
  street: "", house_number: "", zip_code: "", city: "",
  state: "", country: "DE", location_description: "",
  total_area: "", living_area: "", usable_area: "", plot_area: "",
  unit_count: "", room_count: "", bathroom_count: "", floor: "",
  gemarkung: "", flur: "", flurstueck: "",
  land_register_volume: "", land_register_sheet: "", is_weg: false,
  heating_type: "", energy_class: "",
  has_elevator: false, parking_spaces: "",
  has_balcony: false, has_terrace: false, is_furnished: false,
  rental_status: "", short_term_rental_allowed: false,
  monthly_reserve: "", monthly_operating_costs: "", monthly_management_costs: "",
  insurances: [],
  building_permit_info: "", usage_change_info: "", misuse_status: "", is_monument: false,
  notes: "",
};

const inputCls =
  "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

export default function PropertyEditPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form>(empty);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/properties/${propertyId}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const p = await res.json();
      setForm({
        name: p.name ?? "",
        type: p.type ?? "weg",
        usage_type: p.usage_type ?? "",
        year_built: p.year_built?.toString() ?? "",
        last_renovation_year: p.last_renovation_year?.toString() ?? "",
        last_renovation_notes: p.last_renovation_notes ?? "",
        managed_since: p.managed_since ?? "",
        street: p.street ?? "",
        house_number: p.house_number ?? "",
        zip_code: p.zip_code ?? "",
        city: p.city ?? "",
        state: p.state ?? "",
        country: p.country ?? "DE",
        location_description: p.location_description ?? "",
        total_area: p.total_area?.toString() ?? "",
        living_area: p.living_area?.toString() ?? "",
        usable_area: p.usable_area?.toString() ?? "",
        plot_area: p.plot_area?.toString() ?? "",
        unit_count: p.unit_count?.toString() ?? "",
        room_count: p.room_count?.toString() ?? "",
        bathroom_count: p.bathroom_count?.toString() ?? "",
        floor: p.floor ?? "",
        gemarkung: p.gemarkung ?? "",
        flur: p.flur ?? "",
        flurstueck: p.flurstueck ?? "",
        land_register_volume: p.land_register_volume ?? "",
        land_register_sheet: p.land_register_sheet ?? "",
        is_weg: p.is_weg ?? p.type === "weg",
        heating_type: p.heating_type ?? "",
        energy_class: p.energy_class ?? "",
        has_elevator: p.has_elevator ?? false,
        parking_spaces: p.parking_spaces?.toString() ?? "",
        has_balcony: p.has_balcony ?? false,
        has_terrace: p.has_terrace ?? false,
        is_furnished: p.is_furnished ?? false,
        rental_status: p.rental_status ?? "",
        short_term_rental_allowed: p.short_term_rental_allowed ?? false,
        monthly_reserve: p.monthly_reserve?.toString() ?? "",
        monthly_operating_costs: p.monthly_operating_costs?.toString() ?? "",
        monthly_management_costs: p.monthly_management_costs?.toString() ?? "",
        insurances: Array.isArray(p.insurances) ? p.insurances : [],
        building_permit_info: p.building_permit_info ?? "",
        usage_change_info: p.usage_change_info ?? "",
        misuse_status: p.misuse_status ?? "",
        is_monument: p.is_monument ?? false,
        notes: p.notes ?? "",
      });
      setLoading(false);
    }
    load();
  }, [propertyId]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      name: form.name,
      type: form.type,
      usage_type: form.usage_type || null,
      year_built: form.year_built ? parseInt(form.year_built) : null,
      last_renovation_year: form.last_renovation_year ? parseInt(form.last_renovation_year) : null,
      last_renovation_notes: form.last_renovation_notes || null,
      managed_since: form.managed_since || null,
      street: form.street || null,
      house_number: form.house_number || null,
      zip_code: form.zip_code || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || null,
      location_description: form.location_description || null,
      total_area: form.total_area ? parseFloat(form.total_area) : null,
      living_area: form.living_area ? parseFloat(form.living_area) : null,
      usable_area: form.usable_area ? parseFloat(form.usable_area) : null,
      plot_area: form.plot_area ? parseFloat(form.plot_area) : null,
      unit_count: form.unit_count ? parseInt(form.unit_count) : null,
      room_count: form.room_count ? parseFloat(form.room_count) : null,
      bathroom_count: form.bathroom_count ? parseInt(form.bathroom_count) : null,
      floor: form.floor || null,
      gemarkung: form.gemarkung || null,
      flur: form.flur || null,
      flurstueck: form.flurstueck || null,
      land_register_volume: form.land_register_volume || null,
      land_register_sheet: form.land_register_sheet || null,
      is_weg: form.is_weg,
      heating_type: form.heating_type || null,
      energy_class: form.energy_class || null,
      has_elevator: form.has_elevator,
      parking_spaces: form.parking_spaces ? parseInt(form.parking_spaces) : null,
      has_balcony: form.has_balcony,
      has_terrace: form.has_terrace,
      is_furnished: form.is_furnished,
      rental_status: form.rental_status || null,
      short_term_rental_allowed: form.short_term_rental_allowed,
      monthly_reserve: form.monthly_reserve ? parseFloat(form.monthly_reserve) : null,
      monthly_operating_costs: form.monthly_operating_costs ? parseFloat(form.monthly_operating_costs) : null,
      monthly_management_costs: form.monthly_management_costs ? parseFloat(form.monthly_management_costs) : null,
      insurances: form.insurances,
      building_permit_info: form.building_permit_info || null,
      usage_change_info: form.usage_change_info || null,
      misuse_status: form.misuse_status || null,
      is_monument: form.is_monument,
      notes: form.notes || null,
    };

    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/objekte/${propertyId}`);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error);
      setSaving(false);
    }
  }

  function addInsurance() {
    set("insurances", [...form.insurances, { type: "", provider: "", policy_number: "", premium: null, expires_at: "" }]);
  }
  function updateInsurance(i: number, key: keyof Insurance, value: string | number | null) {
    const next = [...form.insurances];
    next[i] = { ...next[i], [key]: value };
    set("insurances", next);
  }
  function removeInsurance(i: number) {
    set("insurances", form.insurances.filter((_, idx) => idx !== i));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-4xl mx-auto bg-slate-50 dark:bg-gray-950">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/objekte" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Objekte
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/objekte/${propertyId}`} className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors truncate">
          {form.name || "Objekt"}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">Bearbeiten</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Objekt bearbeiten</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. Identifikation */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            1. Identifikation & Basisdaten
          </legend>
          <div>
            <label className={labelCls}>Objektname *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Objekttyp</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>
                <option value="weg">WEG</option>
                <option value="miethaus">Miethaus</option>
                <option value="sondereigentum">Sondereigentum</option>
                <option value="gewerbe">Gewerbe</option>
                <option value="mixed">Gemischt</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nutzungsart</label>
              <select value={form.usage_type} onChange={(e) => set("usage_type", e.target.value)} className={inputCls}>
                <option value="">–</option>
                <option value="residential">Wohnen</option>
                <option value="commercial">Gewerbe</option>
                <option value="mixed">Mischnutzung</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Baujahr</label>
              <input type="number" value={form.year_built} onChange={(e) => set("year_built", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Letzte Sanierung (Jahr)</label>
              <input type="number" value={form.last_renovation_year} onChange={(e) => set("last_renovation_year", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notiz zur Sanierung</label>
              <input value={form.last_renovation_notes} onChange={(e) => set("last_renovation_notes", e.target.value)} placeholder="z.B. Dachsanierung 2018, Fenstertausch 2021" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Verwaltet seit</label>
              <input type="date" value={form.managed_since} onChange={(e) => set("managed_since", e.target.value)} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* 2. Adresse */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            2. Adresse
          </legend>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className={labelCls}>Straße</label>
              <input value={form.street} onChange={(e) => set("street", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hausnr.</label>
              <input value={form.house_number} onChange={(e) => set("house_number", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>PLZ</label>
              <input value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Ort</label>
              <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Land</label>
              <input value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Bundesland</label>
              <input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="z.B. Sachsen" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Lagebeschreibung</label>
            <textarea value={form.location_description} onChange={(e) => set("location_description", e.target.value)} rows={2} placeholder="Verkehrsanbindung, Stadtteil, Nachbarschaft…" className={inputCls} />
          </div>
        </fieldset>

        {/* 3. Flächen */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            3. Flächen & Größen
          </legend>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Gesamt (m²)</label>
              <input type="number" step="0.01" value={form.total_area} onChange={(e) => set("total_area", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Wohnfläche</label>
              <input type="number" step="0.01" value={form.living_area} onChange={(e) => set("living_area", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nutzfläche</label>
              <input type="number" step="0.01" value={form.usable_area} onChange={(e) => set("usable_area", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Grundstück</label>
              <input type="number" step="0.01" value={form.plot_area} onChange={(e) => set("plot_area", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Anzahl Einheiten</label>
              <input type="number" value={form.unit_count} onChange={(e) => set("unit_count", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Anzahl Zimmer</label>
              <input type="number" step="0.5" value={form.room_count} onChange={(e) => set("room_count", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Anzahl Bäder</label>
              <input type="number" value={form.bathroom_count} onChange={(e) => set("bathroom_count", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Etage</label>
              <input value={form.floor} onChange={(e) => set("floor", e.target.value)} placeholder="z.B. 3. OG" className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* 4. Eigentum */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            4. Eigentumsverhältnisse
          </legend>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.is_weg} onChange={(e) => set("is_weg", e.target.checked)} className="rounded" />
            Wohnungseigentum (WEG)
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Gemarkung</label>
              <input value={form.gemarkung} onChange={(e) => set("gemarkung", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Flur</label>
              <input value={form.flur} onChange={(e) => set("flur", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Flurstück</label>
              <input value={form.flurstueck} onChange={(e) => set("flurstueck", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Grundbuchband</label>
              <input value={form.land_register_volume} onChange={(e) => set("land_register_volume", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Grundbuchblatt</label>
              <input value={form.land_register_sheet} onChange={(e) => set("land_register_sheet", e.target.value)} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* 5. Technik */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            5. Technische Ausstattung
          </legend>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Heizungsart</label>
              <input value={form.heating_type} onChange={(e) => set("heating_type", e.target.value)} placeholder="z.B. Gas-Zentralheizung" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Energieklasse</label>
              <input value={form.energy_class} onChange={(e) => set("energy_class", e.target.value)} placeholder="z.B. C" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Stellplätze</label>
              <input type="number" value={form.parking_spaces} onChange={(e) => set("parking_spaces", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.has_elevator} onChange={(e) => set("has_elevator", e.target.checked)} className="rounded" />
              Aufzug
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.has_balcony} onChange={(e) => set("has_balcony", e.target.checked)} className="rounded" />
              Balkon
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.has_terrace} onChange={(e) => set("has_terrace", e.target.checked)} className="rounded" />
              Terrasse
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.is_furnished} onChange={(e) => set("is_furnished", e.target.checked)} className="rounded" />
              Möbliert
            </label>
          </div>
        </fieldset>

        {/* 6. Miete */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            6. Miet- & Nutzungsdaten
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vermietungsstatus</label>
              <select value={form.rental_status} onChange={(e) => set("rental_status", e.target.value)} className={inputCls}>
                <option value="">–</option>
                <option value="free">Frei</option>
                <option value="rented">Vermietet</option>
                <option value="airbnb">Airbnb / Kurzzeit</option>
                <option value="mixed">Gemischt</option>
              </select>
            </div>
            <label className="flex items-end gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
              <input type="checkbox" checked={form.short_term_rental_allowed} onChange={(e) => set("short_term_rental_allowed", e.target.checked)} className="rounded" />
              Kurzzeitvermietung erlaubt
            </label>
          </div>
        </fieldset>

        {/* 7. Kosten */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            7. Betriebs- & Kostenstruktur (monatlich, €)
          </legend>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Rücklage</label>
              <input type="number" step="0.01" value={form.monthly_reserve} onChange={(e) => set("monthly_reserve", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Betriebskosten</label>
              <input type="number" step="0.01" value={form.monthly_operating_costs} onChange={(e) => set("monthly_operating_costs", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Verwaltungskosten</label>
              <input type="number" step="0.01" value={form.monthly_management_costs} onChange={(e) => set("monthly_management_costs", e.target.value)} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* 8. Versicherungen */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            8. Versicherungen
          </legend>
          {form.insurances.map((ins, i) => (
            <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Versicherung {i + 1}</p>
                <button type="button" onClick={() => removeInsurance(i)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={ins.type ?? ""}
                  onChange={(e) => updateInsurance(i, "type", e.target.value)}
                  placeholder="Art (z.B. Gebäude, Haftpflicht)"
                  className={inputCls}
                />
                <input
                  value={ins.provider ?? ""}
                  onChange={(e) => updateInsurance(i, "provider", e.target.value)}
                  placeholder="Anbieter"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={ins.policy_number ?? ""}
                  onChange={(e) => updateInsurance(i, "policy_number", e.target.value)}
                  placeholder="Policen-Nr."
                  className={inputCls}
                />
                <input
                  type="number"
                  step="0.01"
                  value={ins.premium ?? ""}
                  onChange={(e) => updateInsurance(i, "premium", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Prämie/Jahr (€)"
                  className={inputCls}
                />
                <input
                  type="date"
                  value={ins.expires_at ?? ""}
                  onChange={(e) => updateInsurance(i, "expires_at", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addInsurance}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400"
          >
            <Plus className="w-3 h-3" /> Weitere Versicherung
          </button>
        </fieldset>

        {/* 9. Recht & Behörden */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            9. Rechtliche & behördliche Daten
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.is_monument} onChange={(e) => set("is_monument", e.target.checked)} className="rounded" />
              Denkmalschutz
            </label>
            <div>
              <label className={labelCls}>Zweckentfremdungsstatus</label>
              <input value={form.misuse_status} onChange={(e) => set("misuse_status", e.target.value)} placeholder="z.B. Genehmigt 2024-09" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Baugenehmigung</label>
            <textarea value={form.building_permit_info} onChange={(e) => set("building_permit_info", e.target.value)} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nutzungsänderung</label>
            <textarea value={form.usage_change_info} onChange={(e) => set("usage_change_info", e.target.value)} rows={2} className={inputCls} />
          </div>
        </fieldset>

        {/* Notizen */}
        <div>
          <label className={labelCls}>Notizen</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
              bg-orange-500 text-white hover:bg-orange-600 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Speichern
          </button>
          <Link
            href={`/objekte/${propertyId}`}
            className="px-6 py-3 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800
              dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
