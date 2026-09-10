-- ============================================================
-- Migration: Diktat-Verknüpfungen zu Entitäten
-- ============================================================
alter table dictations
  add column if not exists linked_contact_id  uuid references contacts(id),
  add column if not exists linked_property_id uuid references properties(id),
  add column if not exists linked_ticket_id   uuid references tickets(id),
  add column if not exists linked_contract_id uuid references contracts(id);
