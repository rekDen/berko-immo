"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Loader2, Calendar, Banknote, FileSignature,
  Building2, Home, Trash2, Pencil, X, Check,
} from "lucide-react";
import { contactDisplayName } from "@/types/crm";
import PersonAvatar from "@/components/crm/PersonAvatar";
import RoleChip from "@/components/crm/RoleChip";
import ContractDocuments from "@/components/dms/ContractDocuments";
import Combobox from "@/components/Combobox";

type ContractDetail = {
  id: string;
  type: string;
  start_date: string;
  end_date: string | null;
  notice_period_months: number | null;
  is_fixed_term: boolean;
  cold_rent: number | null;
  operating_costs_prepayment: number | null;
  heating_costs_prepayment: number | null;
  hausgeld: number | null;
  deposit_amount: number | null;
  deposit_type: string | null;
  deposit_custody: string | null;
  notes: string | null;
  created_at: string;
  contact_roles: {
    id: string;
    contact_id: string;
    role: string;
    property_id: string | null;
    unit_id: string | null;
    valid_from: string;
    valid_to: string | null;
    contacts: {
      id: string;
      type: "natural_person" | "legal_entity";
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      emails: { type: string; value: string }[];
      phones: { type: string; value: string }[];
    };
    units: { id: string; unit_number: string; floor: string | null; area: number | null } | null;
    properties: {
      id: string;
      name: string;
      street: string | null;
      house_number: string | null;
      zip_code: string | null;
      city: string | null;
    } | null;
  };
};

type EditableForm = {
  type: string;
  start_date: string;
  end_date: string;
  notice_period_months: string;
  is_fixed_term: boolean;
  cold_rent: string;
  operating_costs_prepayment: string;
  heating_costs_prepayment: string;
  hausgeld: string;
  deposit_amount: string;
  deposit_type: string;
  deposit_custody: string;
  notes: string;
  contact_id: string;
  property_id: string;
  unit_id: string;
};

type ContactOption = {
  id: string;
  type: "natural_person" | "legal_entity";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};
type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; unit_number: string };

function roleForType(type: string): "tenant" | "owner" {
  return type.startsWith("rental_") ? "tenant" : "owner";
}

const TYPE_LABELS: Record<string, string> = {
  rental_residential: "Wohnraummietvertrag",
  rental_commercial: "Gewerbemietvertrag",
  management_weg: "WEG-Verwaltungsvertrag",
  management_mv: "MV-Verwaltungsvertrag",
  management_se: "SE-Verwaltungsvertrag",
};

function formatCurrency(amount: number | null): string {
  if (amount == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function toForm(c: ContractDetail): EditableForm {
  return {
    type: c.type,
    start_date: c.start_date,
    end_date: c.end_date ?? "",
    notice_period_months: c.notice_period_months?.toString() ?? "",
    is_fixed_term: c.is_fixed_term,
    contact_id: c.contact_roles?.contact_id ?? "",
    property_id: c.contact_roles?.property_id ?? "",
    unit_id: c.contact_roles?.unit_id ?? "",
    cold_rent: c.cold_rent?.toString() ?? "",
    operating_costs_prepayment: c.operating_costs_prepayment?.toString() ?? "",
    heating_costs_prepayment: c.heating_costs_prepayment?.toString() ?? "",
    hausgeld: c.hausgeld?.toString() ?? "",
    deposit_amount: c.deposit_amount?.toString() ?? "",
    deposit_type: c.deposit_type ?? "",
    deposit_custody: c.deposit_custody ?? "",
    notes: c.notes ?? "",
  };
}

export default function ContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditableForm | null>(null);
  const [error, setError] = useState("");

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/contracts/${contractId}`);
    if (res.ok) setContract(await res.json());
    setLoading(false);
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  // Units bei Property-Wechsel im Edit-Form nachladen
  useEffect(() => {
    if (!editing || !form?.property_id) {
      if (editing) setUnits([]);
      return;
    }
    fetch(`/api/properties/${form.property_id}/units`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UnitOption[]) => {
        setUnits(data);
        // Wenn die aktuelle unit_id nicht im neuen Property steckt, zurücksetzen
        setForm((f) => f ? { ...f, unit_id: data.some((u) => u.id === f.unit_id) ? f.unit_id : "" } : f);
      });
  }, [editing, form?.property_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startEdit() {
    if (!contract) return;
    setForm(toForm(contract));
    setError("");
    setEditing(true);
    // Kontakte & Objekte laden
    const [c, p] = await Promise.all([
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/properties").then((r) => (r.ok ? r.json() : [])),
    ]);
    setContacts(c);
    setProperties(p);
  }

  function cancelEdit() {
    setEditing(false);
    setForm(null);
    setError("");
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError("");

    const cr = contract?.contact_roles;
    const partnerChanged =
      form.contact_id !== (cr?.contact_id ?? "") ||
      form.property_id !== (cr?.property_id ?? "") ||
      (form.unit_id || null) !== (cr?.unit_id ?? null);

    const payload: Record<string, unknown> = {
      type: form.type,
      start_date: form.start_date,
      end_date: form.end_date || null,
      notice_period_months: form.notice_period_months ? parseInt(form.notice_period_months) : null,
      is_fixed_term: form.is_fixed_term,
      cold_rent: form.cold_rent ? parseFloat(form.cold_rent) : null,
      operating_costs_prepayment: form.operating_costs_prepayment ? parseFloat(form.operating_costs_prepayment) : null,
      heating_costs_prepayment: form.heating_costs_prepayment ? parseFloat(form.heating_costs_prepayment) : null,
      hausgeld: form.hausgeld ? parseFloat(form.hausgeld) : null,
      deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
      deposit_type: form.deposit_type || null,
      deposit_custody: form.deposit_custody || null,
      notes: form.notes || null,
    };

    if (partnerChanged) {
      if (!form.contact_id || !form.property_id) {
        setError("Vertragspartner und Objekt sind erforderlich");
        setSaving(false);
        return;
      }
      payload.contact_id = form.contact_id;
      payload.property_id = form.property_id;
      payload.unit_id = form.unit_id || null;
      payload.role = roleForType(form.type);
    }

    const res = await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await load();
      setEditing(false);
      setForm(null);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error ?? "Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Vertrag wirklich löschen?")) return;
    const res = await fetch(`/api/contracts/${contractId}`, { method: "DELETE" });
    if (res.ok) router.push("/vertraege");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Vertrag nicht gefunden</p>
      </div>
    );
  }

  const cr = contract.contact_roles;
  const isActive = !contract.end_date || new Date(contract.end_date) > new Date();
  const totalRent =
    (contract.cold_rent ?? 0) +
    (contract.operating_costs_prepayment ?? 0) +
    (contract.heating_costs_prepayment ?? 0);

  const inputCls =
    "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";

  return (
    <div className="min-h-screen px-6 py-8 max-w-5xl mx-auto bg-slate-50 dark:bg-gray-950">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/vertraege" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Verträge
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">
          {TYPE_LABELS[contract.type] ?? contract.type}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {TYPE_LABELS[contract.type] ?? contract.type}
            </h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800"
              }`}
            >
              {isActive ? "Aktiv" : "Beendet"}
            </span>
          </div>
          {cr?.properties && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {cr.properties.name}
              {cr.units && ` · Einheit ${cr.units.unit_number}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={startEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  border border-gray-200 text-gray-600 hover:bg-gray-50
                  dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Bearbeiten
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                  dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  border border-gray-200 text-gray-600 hover:bg-gray-50
                  dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  bg-orange-500 text-white hover:bg-orange-600 transition-colors
                  disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Speichern
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract parties */}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vertragspartner</h3>

          {!editing ? (
            <>
              {cr?.contacts && (
                <Link
                  href={`/kontakte/${cr.contacts.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <PersonAvatar
                    firstName={cr.contacts.first_name}
                    lastName={cr.contacts.last_name}
                    companyName={cr.contacts.company_name}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {contactDisplayName(cr.contacts)}
                    </p>
                    <RoleChip role={cr.role as "owner" | "tenant"} />
                  </div>
                </Link>
              )}

              {cr?.properties && (
                <Link
                  href={`/objekte/${cr.properties.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{cr.properties.name}</p>
                    <p className="text-xs text-gray-400">
                      {[cr.properties.street, cr.properties.house_number].filter(Boolean).join(" ")}
                    </p>
                  </div>
                </Link>
              )}

              {cr?.units && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Home className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Einheit {cr.units.unit_number}
                    </p>
                    {cr.units.area != null && (
                      <p className="text-xs text-gray-400">{cr.units.area} m²</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : form && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {roleForType(form.type) === "tenant" ? "Mieter" : "Eigentümer"}
                </label>
                <Combobox
                  value={form.contact_id}
                  onChange={(v) => setForm({ ...form, contact_id: v })}
                  options={contacts.map((c) => ({ value: c.id, label: contactDisplayName(c) }))}
                  placeholder="Kontakt suchen…"
                  allowClear={false}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Objekt</label>
                <Combobox
                  value={form.property_id}
                  onChange={(v) => setForm({ ...form, property_id: v, unit_id: "" })}
                  options={properties.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Objekt suchen…"
                  allowClear={false}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Einheit</label>
                <Combobox
                  value={form.unit_id}
                  onChange={(v) => setForm({ ...form, unit_id: v })}
                  options={units.map((u) => ({ value: u.id, label: u.unit_number }))}
                  placeholder={form.property_id ? "Einheit suchen…" : "zuerst Objekt wählen"}
                  disabled={!form.property_id}
                />
              </div>
            </>
          )}
        </div>

        {/* Contract terms */}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vertragsdaten</h3>
          {!editing ? (
            <div className="space-y-3">
              <Row icon={FileSignature} label="Typ" value={TYPE_LABELS[contract.type] ?? contract.type} />
              <Row icon={Calendar} label="Beginn" value={new Date(contract.start_date).toLocaleDateString("de-DE")} />
              {contract.end_date && (
                <Row icon={Calendar} label="Ende" value={new Date(contract.end_date).toLocaleDateString("de-DE")} />
              )}
              {contract.notice_period_months != null && (
                <Row icon={Calendar} label="Kündigungsfrist" value={`${contract.notice_period_months} Monate`} />
              )}
              <Row
                icon={FileSignature}
                label="Befristung"
                value={contract.is_fixed_term ? "Befristet" : "Unbefristet"}
              />
            </div>
          ) : form && (
            <div className="space-y-3">
              <Field label="Typ">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                  <option value="rental_residential">Wohnraummietvertrag</option>
                  <option value="rental_commercial">Gewerbemietvertrag</option>
                  <option value="management_weg">WEG-Verwaltungsvertrag</option>
                  <option value="management_mv">MV-Verwaltungsvertrag</option>
                  <option value="management_se">SE-Verwaltungsvertrag</option>
                </select>
              </Field>
              <Field label="Beginn">
                <input type="date" value={form.start_date?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Ende">
                <input type="date" value={form.end_date?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Kündigungsfrist (Monate)">
                <input type="number" min="0" value={form.notice_period_months} onChange={(e) => setForm({ ...form, notice_period_months: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Befristung">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={form.is_fixed_term} onChange={(e) => setForm({ ...form, is_fixed_term: e.target.checked })} className="rounded" />
                  Befristet
                </label>
              </Field>
            </div>
          )}
        </div>

        {/* Financials */}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Finanzen</h3>
          {!editing ? (
            <div className="space-y-3">
              {contract.cold_rent != null && (
                <Row icon={Banknote} label="Kaltmiete" value={formatCurrency(contract.cold_rent)} />
              )}
              {contract.operating_costs_prepayment != null && (
                <Row icon={Banknote} label="NK-Vorauszahlung" value={formatCurrency(contract.operating_costs_prepayment)} />
              )}
              {contract.heating_costs_prepayment != null && (
                <Row icon={Banknote} label="HK-Vorauszahlung" value={formatCurrency(contract.heating_costs_prepayment)} />
              )}
              {contract.hausgeld != null && (
                <Row icon={Banknote} label="Hausgeld" value={formatCurrency(contract.hausgeld)} />
              )}
              {totalRent > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Row icon={Banknote} label="Warmmiete" value={formatCurrency(totalRent)} />
                </div>
              )}
              {contract.deposit_amount != null && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Row icon={Banknote} label="Kaution" value={formatCurrency(contract.deposit_amount)} />
                  {contract.deposit_type && (
                    <p className="text-xs text-gray-400 ml-7">{contract.deposit_type}</p>
                  )}
                </div>
              )}
            </div>
          ) : form && (
            <div className="space-y-3">
              <Field label="Kaltmiete (€)">
                <input type="number" step="0.01" value={form.cold_rent} onChange={(e) => setForm({ ...form, cold_rent: e.target.value })} className={inputCls} />
              </Field>
              <Field label="NK-Vorauszahlung (€)">
                <input type="number" step="0.01" value={form.operating_costs_prepayment} onChange={(e) => setForm({ ...form, operating_costs_prepayment: e.target.value })} className={inputCls} />
              </Field>
              <Field label="HK-Vorauszahlung (€)">
                <input type="number" step="0.01" value={form.heating_costs_prepayment} onChange={(e) => setForm({ ...form, heating_costs_prepayment: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Hausgeld (€)">
                <input type="number" step="0.01" value={form.hausgeld} onChange={(e) => setForm({ ...form, hausgeld: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Kaution (€)">
                <input type="number" step="0.01" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Kautionsart">
                <input type="text" value={form.deposit_type} placeholder="z.B. Barkaution, Bürgschaft, Sparbuch" onChange={(e) => setForm({ ...form, deposit_type: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Hinterlegung">
                <input type="text" value={form.deposit_custody} onChange={(e) => setForm({ ...form, deposit_custody: e.target.value })} className={inputCls} />
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Notizen</h3>
        {!editing ? (
          contract.notes ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{contract.notes}</p>
          ) : (
            <p className="text-sm text-gray-400">Keine Notizen</p>
          )
        ) : form && (
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            className={inputCls}
            placeholder="Notizen zum Vertrag…"
          />
        )}
      </div>

      {/* Dokumente */}
      <div className="mt-6">
        <ContractDocuments contractId={contract.id} />
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{value}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
