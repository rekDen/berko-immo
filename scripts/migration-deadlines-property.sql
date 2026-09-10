-- ============================================================
-- Migration: deadlines.property_id + deadlines.unit_id
-- ============================================================
-- Macht Termine/Fristen objekt- und ggf. einheits-bezogen.
-- ============================================================

alter table deadlines
  add column if not exists property_id uuid references properties(id),
  add column if not exists unit_id uuid references units(id);

create index if not exists idx_deadlines_property on deadlines(property_id) where property_id is not null;
create index if not exists idx_deadlines_unit on deadlines(unit_id) where unit_id is not null;
