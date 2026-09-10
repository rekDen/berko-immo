"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { contactDisplayName } from "@/types/crm";
import Combobox from "@/components/Combobox";

type ContactOption = {
  id: string;
  type: "natural_person" | "legal_entity";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};
type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; unit_number: string };

const TYPE_OPTIONS = [
  { value: "rental_residential", label: "Wohnraummietvertrag", role: "tenant" },
  { value: "rental_commercial", label: "Gewerbemietvertrag", role: "tenant" },
  { value: "management_weg", label: "WEG-Verwaltungsvertrag", role: "owner" },
  { value: "management_mv", label: "MV-Verwaltungsvertrag", role: "owner" },
  { value: "management_se", label: "SE-Verwaltungsvertrag", role: "owner" },
];

export default function ContractCreatePageWrapper() {
  return (
    <Suspense fallback={null}>
      <ContractCreatePage />
    </Suspense>
  );
}

function ContractCreatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialContactId = params.get("contact_id") ?? "";
  const initialPropertyId = params.get("property_id") ?? "";
  const initialUnitId = params.get("unit_id") ?? "";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Required
  const [type, setType] = useState("rental_residential");
  const [contactId, setContactId] = useState(initialContactId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [unitId, setUnitId] = useState(initialUnitId);
  const [startDate, setStartDate] = useState("");

  // Optional
  const [endDate, setEndDate] = useState("");
  const [isFixedTerm, setIsFixedTerm] = useState(false);
  const [noticePeriod, setNoticePeriod] = useState("");
  const [coldRent, setColdRent] = useState("");
  const [operatingCosts, setOperatingCosts] = useState("");
  const [heatingCosts, setHeatingCosts] = useState("");
  const [hausgeld, setHausgeld] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositType, setDepositType] = useState("");
  const [depositCustody, setDepositCustody] = useState("");
  const [notes, setNotes] = useState("");

  // Optionen
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

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
    if (!propertyId) {
      setUnits([]);
      setUnitId("");
      return;
    }
    fetch(`/api/properties/${propertyId}/units`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UnitOption[]) => {
        setUnits(data);
        setUnitId((current) => (data.some((u) => u.id === current) ? current : ""));
      });
  }, [propertyId]);

  const selectedType = TYPE_OPTIONS.find((t) => t.value === type) ?? TYPE_OPTIONS[0];
  const isRental = type.startsWith("rental_");
  const isManagement = type.startsWith("management_");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        contact_id: contactId,
        property_id: propertyId,
        unit_id: unitId || null,
        role: selectedType.role,
        start_date: startDate,
        end_date: endDate || null,
        is_fixed_term: isFixedTerm,
        notice_period_months: noticePeriod ? parseInt(noticePeriod) : null,
        cold_rent: coldRent ? parseFloat(coldRent) : null,
        operating_costs_prepayment: operatingCosts ? parseFloat(operatingCosts) : null,
        heating_costs_prepayment: heatingCosts ? parseFloat(heatingCosts) : null,
        hausgeld: hausgeld ? parseFloat(hausgeld) : null,
        deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
        deposit_type: depositType || null,
        deposit_custody: depositCustody || null,
        notes: notes || null,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/vertraege/${data.id}`);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error);
      setSaving(false);
    }
  }

  const inputCls =
    "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto bg-slate-50 dark:bg-gray-950">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/vertraege" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Verträge
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">Neuer Vertrag</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Neuer Vertrag</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Vertragstyp + Rolle */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Vertragsart
          </legend>
          <div>
            <label className={labelCls}>Typ *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} required>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Rolle des Vertragspartners: <strong>{selectedType.role === "tenant" ? "Mieter" : "Eigentümer"}</strong>
            </p>
          </div>
        </fieldset>

        {/* Vertragspartner */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Vertragspartner
          </legend>
          <div>
            <label className={labelCls}>
              {selectedType.role === "tenant" ? "Mieter *" : "Eigentümer *"}
            </label>
            <Combobox
              value={contactId}
              onChange={setContactId}
              options={contacts.map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
              placeholder="Kontakt suchen…"
              allowClear={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Objekt *</label>
              <Combobox
                value={propertyId}
                onChange={(v) => { setPropertyId(v); setUnitId(""); }}
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Objekt suchen…"
                allowClear={false}
              />
            </div>
            <div>
              <label className={labelCls}>Einheit{isRental ? " *" : ""}</label>
              <Combobox
                value={unitId}
                onChange={setUnitId}
                options={units.map((u) => ({ value: u.id, label: u.unit_number }))}
                placeholder={propertyId ? "Einheit suchen…" : "zuerst Objekt wählen"}
                disabled={!propertyId}
                allowClear={!isRental}
              />
            </div>
          </div>
        </fieldset>

        {/* Laufzeit */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Laufzeit
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Beginn *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Ende (optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kündigungsfrist (Monate)</label>
              <input
                type="number"
                min="0"
                value={noticePeriod}
                onChange={(e) => setNoticePeriod(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={isFixedTerm}
                  onChange={(e) => setIsFixedTerm(e.target.checked)}
                  className="rounded"
                />
                Befristet
              </label>
            </div>
          </div>
        </fieldset>

        {/* Finanzen */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Finanzen
          </legend>

          {isRental && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Kaltmiete (€)</label>
                  <input type="number" step="0.01" value={coldRent} onChange={(e) => setColdRent(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>NK-Vorauszahlung (€)</label>
                  <input type="number" step="0.01" value={operatingCosts} onChange={(e) => setOperatingCosts(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>HK-Vorauszahlung (€)</label>
                  <input type="number" step="0.01" value={heatingCosts} onChange={(e) => setHeatingCosts(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Kaution (€)</label>
                  <input type="number" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Kautionsart</label>
                  <input
                    type="text"
                    value={depositType}
                    onChange={(e) => setDepositType(e.target.value)}
                    placeholder="z.B. Barkaution"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hinterlegung</label>
                  <input
                    type="text"
                    value={depositCustody}
                    onChange={(e) => setDepositCustody(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}

          {isManagement && (
            <div>
              <label className={labelCls}>Hausgeld (€)</label>
              <input
                type="number"
                step="0.01"
                value={hausgeld}
                onChange={(e) => setHausgeld(e.target.value)}
                className={inputCls}
              />
            </div>
          )}
        </fieldset>

        {/* Notizen */}
        <div>
          <label className={labelCls}>Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anmerkungen zum Vertrag…"
            className={inputCls}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="submit"
            disabled={saving || !contactId || !propertyId || !startDate || (isRental && !unitId)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
              bg-orange-500 text-white hover:bg-orange-600 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Erstellen
          </button>
          <Link
            href="/vertraege"
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
