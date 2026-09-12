## Multi-Tenancy & RLS-Patterns (kritisch)

### Mandantenfähigkeit
Berko AI ist Multi-Tenant: ein Verwaltungsunternehmen = ein `tenant`. 
Jeder Verwalter-User gehört zu genau einem Tenant. Sekundär-User 
(Eigentümer/Mieter) gehören zu **keinem** Tenant, sind aber via 
`contact_roles` mit Objekten/Einheiten/Verträgen eines Tenants 
verknüpft.

### Pflicht auf jeder fachlichen Tabelle
- `id uuid primary key default gen_random_uuid()`
- `tenant_id uuid not null` (Foreign Key auf `tenants`)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by uuid` (auth.users)
- `deleted_at timestamptz` (Soft-Delete, kein Hard-Delete)

## Daten-Sensitivität (DSGVO)

Drei Level pro Feld:
- **public**: Name, Rolle (intern für Verwalter sichtbar)
- **sensitive**: E-Mail, Telefon, Adresse, Geburtsdatum
- **restricted**: IBAN, Steuer-ID, GwG-Daten, Schufa, 
  Gesundheitsinfos

**Restricted-Felder**:
- Nicht in Listen anzeigen
- Nur on-demand laden (separater RPC-Call)
- Bei jedem Zugriff Audit-Log via `log_sensitive_access(field, 
  contact_id)`
- UI-Komponente `<SensitiveField>` mit Reveal-Button + Audit-Trigger

## Audit-Logging

Eine zentrale Tabelle `audit_log`:
```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  action text not null,           -- 'create', 'update', 'delete', 
                                   -- 'view_sensitive', 'download', ...
  entity_type text not null,      -- 'contact', 'document', 'contract', ...
  entity_id uuid,
  metadata jsonb,                 -- Vorher-/Nachher-Werte etc.
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);
```

Insert-Helper-Function `log_audit(...)` wird aus allen relevanten 
Operationen aufgerufen (Edge Functions, RPCs, Frontend bei sensitiven 
Reads).

**Was wird geloggt**:
- Jede Mutation auf Kern-Entities (Contact, Property, Unit, Contract, 
  Document)
- Jeder Zugriff auf restricted-Daten
- Jeder Document-Download/Preview
- Login/Logout (über Supabase Auth Hooks)

## Internationalisierung

### Sprachen
DE (Default), EN, RU. Verwalter wählt Sprache pro User. Frontend 
nutzt `react-i18next`, alle UI-Strings in `src/locales/<lang>/<ns>.json`.

### Namespace-Struktur
- `common.json` – App-weit (Buttons, Standard-Labels)
- `auth.json` – Login/Registrierung
- `crm.<sub>.json` – pro CRM-Subfeature
- `dms.<sub>.json` – pro DMS-Subfeature

### Datenbank-Inhalte
Manche Stammdaten sind mehrsprachig in DB (z.B. 
`document_categories.name_de/en/ru`). Helper im Frontend:

```typescript
function localizedName<T extends Record<string, any>>(
  row: T, 
  field: string, 
  lang: string
): string {
  return row[`${field}_${lang}`] ?? row[`${field}_de`] ?? '';
}
```

### Datums- und Zahlenformate
- Datum: `dd.MM.yyyy` (DE), `MM/dd/yyyy` (EN), `dd.MM.yyyy` (RU)
- Zahlen: `Intl.NumberFormat(locale)`
- Währung: `Intl.NumberFormat(locale, { style: 'currency', currency: 
  'EUR' })` – immer EUR
