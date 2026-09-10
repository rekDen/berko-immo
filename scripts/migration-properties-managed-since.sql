-- ============================================================
-- Migration: properties.managed_since
-- ============================================================
-- Datum, seit dem das Objekt verwaltet wird.
-- ============================================================

alter table properties
  add column if not exists managed_since date;
