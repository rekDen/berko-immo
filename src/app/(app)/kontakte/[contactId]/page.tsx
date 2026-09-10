"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Mail, Phone, MapPin, Loader2, Pencil,
  Trash2, Calendar, Building2, FileSignature, Plus,
  ClipboardList, AlertTriangle,
} from "lucide-react";
import { contactDisplayName, type RoleType } from "@/types/crm";
import PersonAvatar from "@/components/crm/PersonAvatar";
import RoleChip from "@/components/crm/RoleChip";
import ContactRoles from "@/components/crm/ContactRoles";
import ContactBankAccounts from "@/components/crm/ContactBankAccounts";
import ContactCommunications from "@/components/crm/ContactCommunications";

type ContactDetail = {
  id: string;
  type: "natural_person" | "legal_entity";
  salutation: string | null;
  academic_title: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  language: string;
  emails: { type: string; value: string }[];
  phones: { type: string; value: string }[];
  addresses: { type: string; street: string; house_number: string; zip_code: string; city: string; country: string }[];
  tax_id: string | null;
  vat_id: string | null;
  notes: string | null;
  created_at: string;
  contact_roles: {
    id: string;
    role: RoleType;
    valid_from: string;
    valid_to: string | null;
    is_primary: boolean;
    property_id: string | null;
    unit_id: string | null;
    properties: { id: string; name: string } | null;
    units: { id: string; unit_number: string } | null;
  }[];
  bank_accounts: {
    id: string;
    iban: string;
    bic: string | null;
    account_holder: string;
    sepa_mandate_status: string | null;
  }[];
};

type Tab = "uebersicht" | "rollen" | "vorgaenge" | "vertraege" | "bank" | "kommunikation";

type ContactTicket = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  priority: string;
  created_at: string;
  properties: { id: string; name: string } | null;
  units: { id: string; unit_number: string } | null;
};

type ContactContract = {
  id: string;
  type: string;
  start_date: string;
  end_date: string | null;
  cold_rent: number | null;
  hausgeld: number | null;
  contact_roles: {
    role: string;
    properties: { id: string; name: string } | null;
    units: { id: string; unit_number: string } | null;
  };
};

const TICKET_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: "Neu", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  in_progress: { label: "In Bearbeitung", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  waiting: { label: "Wartend", cls: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  resolved: { label: "Erledigt", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  closed: { label: "Geschlossen", cls: "bg-gray-100 text-gray-400 dark:bg-gray-800" },
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  rental_residential: "Wohnraummiete",
  rental_commercial: "Gewerbemiete",
  management_weg: "WEG-Verwaltung",
  management_mv: "MV-Verwaltung",
  management_se: "SE-Verwaltung",
};

function maskIban(iban: string): string {
  if (iban.length <= 8) return iban;
  return iban.slice(0, 4) + " **** **** " + iban.slice(-4);
}

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("uebersicht");

  const [tickets, setTickets] = useState<ContactTicket[]>([]);
  const [contracts, setContracts] = useState<ContactContract[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (tab !== "vorgaenge" && tab !== "vertraege") return;
    setTabLoading(true);
    if (tab === "vorgaenge") {
      fetch(`/api/tickets?contact_id=${contactId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => { setTickets(d); setTabLoading(false); });
    } else {
      fetch(`/api/contracts?contact_id=${contactId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => { setContracts(d); setTabLoading(false); });
    }
  }, [tab, contactId]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/contacts/${contactId}`);
    if (res.ok) setContact(await res.json());
    setLoading(false);
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!confirm("Kontakt wirklich löschen?")) return;
    const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
    if (res.ok) router.push("/kontakte");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">Kontakt nicht gefunden</p>
      </div>
    );
  }

  const name = contactDisplayName(contact);
  const primaryAddress = contact.addresses?.[0];
  const activeRoles = contact.contact_roles.filter(
    (r) => !r.valid_to || new Date(r.valid_to) > new Date()
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "uebersicht", label: "Übersicht" },
    { key: "rollen", label: `Rollen (${contact.contact_roles.length})` },
    { key: "vertraege", label: "Verträge" },
    { key: "vorgaenge", label: "Vorgänge" },
    { key: "bank", label: `Bank (${contact.bank_accounts.length})` },
    { key: "kommunikation", label: "Kommunikation" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-4">
            <Link href="/kontakte" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Kontakte
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 dark:text-gray-300">{name}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <PersonAvatar
                firstName={contact.first_name}
                lastName={contact.last_name}
                companyName={contact.company_name}
                size="lg"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {contact.type === "legal_entity" ? "Firma" : "Person"}
                  </span>
                  {activeRoles.map((r) => (
                    <RoleChip key={r.id} role={r.role} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/kontakte/${contactId}/bearbeiten`)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                  dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                title="Bearbeiten"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                  dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Profile card */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            {/* Contact info */}
            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-4">
              {contact.emails.length > 0 && (
                <div className="space-y-2">
                  {contact.emails.map((e, i) => (
                    <a
                      key={i}
                      href={`mailto:${e.value}`}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{e.value}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {e.type === "business" ? "Geschäftl." : e.type === "private" ? "Privat" : "Sonst."}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {contact.phones.length > 0 && (
                <div className="space-y-2">
                  {contact.phones.map((p, i) => (
                    <a
                      key={i}
                      href={`tel:${p.value}`}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                    >
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{p.value}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {p.type === "mobile" ? "Mobil" : p.type === "landline" ? "Festnetz" : "Fax"}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {primaryAddress && (
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p>{primaryAddress.street} {primaryAddress.house_number}</p>
                    <p>{primaryAddress.zip_code} {primaryAddress.city}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-3">
              {contact.date_of_birth && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {new Date(contact.date_of_birth).toLocaleDateString("de-DE")}
                  </span>
                </div>
              )}
              {contact.language && (
                <div className="text-xs text-gray-400">
                  Sprache: {contact.language === "de" ? "Deutsch" : contact.language === "en" ? "Englisch" : "Russisch"}
                </div>
              )}
              {contact.tax_id && (
                <div className="text-xs text-gray-400">
                  Steuer-ID: <span className="text-gray-600 dark:text-gray-300">{contact.tax_id}</span>
                </div>
              )}
              <div className="text-xs text-gray-400">
                Angelegt: {new Date(contact.created_at).toLocaleDateString("de-DE")}
              </div>
            </div>
          </div>

          {/* Right: Tabs */}
          <div className="flex-1 min-w-0">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6">
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

            {/* Tab content */}
            {tab === "uebersicht" && (
              <div className="space-y-4">
                {activeRoles.length > 0 ? (
                  activeRoles.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800">
                        {r.properties ? (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        ) : (
                          <FileSignature className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <RoleChip role={r.role} />
                          {r.properties && (
                            <Link
                              href={`/objekte/${r.properties.id}/dokumente`}
                              className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 truncate"
                            >
                              {r.properties.name}
                            </Link>
                          )}
                          {r.units && (
                            <span className="text-xs text-gray-400">
                              Einheit {r.units.unit_number}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          seit {new Date(r.valid_from).toLocaleDateString("de-DE")}
                          {r.valid_to && ` bis ${new Date(r.valid_to).toLocaleDateString("de-DE")}`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
                    Keine aktiven Rollen
                  </p>
                )}
              </div>
            )}

            {tab === "rollen" && <ContactRoles contactId={contactId} onChange={load} />}

            {tab === "vertraege" && (
              <div>
                <div className="flex justify-end mb-3">
                  <Link
                    href={`/vertraege/neu?contact_id=${contactId}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Neuer Vertrag
                  </Link>
                </div>
                {tabLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                    <FileSignature className="w-10 h-10 mb-2" />
                    <p className="text-sm">Keine Verträge</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Art</th>
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Objekt / Einheit</th>
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Beginn</th>
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contracts.map((c) => {
                          const cr = c.contact_roles;
                          const isActive = !c.end_date || new Date(c.end_date) > new Date();
                          return (
                            <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="px-4 py-2.5">
                                <Link
                                  href={`/vertraege/${c.id}`}
                                  className="font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400"
                                >
                                  {CONTRACT_TYPE_LABELS[c.type] ?? c.type}
                                </Link>
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                {cr?.properties?.name ?? "–"}
                                {cr?.units && ` / ${cr.units.unit_number}`}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                                {new Date(c.start_date).toLocaleDateString("de-DE")}
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
            )}

            {tab === "vorgaenge" && (
              <div>
                <div className="flex justify-end mb-3">
                  <Link
                    href={`/vorgaenge/neu?contact_id=${contactId}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Neuer Vorgang
                  </Link>
                </div>
                {tabLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                    <ClipboardList className="w-10 h-10 mb-2" />
                    <p className="text-sm">Keine Vorgänge</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Titel</th>
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Objekt</th>
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Priorität</th>
                          <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((t) => {
                          const st = TICKET_STATUS_LABELS[t.status] ?? TICKET_STATUS_LABELS.new;
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
                              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                {t.properties?.name ?? "–"}
                                {t.units && ` / ${t.units.unit_number}`}
                              </td>
                              <td className="px-4 py-2.5">
                                {t.priority === "urgent" ? (
                                  <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-3 h-3" /> Dringend
                                  </span>
                                ) : t.priority === "high" ? (
                                  <span className="text-xs text-amber-600 dark:text-amber-400">Hoch</span>
                                ) : t.priority === "low" ? (
                                  <span className="text-xs text-gray-400">Niedrig</span>
                                ) : (
                                  <span className="text-xs text-gray-500">Normal</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                                  {st.label}
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
            )}

            {tab === "bank" && (
              <ContactBankAccounts contactId={contactId} defaultAccountHolder={name} onChange={load} />
            )}

            {tab === "kommunikation" && (
              <ContactCommunications contactId={contactId} />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
