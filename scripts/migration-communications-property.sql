-- ============================================================
-- Migration: communications.property_id + communications.unit_id
-- ============================================================
-- Erlaubt direkte Verknüpfung von E-Mails / Notizen zu Objekten/Einheiten.
-- ============================================================

alter table communications
  add column if not exists property_id uuid references properties(id),
  add column if not exists unit_id uuid references units(id);

create index if not exists idx_communications_property on communications(property_id) where property_id is not null;
create index if not exists idx_communications_unit on communications(unit_id) where unit_id is not null;
