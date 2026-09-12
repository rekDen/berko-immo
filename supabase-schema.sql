-- ============================================================
-- Berko AI – Hausverwaltung SaaS
-- Komplettes Datenbankschema (Supabase / Postgres 15+)
-- Multi-Tenant, CRM, DMS, Audit, RLS
-- ============================================================

-- ============================================================
-- 0a. CLEANUP (safe re-run)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user() cascade;
drop function if exists user_has_role_on cascade;
drop function if exists user_can_see_document cascade;
drop function if exists get_visible_categories cascade;
drop function if exists search_documents cascade;
drop function if exists mass_delete_batch cascade;
drop function if exists handover_property cascade;
drop function if exists log_sensitive_access cascade;
drop function if exists log_audit cascade;
drop function if exists current_tenant_id cascade;
drop function if exists is_tenant_admin cascade;
drop function if exists set_updated_at cascade;

drop view if exists v_contact_overview cascade;
drop view if exists v_active_tenants cascade;
drop view if exists v_active_owners cascade;

drop table if exists document_access_log cascade;
drop table if exists document_shares cascade;
drop table if exists document_handovers cascade;
drop table if exists documents cascade;
drop table if exists document_batches cascade;
drop table if exists document_markers cascade;
drop table if exists document_categories cascade;
drop table if exists email_accounts cascade;
drop table if exists chat_messages cascade;
drop table if exists dictations cascade;
drop table if exists deadlines cascade;
drop table if exists emails cascade;
drop table if exists communications cascade;
drop table if exists tickets cascade;
drop table if exists bank_accounts cascade;
drop table if exists contracts cascade;
drop table if exists contact_roles cascade;
drop table if exists units cascade;
drop table if exists properties cascade;
drop table if exists contacts cascade;
drop table if exists audit_log cascade;
drop table if exists profiles cascade;
drop table if exists tenants cascade;

-- ============================================================
-- 0b. EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. FOUNDATION – Tenants, Profiles, Helpers
-- ============================================================

-- Mandanten (Verwaltungsunternehmen)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Benutzerprofile (Verwalter + Sekundaer-User)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  tenant_id uuid references tenants(id),
  role text not null default 'tenant_user'
    check (role in ('tenant_admin', 'tenant_user', 'external')),
  name text not null,
  first_name text,
  last_name text,
  title text,
  initials text,
  firm_name text,
  signature_html text,
  signature_text text,
  language text not null default 'de' check (language in ('de', 'en', 'ru')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    ''
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 2. RLS HELPER FUNCTIONS
-- ============================================================

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function current_tenant_id() returns uuid
language sql stable security definer as $$
  select tenant_id from profiles where id = auth.uid();
$$;

create or replace function is_tenant_admin() returns boolean
language sql stable security definer as $$
  select coalesce(
    (select role in ('tenant_admin', 'tenant_user') from profiles where id = auth.uid()),
    false
  );
$$;

-- user_has_role_on() is defined after contact_roles table (section 7a)

-- ============================================================
-- 3. AUDIT LOG
-- ============================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index idx_audit_log_tenant_entity on audit_log(tenant_id, entity_type, entity_id);
create index idx_audit_log_occurred on audit_log(occurred_at);

create or replace function log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default null
) returns void language plpgsql security definer as $$
begin
  insert into audit_log (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (current_tenant_id(), auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
end;
$$;

create or replace function log_sensitive_access(
  p_field text,
  p_contact_id uuid
) returns void language plpgsql security definer as $$
begin
  perform log_audit(
    'view_sensitive',
    'contact',
    p_contact_id,
    jsonb_build_object('field', p_field)
  );
end;
$$;

-- ============================================================
-- 4. CRM – Contacts
-- ============================================================

create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid references auth.users(id),
  type text not null default 'natural_person'
    check (type in ('natural_person', 'legal_entity')),
  salutation text check (salutation in ('herr', 'frau', 'firma', 'eheleute', 'none')),
  academic_title text,
  first_name text,
  last_name text,
  company_name text,
  date_of_birth date,
  nationality text,
  language text default 'de' check (language in ('de', 'en', 'ru')),
  emails jsonb not null default '[]',
  phones jsonb not null default '[]',
  addresses jsonb not null default '[]',
  tax_id text,
  vat_id text,
  gwg_data jsonb,
  gdpr_consents jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_contacts_tenant on contacts(tenant_id);
create index idx_contacts_tenant_name on contacts(tenant_id, last_name, first_name);
create index idx_contacts_user on contacts(user_id) where user_id is not null;

-- ============================================================
-- 5. CRM – Properties (Liegenschaften)
-- ============================================================

create table properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  street text,
  house_number text,
  zip_code text,
  city text,
  gemarkung text,
  flur text,
  flurstueck text,
  type text not null default 'weg'
    check (type in ('weg', 'miethaus', 'sondereigentum', 'gewerbe', 'mixed')),
  year_built int,
  total_area numeric(10,2),
  unit_count int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_properties_tenant on properties(tenant_id);

-- ============================================================
-- 6. CRM – Units (Einheiten)
-- ============================================================

create table units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  unit_number text not null,
  floor text,
  location_description text,
  type text not null default 'apartment'
    check (type in ('apartment', 'commercial', 'parking', 'storage', 'other')),
  area numeric(10,2),
  room_count numeric(4,1),
  mea numeric(10,4),
  land_register_sheet text,
  land_register_number text,
  heating_type text,
  meter_numbers jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_units_tenant on units(tenant_id);
create index idx_units_property on units(property_id);

-- ============================================================
-- 7. CRM – Contact Roles (n:m Verknuepfung)
-- ============================================================

create table contact_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  contact_id uuid not null references contacts(id),
  property_id uuid references properties(id),
  unit_id uuid references units(id),
  contract_id uuid,
  role text not null
    check (role in ('owner', 'tenant', 'subtenant', 'beirat', 'proxy',
                    'service_provider', 'caretaker', 'other')),
  valid_from date not null default current_date,
  valid_to date,
  is_primary boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_contact_roles_tenant on contact_roles(tenant_id);
create index idx_contact_roles_contact on contact_roles(contact_id);
create index idx_contact_roles_property on contact_roles(property_id);
create index idx_contact_roles_unit on contact_roles(unit_id);

-- ============================================================
-- 7a. RLS HELPER – user_has_role_on (needs contacts, units, contact_roles)
-- ============================================================

create or replace function user_has_role_on(
  p_property_id uuid default null,
  p_unit_id uuid default null,
  p_contract_id uuid default null,
  p_required_roles text[] default null
) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from contact_roles cr
    join contacts c on c.id = cr.contact_id
    where c.user_id = auth.uid()
      and cr.deleted_at is null
      and (cr.valid_to is null or cr.valid_to > now())
      and (p_property_id is null or cr.property_id = p_property_id
           or cr.unit_id in (select id from units where property_id = p_property_id))
      and (p_unit_id is null or cr.unit_id = p_unit_id)
      and (p_contract_id is null or cr.contract_id = p_contract_id)
      and (p_required_roles is null or cr.role = any(p_required_roles))
  );
$$;

-- ============================================================
-- 8. CRM – Contracts (Vertraege)
-- ============================================================

create table contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  contact_role_id uuid not null references contact_roles(id),
  type text not null
    check (type in ('rental_residential', 'rental_commercial',
                    'management_weg', 'management_mv', 'management_se')),
  start_date date not null,
  end_date date,
  notice_period_months int,
  is_fixed_term boolean not null default false,
  indexation jsonb,
  graduated_rent jsonb,
  cold_rent numeric(10,2),
  operating_costs_prepayment numeric(10,2),
  heating_costs_prepayment numeric(10,2),
  hausgeld numeric(10,2),
  deposit_amount numeric(10,2),
  deposit_type text,
  deposit_custody text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

-- Rueckverknuepfung: contact_roles.contract_id -> contracts.id
alter table contact_roles
  add constraint fk_contact_roles_contract
  foreign key (contract_id) references contracts(id);

create index idx_contracts_tenant on contracts(tenant_id);
create index idx_contracts_contact_role on contracts(contact_role_id);

-- ============================================================
-- 9. CRM – Bank Accounts
-- ============================================================

create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  contact_id uuid not null references contacts(id),
  iban text not null,
  bic text,
  account_holder text not null,
  sepa_mandate_reference text,
  sepa_mandate_date date,
  sepa_mandate_status text check (sepa_mandate_status in ('active', 'inactive', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_bank_accounts_tenant on bank_accounts(tenant_id);
create index idx_bank_accounts_contact on bank_accounts(contact_id);

-- ============================================================
-- 10. CRM – Tickets (Anliegen / Schadensmeldungen)
-- ============================================================

create table tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  contact_id uuid references contacts(id),
  unit_id uuid references units(id),
  property_id uuid references properties(id),
  title text not null,
  description text,
  category text,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_tickets_tenant on tickets(tenant_id);
create index idx_tickets_tenant_status on tickets(tenant_id, status);

-- ============================================================
-- 11. CRM – Communications (Kommunikationshistorie)
-- ============================================================

create table communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  contact_id uuid references contacts(id),
  ticket_id uuid references tickets(id),
  channel text not null
    check (channel in ('email', 'phone', 'letter', 'meeting', 'online_meeting', 'portal', 'note')),
  direction text not null
    check (direction in ('inbound', 'outbound')),
  subject text,
  body text,
  attachments jsonb not null default '[]',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_communications_tenant on communications(tenant_id);
create index idx_communications_contact on communications(contact_id);
create index idx_communications_ticket on communications(ticket_id) where ticket_id is not null;

-- ============================================================
-- 12. CRM – Views
-- ============================================================

create or replace view v_active_owners as
select
  cr.id as role_id,
  cr.tenant_id,
  cr.contact_id,
  cr.unit_id,
  cr.property_id,
  c.first_name,
  c.last_name,
  c.company_name,
  u.unit_number,
  cr.valid_from,
  cr.valid_to,
  cr.is_primary,
  cr.metadata
from contact_roles cr
join contacts c on c.id = cr.contact_id
left join units u on u.id = cr.unit_id
where cr.role = 'owner'
  and cr.deleted_at is null
  and c.deleted_at is null
  and (cr.valid_to is null or cr.valid_to > current_date);

create or replace view v_active_tenants as
select
  cr.id as role_id,
  cr.tenant_id,
  cr.contact_id,
  cr.unit_id,
  cr.property_id,
  c.first_name,
  c.last_name,
  c.company_name,
  u.unit_number,
  cr.valid_from,
  cr.valid_to,
  cr.is_primary,
  cr.metadata
from contact_roles cr
join contacts c on c.id = cr.contact_id
left join units u on u.id = cr.unit_id
where cr.role = 'tenant'
  and cr.deleted_at is null
  and c.deleted_at is null
  and (cr.valid_to is null or cr.valid_to > current_date);

create or replace view v_contact_overview as
select
  c.id,
  c.tenant_id,
  c.type,
  c.first_name,
  c.last_name,
  c.company_name,
  c.emails,
  c.phones,
  array_agg(distinct cr.role) filter (where cr.role is not null) as active_roles,
  array_agg(distinct p.name) filter (where p.name is not null) as property_names
from contacts c
left join contact_roles cr on cr.contact_id = c.id
  and cr.deleted_at is null
  and (cr.valid_to is null or cr.valid_to > current_date)
left join properties p on p.id = cr.property_id and p.deleted_at is null
where c.deleted_at is null
group by c.id;

-- ============================================================
-- 13. DMS – Document Categories (System-Taxonomie, read-only)
-- ============================================================

create table document_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references document_categories(id),
  code text not null unique,
  group_code text not null,
  name_de text not null,
  name_en text not null,
  name_ru text not null,
  level text not null check (level in ('property', 'unit', 'contract')),
  allowed_roles text[] not null default '{}',
  supports_fiscal_year boolean not null default false,
  search_synonyms text[] not null default '{}',
  sort_order int not null default 0
);

create index idx_document_categories_parent on document_categories(parent_id);
create index idx_document_categories_group on document_categories(group_code);
create index idx_document_categories_synonyms on document_categories using gin(search_synonyms);

-- ============================================================
-- 14. DMS – Document Markers (mandantenspezifisch)
-- ============================================================

create table document_markers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  category_id uuid not null references document_categories(id),
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_document_markers_tenant_cat on document_markers(tenant_id, category_id);

-- ============================================================
-- 15. DMS – Document Batches (Sendungen / Massenupload)
-- ============================================================

create table document_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  description text,
  batch_type text not null
    check (batch_type in ('mass_upload', 'mailing', 'handover')),
  target_category_id uuid references document_categories(id),
  target_level text check (target_level in ('property', 'unit', 'contract')),
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'completed', 'partially_failed')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_document_batches_tenant on document_batches(tenant_id);

-- ============================================================
-- 16. DMS – Documents
-- ============================================================

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  category_id uuid not null references document_categories(id),
  level text not null check (level in ('property', 'unit', 'contract')),
  property_id uuid references properties(id),
  unit_id uuid references units(id),
  contract_id uuid references contracts(id),
  title text not null,
  description text,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  file_hash text,
  fiscal_year int,
  markers uuid[] not null default '{}',
  visibility_override jsonb,
  internal_only boolean not null default false,
  batch_id uuid references document_batches(id),
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create index idx_documents_tenant_property_cat on documents(tenant_id, property_id, category_id);
create index idx_documents_tenant_contract on documents(tenant_id, contract_id);
create index idx_documents_tenant_unit on documents(tenant_id, unit_id);
create index idx_documents_batch on documents(batch_id) where batch_id is not null;
create index idx_documents_hash on documents(file_hash) where file_hash is not null;

-- ============================================================
-- 17. DMS – Document Access Log
-- ============================================================

create table document_access_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id),
  user_id uuid references auth.users(id),
  contact_id uuid references contacts(id),
  action text not null check (action in ('view', 'download', 'preview')),
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index idx_doc_access_log_document on document_access_log(document_id);

-- ============================================================
-- 18. DMS – Document Handovers (Verwalteruebergabe)
-- ============================================================

create table document_handovers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  from_tenant_id uuid not null references tenants(id),
  to_tenant_id uuid not null references tenants(id),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'completed', 'cancelled')),
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  completed_at timestamptz,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_document_handovers_property on document_handovers(property_id);

-- ============================================================
-- 19. DMS – Document Shares (zeitlich befristete Links)
-- ============================================================

create table document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id),
  token text not null unique,
  expires_at timestamptz not null,
  password_hash text,
  access_count int not null default 0,
  max_access int,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_document_shares_token on document_shares(token);

-- ============================================================
-- 20. APP – Emails (Posteingang)
-- ============================================================

create table emails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  from_address text not null,
  from_name text not null,
  subject text not null,
  body text not null,
  date timestamptz not null default now(),
  category text check (category in ('gericht', 'mandant', 'gegner', 'intern', 'newsletter')),
  read boolean not null default false,
  starred boolean not null default false,
  ai_summary text default '',
  ai_draft text default '',
  ai_legal text default '',
  ai_categorized boolean not null default false,
  imap_uid bigint,
  message_id text,
  folder text not null default 'inbox'
    check (folder in ('inbox', 'sent', 'draft')),
  to_address text,
  cc text,
  bcc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_emails_tenant on emails(tenant_id);
create index idx_emails_tenant_folder on emails(tenant_id, folder);
create index idx_emails_category on emails(tenant_id, category);
create unique index idx_emails_imap_uid on emails(tenant_id, imap_uid) where imap_uid is not null;
create index idx_emails_message_id on emails(tenant_id, message_id) where message_id is not null;

-- ============================================================
-- 21. APP – Deadlines (Fristen & Termine)
-- ============================================================

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  az text not null,
  date date not null,
  title text not null,
  description text default '',
  type text not null check (type in ('frist', 'termin')),
  completed boolean not null default false,
  assigned_to text default '',
  location text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_deadlines_tenant on deadlines(tenant_id);
create index idx_deadlines_tenant_date on deadlines(tenant_id, date);

-- ============================================================
-- 22. APP – Dictations (Diktate)
-- ============================================================

create table dictations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  title text default '',
  raw_transcription text not null,
  formatted_text text not null,
  duration_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_dictations_tenant on dictations(tenant_id);

-- ============================================================
-- 23. APP – Chat Messages (Immo-KI)
-- ============================================================

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index idx_chat_messages_tenant on chat_messages(tenant_id);

-- ============================================================
-- 24. APP – Email Accounts (IMAP-Zugangsdaten)
-- ============================================================

create table email_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references profiles(id) unique,
  email text not null,
  imap_host text not null default 'imap.ionos.de',
  imap_port int not null default 993,
  imap_user text not null,
  imap_password text not null,
  deleted_uids jsonb not null default '[]',
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_email_accounts_tenant on email_accounts(tenant_id);

-- ============================================================
-- 25. TRIGGERS – set_updated_at on all tables
-- ============================================================

create trigger trg_tenants_updated_at before update on tenants for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger trg_contacts_updated_at before update on contacts for each row execute function set_updated_at();
create trigger trg_properties_updated_at before update on properties for each row execute function set_updated_at();
create trigger trg_units_updated_at before update on units for each row execute function set_updated_at();
create trigger trg_contact_roles_updated_at before update on contact_roles for each row execute function set_updated_at();
create trigger trg_contracts_updated_at before update on contracts for each row execute function set_updated_at();
create trigger trg_bank_accounts_updated_at before update on bank_accounts for each row execute function set_updated_at();
create trigger trg_tickets_updated_at before update on tickets for each row execute function set_updated_at();
create trigger trg_communications_updated_at before update on communications for each row execute function set_updated_at();
create trigger trg_documents_updated_at before update on documents for each row execute function set_updated_at();
create trigger trg_document_handovers_updated_at before update on document_handovers for each row execute function set_updated_at();
create trigger trg_emails_updated_at before update on emails for each row execute function set_updated_at();
create trigger trg_deadlines_updated_at before update on deadlines for each row execute function set_updated_at();
create trigger trg_dictations_updated_at before update on dictations for each row execute function set_updated_at();
create trigger trg_chat_messages_updated_at before update on chat_messages for each row execute function set_updated_at();
create trigger trg_email_accounts_updated_at before update on email_accounts for each row execute function set_updated_at();

-- ============================================================
-- 26. RLS POLICIES
-- ============================================================

-- -- -- TENANTS -- -- --
alter table tenants enable row level security;

create policy "tenants_select" on tenants
  for select using (id = current_tenant_id());

-- -- -- PROFILES -- -- --
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

create policy "profiles_select_tenant" on profiles
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- -- -- CONTACTS -- -- --
alter table contacts enable row level security;

create policy "contacts_select_tenant" on contacts
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "contacts_insert_tenant" on contacts
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "contacts_update_tenant" on contacts
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- PROPERTIES -- -- --
alter table properties enable row level security;

create policy "properties_select_tenant" on properties
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "properties_select_external" on properties
  for select using (user_has_role_on(p_property_id := id) and deleted_at is null);

create policy "properties_insert_tenant" on properties
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "properties_update_tenant" on properties
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- UNITS -- -- --
alter table units enable row level security;

create policy "units_select_tenant" on units
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "units_select_external" on units
  for select using (user_has_role_on(p_unit_id := id) and deleted_at is null);

create policy "units_insert_tenant" on units
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "units_update_tenant" on units
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- CONTACT_ROLES -- -- --
alter table contact_roles enable row level security;

create policy "contact_roles_select_tenant" on contact_roles
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "contact_roles_insert_tenant" on contact_roles
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "contact_roles_update_tenant" on contact_roles
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- CONTRACTS -- -- --
alter table contracts enable row level security;

create policy "contracts_select_tenant" on contracts
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "contracts_insert_tenant" on contracts
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "contracts_update_tenant" on contracts
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- BANK_ACCOUNTS -- -- --
alter table bank_accounts enable row level security;

create policy "bank_accounts_select_tenant" on bank_accounts
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "bank_accounts_insert_tenant" on bank_accounts
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "bank_accounts_update_tenant" on bank_accounts
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- TICKETS -- -- --
alter table tickets enable row level security;

create policy "tickets_select_tenant" on tickets
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "tickets_insert_tenant" on tickets
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "tickets_update_tenant" on tickets
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- COMMUNICATIONS -- -- --
alter table communications enable row level security;

create policy "communications_select_tenant" on communications
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "communications_insert_tenant" on communications
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "communications_update_tenant" on communications
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "communications_delete_tenant" on communications
  for delete using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- DOCUMENT_CATEGORIES (read-only, jeder sieht) -- -- --
alter table document_categories enable row level security;

create policy "document_categories_select_all" on document_categories
  for select using (true);

-- -- -- DOCUMENT_MARKERS -- -- --
alter table document_markers enable row level security;

create policy "document_markers_select_tenant" on document_markers
  for select using (tenant_id = current_tenant_id());

create policy "document_markers_insert_tenant" on document_markers
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- DOCUMENT_BATCHES -- -- --
alter table document_batches enable row level security;

create policy "document_batches_select_tenant" on document_batches
  for select using (tenant_id = current_tenant_id());

create policy "document_batches_insert_tenant" on document_batches
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- DOCUMENTS -- -- --
alter table documents enable row level security;

create policy "documents_select_tenant" on documents
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "documents_select_external" on documents
  for select using (
    deleted_at is null
    and internal_only = false
    and (
      (level = 'property' and user_has_role_on(p_property_id := property_id))
      or (level = 'unit' and user_has_role_on(p_unit_id := unit_id))
      or (level = 'contract' and user_has_role_on(p_contract_id := contract_id))
    )
  );

create policy "documents_insert_tenant" on documents
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "documents_update_tenant" on documents
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- DOCUMENT_HANDOVERS -- -- --
alter table document_handovers enable row level security;

create policy "document_handovers_select" on document_handovers
  for select using (
    from_tenant_id = current_tenant_id() or to_tenant_id = current_tenant_id()
  );

-- -- -- DOCUMENT_SHARES -- -- --
alter table document_shares enable row level security;

create policy "document_shares_select_tenant" on document_shares
  for select using (
    exists (
      select 1 from documents d
      where d.id = document_shares.document_id
        and d.tenant_id = current_tenant_id()
    )
  );

-- -- -- EMAILS -- -- --
alter table emails enable row level security;

create policy "emails_select_tenant" on emails
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "emails_insert_tenant" on emails
  for insert with check (tenant_id = current_tenant_id());

create policy "emails_update_tenant" on emails
  for update using (tenant_id = current_tenant_id());

-- -- -- DEADLINES -- -- --
alter table deadlines enable row level security;

create policy "deadlines_select_tenant" on deadlines
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "deadlines_insert_tenant" on deadlines
  for insert with check (tenant_id = current_tenant_id());

create policy "deadlines_update_tenant" on deadlines
  for update using (tenant_id = current_tenant_id());

-- -- -- DICTATIONS -- -- --
alter table dictations enable row level security;

create policy "dictations_select_tenant" on dictations
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "dictations_insert_tenant" on dictations
  for insert with check (tenant_id = current_tenant_id());

-- -- -- CHAT_MESSAGES -- -- --
alter table chat_messages enable row level security;

create policy "chat_messages_select_tenant" on chat_messages
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "chat_messages_insert_tenant" on chat_messages
  for insert with check (tenant_id = current_tenant_id());

-- -- -- EMAIL_ACCOUNTS -- -- --
alter table email_accounts enable row level security;

create policy "email_accounts_select_own" on email_accounts
  for select using (user_id = auth.uid() and deleted_at is null);

create policy "email_accounts_insert_own" on email_accounts
  for insert with check (user_id = auth.uid() and tenant_id = current_tenant_id());

create policy "email_accounts_update_own" on email_accounts
  for update using (user_id = auth.uid());

-- -- -- AUDIT_LOG (insert-only, admins can read) -- -- --
alter table audit_log enable row level security;

create policy "audit_log_select_tenant" on audit_log
  for select using (tenant_id = current_tenant_id() and is_tenant_admin());

-- ============================================================
-- 27. DMS – Helper RPC: user_can_see_document
-- ============================================================

create or replace function user_can_see_document(doc_id uuid)
returns boolean language plpgsql stable security definer as $$
declare
  v_doc documents%rowtype;
  v_cat document_categories%rowtype;
begin
  select * into v_doc from documents where id = doc_id and deleted_at is null;
  if not found then return false; end if;

  if v_doc.tenant_id = current_tenant_id() and is_tenant_admin() then
    return true;
  end if;

  if v_doc.internal_only then return false; end if;

  select * into v_cat from document_categories where id = v_doc.category_id;

  if v_doc.level = 'property' then
    return user_has_role_on(p_property_id := v_doc.property_id, p_required_roles := v_cat.allowed_roles);
  elsif v_doc.level = 'unit' then
    return user_has_role_on(p_unit_id := v_doc.unit_id, p_required_roles := v_cat.allowed_roles);
  elsif v_doc.level = 'contract' then
    return user_has_role_on(p_contract_id := v_doc.contract_id, p_required_roles := v_cat.allowed_roles);
  end if;

  return false;
end;
$$;

-- ============================================================
-- 28. DMS – RPC: get_visible_categories
-- ============================================================

create or replace function get_visible_categories(p_property_id uuid)
returns table (
  category_id uuid,
  code text,
  group_code text,
  name_de text,
  name_en text,
  name_ru text,
  level text,
  doc_count bigint
) language plpgsql stable security definer as $$
begin
  return query
  select
    dc.id as category_id,
    dc.code,
    dc.group_code,
    dc.name_de,
    dc.name_en,
    dc.name_ru,
    dc.level,
    count(d.id) as doc_count
  from document_categories dc
  left join documents d on d.category_id = dc.id
    and d.deleted_at is null
    and d.property_id = p_property_id
  where dc.parent_id is not null
  group by dc.id
  order by dc.sort_order;
end;
$$;

-- ============================================================
-- 29. DMS – RPC: search_documents
-- ============================================================

create or replace function search_documents(
  p_query text,
  p_property_id uuid default null,
  p_limit int default 50
)
returns setof documents language plpgsql stable security definer as $$
begin
  return query
  select d.*
  from documents d
  join document_categories dc on dc.id = d.category_id
  where d.deleted_at is null
    and d.tenant_id = current_tenant_id()
    and (p_property_id is null or d.property_id = p_property_id)
    and (
      d.title ilike '%' || p_query || '%'
      or d.description ilike '%' || p_query || '%'
      or p_query = any(dc.search_synonyms)
    )
  order by d.uploaded_at desc
  limit p_limit;
end;
$$;

-- ============================================================
-- 30. DMS – RPC: mass_delete_batch
-- ============================================================

create or replace function mass_delete_batch(p_batch_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_batch document_batches%rowtype;
  v_count int;
begin
  select * into v_batch from document_batches
  where id = p_batch_id and tenant_id = current_tenant_id();

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  update documents
  set deleted_at = now(), deleted_by = auth.uid()
  where batch_id = p_batch_id and deleted_at is null;

  get diagnostics v_count = row_count;

  update document_batches
  set status = 'draft'
  where id = p_batch_id;

  perform log_audit('delete', 'document_batch', p_batch_id,
    jsonb_build_object('deleted_documents', v_count));

  return jsonb_build_object('deleted_documents', v_count);
end;
$$;

-- ============================================================
-- 31. DMS – RPC: handover_property
-- ============================================================

create or replace function handover_property(
  p_property_id uuid,
  p_to_tenant_id uuid
) returns uuid language plpgsql security definer as $$
declare
  v_handover_id uuid;
  v_doc_count int;
  v_unit_count int;
begin
  if current_tenant_id() is null or not is_tenant_admin() then
    raise exception 'PERMISSION_DENIED';
  end if;

  select count(*) into v_doc_count from documents
  where property_id = p_property_id
    and tenant_id = current_tenant_id()
    and deleted_at is null;

  select count(*) into v_unit_count from units
  where property_id = p_property_id
    and tenant_id = current_tenant_id()
    and deleted_at is null;

  insert into document_handovers (
    property_id, from_tenant_id, to_tenant_id,
    status, requested_by,
    snapshot
  ) values (
    p_property_id, current_tenant_id(), p_to_tenant_id,
    'requested', auth.uid(),
    jsonb_build_object(
      'document_count', v_doc_count,
      'unit_count', v_unit_count,
      'created_at', now()
    )
  ) returning id into v_handover_id;

  perform log_audit('create', 'document_handover', v_handover_id,
    jsonb_build_object(
      'property_id', p_property_id,
      'to_tenant_id', p_to_tenant_id
    ));

  return v_handover_id;
end;
$$;

-- ============================================================
-- 32. STORAGE – Documents Bucket
-- ============================================================
-- Pfadschema: {tenant_id}/{property_id}/{level}/{category_code}/{document_id}.{ext}
-- Bucket muss in Supabase Dashboard oder via CLI erstellt werden:
--   insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
--
-- Storage-RLS-Policies:
-- Verwalter duerfen hochladen/lesen/loeschen innerhalb ihres Tenant-Pfades
-- Externe User duerfen nur lesen (via user_can_see_document Check)

-- ============================================================
-- 33. SUPABASE REALTIME
-- ============================================================

do $$ begin
  alter publication supabase_realtime add table emails;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table tickets;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table documents;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 34. MODUL WEG-BUCHHALTUNG
-- ============================================================
-- Kontenplan/doppelte Buchführung, Bankkonten der Gemeinschaft, Kostenarten,
-- Verteilerschlüssel, Wirtschaftsplan, Sonderumlagen, Buchungen.
-- Spezifikation: docs/specs/weg-buchhaltung-spec.md
-- Vollständiges DDL (Tabellen + RLS) lebt in scripts/migration-weg-buchhaltung.sql
-- und wird hier bewusst NICHT dupliziert, um Drift zwischen dieser Datei und
-- der tatsächlich ausgeführten Migration zu vermeiden (diese Datei ist laut
-- M0-Befund — docs/specs/hausgeldabrechnung-plan.md, Frage Q1 — ohnehin nicht
-- durchgängig mit dem Live-Schema synchron; für dieses Modul gilt
-- scripts/migration-weg-buchhaltung.sql als alleinige Quelle der Wahrheit).
-- Neue Tabellen: accounts, allocation_keys, allocation_key_values, cost_types,
-- community_bank_accounts, balance_confirmations, economic_plans,
-- plan_advances, special_levies, special_levy_units, journal_entries,
-- journal_entry_lines, bank_statement_imports, matching_rules, transactions.
