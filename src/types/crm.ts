// ─── Base ──────────────────────────────────────────────────────

type BaseFields = {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

// ─── Contacts ──────────────────────────────────────────────────

export type ContactType = "natural_person" | "legal_entity";
export type Salutation = "herr" | "frau" | "firma" | "eheleute" | "none";
export type Language = "de" | "en" | "ru";

export type EmailEntry = {
  type: "private" | "business" | "other";
  value: string;
};

export type PhoneEntry = {
  type: "mobile" | "landline" | "fax" | "other";
  value: string;
};

export type AddressEntry = {
  type: "residential" | "postal" | "billing";
  street: string;
  house_number: string;
  zip_code: string;
  city: string;
  country: string;
};

export type GwgData = {
  id_type: "personalausweis" | "reisepass" | "other";
  id_number: string;
  valid_until: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

export type GdprConsent = {
  purpose: string;
  granted_at: string;
  revoked_at: string | null;
};

export type Contact = BaseFields & {
  user_id: string | null;
  type: ContactType;
  salutation: Salutation | null;
  academic_title: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  language: Language;
  emails: EmailEntry[];
  phones: PhoneEntry[];
  addresses: AddressEntry[];
  tax_id: string | null;
  vat_id: string | null;
  gwg_data: GwgData | null;
  gdpr_consents: GdprConsent[];
  notes: string | null;
};

export type ContactInsert = Omit<Contact, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  id?: string;
};

// ─── Properties ────────────────────────────────────────────────

export type PropertyType = "weg" | "miethaus" | "sondereigentum" | "gewerbe" | "mixed";

export type Property = BaseFields & {
  name: string;
  street: string | null;
  house_number: string | null;
  zip_code: string | null;
  city: string | null;
  gemarkung: string | null;
  flur: string | null;
  flurstueck: string | null;
  type: PropertyType;
  year_built: number | null;
  total_area: number | null;
  unit_count: number | null;
  notes: string | null;
};

export type PropertyInsert = Omit<Property, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  id?: string;
};

// ─── Units ─────────────────────────────────────────────────────

export type UnitType = "apartment" | "commercial" | "parking" | "storage" | "other";

export type MeterNumber = {
  type: string;
  number: string;
};

export type Unit = BaseFields & {
  property_id: string;
  unit_number: string;
  floor: string | null;
  location_description: string | null;
  type: UnitType;
  area: number | null;
  room_count: number | null;
  mea: number | null;
  land_register_sheet: string | null;
  land_register_number: string | null;
  heating_type: string | null;
  meter_numbers: MeterNumber[];
  notes: string | null;
};

export type UnitInsert = Omit<Unit, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  id?: string;
};

// ─── Contact Roles ─────────────────────────────────────────────

export type RoleType =
  | "owner"
  | "tenant"
  | "subtenant"
  | "beirat"
  | "proxy"
  | "service_provider"
  | "caretaker"
  | "other";

export type ContactRole = BaseFields & {
  contact_id: string;
  property_id: string | null;
  unit_id: string | null;
  contract_id: string | null;
  role: RoleType;
  valid_from: string;
  valid_to: string | null;
  is_primary: boolean;
  metadata: Record<string, unknown>;
};

export type ContactRoleInsert = Omit<ContactRole, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  id?: string;
};

// ─── Contracts ─────────────────────────────────────────────────

export type ContractType =
  | "rental_residential"
  | "rental_commercial"
  | "management_weg"
  | "management_mv"
  | "management_se";

export type Contract = BaseFields & {
  contact_role_id: string;
  type: ContractType;
  start_date: string;
  end_date: string | null;
  notice_period_months: number | null;
  is_fixed_term: boolean;
  indexation: Record<string, unknown> | null;
  graduated_rent: Record<string, unknown> | null;
  cold_rent: number | null;
  operating_costs_prepayment: number | null;
  heating_costs_prepayment: number | null;
  hausgeld: number | null;
  deposit_amount: number | null;
  deposit_type: string | null;
  deposit_custody: string | null;
  notes: string | null;
};

export type ContractInsert = Omit<Contract, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  id?: string;
};

// ─── Bank Accounts ─────────────────────────────────────────────

export type SepaStatus = "active" | "inactive" | "revoked";

export type BankAccount = BaseFields & {
  contact_id: string;
  iban: string;
  bic: string | null;
  account_holder: string;
  sepa_mandate_reference: string | null;
  sepa_mandate_date: string | null;
  sepa_mandate_status: SepaStatus | null;
};

// ─── Tickets ───────────────────────────────────────────────────

export type TicketStatus = "new" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type Ticket = BaseFields & {
  contact_id: string | null;
  unit_id: string | null;
  property_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  resolved_at: string | null;
};

export type TicketInsert = Omit<Ticket, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  id?: string;
};

// ─── Communications ────────────────────────────────────────────

export type CommChannel = "email" | "phone" | "letter" | "meeting" | "portal";
export type CommDirection = "inbound" | "outbound";

export type Communication = BaseFields & {
  contact_id: string;
  ticket_id: string | null;
  channel: CommChannel;
  direction: CommDirection;
  subject: string | null;
  body: string | null;
  attachments: { path: string; name: string; size: number }[];
  occurred_at: string;
};

// ─── Composed / View Types ─────────────────────────────────────

export type ContactWithRoles = Contact & {
  contact_roles: ContactRole[];
};

export type ContactOverview = {
  id: string;
  tenant_id: string;
  type: ContactType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  emails: EmailEntry[];
  phones: PhoneEntry[];
  active_roles: RoleType[] | null;
  property_names: string[] | null;
};

export type PropertyWithUnits = Property & {
  units: Unit[];
};

export type UnitWithRoles = Unit & {
  contact_roles: (ContactRole & {
    contact: Pick<Contact, "id" | "first_name" | "last_name" | "company_name">;
  })[];
};

export type ContractWithDetails = Contract & {
  contact_role: ContactRole & {
    contact: Pick<Contact, "id" | "first_name" | "last_name" | "company_name">;
    unit: Pick<Unit, "id" | "unit_number"> | null;
    property: Pick<Property, "id" | "name"> | null;
  };
};

export type TicketWithContext = Ticket & {
  contact: Pick<Contact, "id" | "first_name" | "last_name" | "company_name"> | null;
  unit: Pick<Unit, "id" | "unit_number"> | null;
  property: Pick<Property, "id" | "name"> | null;
  assignee: Pick<{ id: string; name: string }, "id" | "name"> | null;
};

// ─── Display helpers ───────────────────────────────────────────

export function contactDisplayName(c: Pick<Contact, "type" | "first_name" | "last_name" | "company_name">): string {
  if (c.type === "legal_entity") return c.company_name ?? "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

export function roleLabel(role: RoleType, lang: Language = "de"): string {
  const labels: Record<RoleType, Record<Language, string>> = {
    owner: { de: "Eigentümer", en: "Owner", ru: "Собственник" },
    tenant: { de: "Mieter", en: "Tenant", ru: "Арендатор" },
    subtenant: { de: "Untermieter", en: "Subtenant", ru: "Субарендатор" },
    beirat: { de: "Beirat", en: "Advisory Board", ru: "Консультативный совет" },
    proxy: { de: "Bevollmächtigter", en: "Proxy", ru: "Доверенное лицо" },
    service_provider: { de: "Dienstleister", en: "Service Provider", ru: "Поставщик услуг" },
    caretaker: { de: "Hausmeister", en: "Caretaker", ru: "Управляющий" },
    other: { de: "Sonstige", en: "Other", ru: "Прочее" },
  };
  return labels[role]?.[lang] ?? role;
}
