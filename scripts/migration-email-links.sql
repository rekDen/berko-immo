-- ============================================================
-- Migration: E-Mail-Verknüpfungen zu Entitäten
-- ============================================================
alter table emails
  add column if not exists linked_contact_id  uuid references contacts(id),
  add column if not exists linked_property_id uuid references properties(id),
  add column if not exists linked_ticket_id   uuid references tickets(id),
  add column if not exists linked_contract_id uuid references contracts(id);

create index if not exists idx_emails_linked_contact  on emails(linked_contact_id)  where linked_contact_id is not null;
create index if not exists idx_emails_linked_property on emails(linked_property_id) where linked_property_id is not null;
create index if not exists idx_emails_linked_ticket   on emails(linked_ticket_id)   where linked_ticket_id is not null;
create index if not exists idx_emails_linked_contract on emails(linked_contract_id) where linked_contract_id is not null;
