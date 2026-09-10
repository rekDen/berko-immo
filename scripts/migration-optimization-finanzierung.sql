-- Migration: Finanzierungsparameter (Kaufpreis, EK, FK) an properties
-- Im Supabase SQL-Editor des Projekts jrqwtoizjwigwrokhrut ausführen.

alter table properties add column if not exists kaufpreis_eur          numeric;
alter table properties add column if not exists erwerbsnebenkosten_eur numeric;
alter table properties add column if not exists eingesetztes_ek_eur    numeric;
alter table properties add column if not exists fremdkapital_eur        numeric;
alter table properties add column if not exists fk_zins_pct            numeric;
