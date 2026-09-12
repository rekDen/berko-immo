# Berko AI – Architektur & Konventionen (Master-Referenz)

## Zweck dieses Dokuments
Dieser Prompt ist die **gemeinsame Grundlage** für alle Modul-Prompts 
(CRM-Backend, DMS-Backend, CRM-Frontend, DMS-Frontend, später 
Buchhaltung, Beschlüsse, ETV-Planung, etc.). Er legt Tech-Stack, 
Folder-Struktur, Namenskonventionen, RLS-Patterns, Fehler-Handling und 
Code-Stil fest. **Jeder Modul-Prompt referenziert dieses Dokument** 
und erweitert es nur, statt es zu wiederholen.

**Reihenfolge der Prompts**:
1. `00-architecture-overview.md` (dieses Dokument)
2. `01-crm-backend.md`
3. `02-dms-backend.md`
4. `03-dms-frontend.md` (kleinere UI, Patterns etablieren)
5. `04-crm-frontend.md` (nutzt die DMS-Patterns)

## Produkt-Kontext

**Berko AI** ist eine SaaS-Plattform für deutsche Hausverwaltungen 
(WEG, Mietverwaltung, Sondereigentum). Zielgruppe sind Verwalter mit 
50–500 Einheiten. Wettbewerber: HausPerfekt PRO, Karthago, Domus, 
Immoware24. USP: moderne UX, mehrsprachig (DE/EN/RU), 
mandantenfähiges Multi-Tenant-Modell, Beirats-Portal, 
Online-Belegprüfung.

Sekundärzielgruppe (read-only): Eigentümer, Mieter, Beiräte, 
Dienstleister – diese sehen nur das DMS-Portal und ggf. ein 
Vorgangs-Portal, niemals das volle CRM.

## Tech-Stack (verbindlich)
### Dev-Tooling
- **Linting**: ESLint + Prettier (Config in Root)
- **Testing**: Vitest + React Testing Library + Playwright für E2E
- **Mocking**: MSW (Mock Service Worker) für Supabase
- **Type-Generation**: `supabase gen types typescript` → 
  `src/types/database.ts`

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

### Standard-Trigger
```sql
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Auf jeder Tabelle:
create trigger trg_<table>_updated_at
  before update on <table>
  for each row execute function set_updated_at();
```

### RLS-Helper (in jedem Modul wiederverwendet)
```sql
-- Aktueller Tenant des eingeloggten Users
create or replace function current_tenant_id() returns uuid
language sql stable security definer as $$
  select (auth.jwt() ->> 'tenant_id')::uuid;
$$;

-- Ist der User Mandant-Admin/Verwalter?
create or replace function is_tenant_admin() returns boolean
language sql stable security definer as $$
  select coalesce(
    (auth.jwt() ->> 'role') in ('tenant_admin', 'tenant_user'),
    false
  );
$$;

-- Hat der User eine aktive contact_role auf property/unit/contract?
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
      and (cr.valid_to is null or cr.valid_to > now())
      and (p_property_id is null or cr.property_id = p_property_id 
           or cr.unit_id in (select id from units where property_id = p_property_id))
      and (p_unit_id is null or cr.unit_id = p_unit_id)
      and (p_contract_id is null or cr.contract_id = p_contract_id)
      and (p_required_roles is null or cr.role = any(p_required_roles))
  );
$$;
```

### Standard-Policies pro Tabelle
```sql
alter table <t> enable row level security;

-- SELECT: Verwalter sieht alles im Tenant, Soft-Deletes ausgeblendet
create policy "<t>_select_tenant" on <t>
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
  );

-- INSERT: Tenant_id wird auto-gesetzt
create policy "<t>_insert_tenant" on <t>
  for insert with check (
    tenant_id = current_tenant_id()
    and is_tenant_admin()
  );

-- UPDATE: nur eigener Tenant, nur Admins
create policy "<t>_update_tenant" on <t>
  for update using (
    tenant_id = current_tenant_id()
    and is_tenant_admin()
  );

-- DELETE: kein Hard-Delete, immer Soft-Delete via UPDATE
-- (keine DELETE-Policy = niemand darf hart löschen)
```

Externe User (Eigentümer/Mieter) haben **separate Policies** mit 
`user_has_role_on(...)` – siehe DMS-Prompt für Details.

## Naming-Konventionen

### Datenbank
- Tabellen: `snake_case`, Plural (`contacts`, `properties`, `units`, 
  `documents`)
- Spalten: `snake_case`, Singular (`tenant_id`, `created_at`)
- Foreign Keys: `<table>_id` (`property_id`, `contact_id`)
- Indexe: `idx_<table>_<columns>` (`idx_documents_tenant_property`)
- Functions: `snake_case`, verb-zuerst (`get_visible_categories`, 
  `bulk_upload_documents`, `log_sensitive_access`)
- Views: `v_<purpose>` (`v_active_owners`, `v_contact_overview`)
- Enums als CHECK Constraint: `check (status in ('new', 'in_progress', ...))`. 
  Keine Postgres-Enum-Types (Migration-Hölle).

### Frontend
- Komponenten: `PascalCase`, sprechend (`ContactDetailPage`, 
  `DocumentPreviewModal`, `RoleChip`)
- Hooks: `useXxx` (`useContact`, `useCurrentTenant`)
- Types: `PascalCase` (`Contact`, `ContactWithRoles`)
- Files: matching the default export (`ContactDetailPage.tsx`)
- Test-Files: `*.test.tsx` neben der Komponente
- Konstanten: `SCREAMING_SNAKE_CASE`

### TypeScript
- Strict mode an, keine `any`
- Domain-Types in `src/types/<feature>.ts` mit klarer Trennung von 
  DB-Types (generiert) und Domain-Types (manuell, mit Joins/Computed 
  Fields)

```typescript
// types/database.ts (generiert)
export type ContactRow = Database['public']['Tables']['contacts']['Row'];

// types/crm.ts (manuell)
export type Contact = ContactRow;
export type ContactWithRoles = Contact & {
  roles: ContactRoleWithContext[];
};
```

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

## Fehler-Handling

### Backend
- RPCs nutzen `raise exception` mit klaren Codes:
  - `'PERMISSION_DENIED'`
  - `'NOT_FOUND'`
  - `'VALIDATION_ERROR: <field>'`
  - `'CONFLICT: <reason>'`
- Frontend mappt auf User-freundliche Meldungen via i18n

### Frontend
- Globaler Error-Boundary mit Fallback-UI (nicht weißer Bildschirm)
- TanStack Query: globale `onError`-Konfig im QueryClient mit 
  Toast-Notifications
- Form-Errors: zod-Schemas mit DE-Default-Messages
- Network-Errors: Retry mit exponential backoff (max 3, base 1s)
- 403/RLS: klarer Hinweis „Sie haben keinen Zugriff auf diesen 
  Datensatz"

```typescript
// Standard QueryClient-Setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (isPermissionError(error)) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      onError: (error) => {
        toast.error(translateError(error));
        captureException(error);
      },
    },
  },
});

## Performance-Standards

### Backend
- Indexe auf allen Foreign Keys
- Composite-Index `(tenant_id, <häufiger Filter>)` auf großen Tabellen
- GIN-Index für Volltext-Suche (`tsvector`, deutsche Konfiguration)
- Pagination: Cursor-basiert ab 1000+ Datensätzen, Offset-basiert sonst
- Listen-Queries immer mit `limit` + `range`



## Accessibility (WCAG 2.1 AA)

- Alle interaktiven Elemente keyboard-bedienbar (Tab, Enter, Space, 
  Esc)
- ARIA-Labels für Icon-Only-Buttons
- Semantic HTML: `<main>`, `<nav>`, `<section>`, `<table>` mit 
  `<th scope>`
- Focus-Traps in Modals/Drawers
- Kontraste prüfen (Orange auf Weiß ist tricky → minimum #C77000 für 
  Text)
- Screen-Reader-Texte für visuelle Counter und Status-Indikatoren
- Form-Inputs immer mit `<label>`, Fehler via `aria-describedby`


## UI-Konsistenz

### Komponenten, die in beiden Modulen identisch sein müssen
- Sidebar / TopBar / Layout
- Loading-States (Skeleton-Loader)
- Empty-States (Illustration + CTA)
- Error-Pages (404, 403, 500)
- Modals/Drawer
- Toast-Notifications
- Confirm-Dialogs (insb. für destruktive Aktionen)

Diese liegen unter `src/components/shared/` und werden nicht pro 
Feature dupliziert.

### Density
- DMS: lockerer (16px Padding, größere Tiles)
- CRM: dichter (8-10px in Tabellen, viele Daten auf einen Blick)
- Beirats-/Mieter-Portal später: lockerer + mobile-first

## Testing-Standards

### Coverage-Ziele
- Unit-Tests: > 70% Lines auf `lib/` und `hooks/`
- Komponenten-Tests: alle Komponenten mit Logik (nicht reine 
  Präsentation)
- E2E: alle kritischen User-Flows (Login → Kontakt-CRUD, Document 
  Upload → Preview → Download, etc.)

### Test-Pyramide
- Viele Unit-Tests, mittel viele Integration-Tests, wenige E2E-Tests
- E2E nur für End-to-End-Workflows, nicht für UI-Details

### Mock-Strategie
MSW für Supabase-Mocks. Pro Feature ein `mocks/handlers.ts`. 
Setup in `tests/setup.ts`.

## Migration & Deployment

### Migrations
- Niemals bestehende Migrations ändern, immer neue erstellen
- Reihenfolge wichtig: erst Schema, dann RLS-Policies, dann 
  Seed-Daten
- Reversibel wo möglich (`down`-Migration im Kommentar)

### Branching
- `main` = Production
- `develop` = Staging
- Feature-Branches: `feature/<modul>-<beschreibung>`
- PR-Reviews verpflichtend, mind. 1 Approval

### Environments
- `local` → lokales Supabase via `supabase start`
- `staging` → Supabase-Projekt mit Test-Daten
- `production` → Live-Mandanten

## Code-Stil

### Allgemein
- Prettier-Config in Root, automatisch on save
- ESLint mit `@typescript-eslint/recommended-strict`
- Imports sortiert: external → absolute (`@/`) → relative
- Keine default exports außer für Pages/Routes (better refactoring)

### React
- Function Components, keine Klassen
- Props-Interfaces über `type Props = { ... }`, nicht `interface`
- `const Component = ({ prop }: Props) => { ... }` (arrow)
- Hooks am Anfang, dann Handlers, dann Render

### Supabase-Client
Immer über zentralen Singleton aus `lib/supabase.ts`, nie direkt 
instanziieren. Typisierte Queries:
```typescript
const { data, error } = await supabase
  .from('contacts')
  .select('id, first_name, last_name, contact_roles(role, valid_to)')
  .eq('tenant_id', tenantId);
```

## Sicherheits-Prinzipien

### Keine Secrets im Frontend
- `SUPABASE_URL` und `SUPABASE_ANON_KEY` sind public, OK im Frontend
- `SERVICE_ROLE_KEY` **niemals** im Frontend
- Zugriffe, die Service-Role brauchen, laufen über Edge Functions

### RLS ist die einzige Wahrheit
- Frontend-Filter sind **kein** Security-Mechanismus, nur UX
- Jede Tabelle hat RLS aktiviert, **immer**
- Tests prüfen RLS-Policies explizit (kann User X Datensatz Y sehen?)

### Input-Validierung
- Backend: Constraints + Trigger + RPC-Validierung
- Frontend: zod-Schemas (UX), nicht als Security-Layer
- Beide Schichten validieren – Frontend für UX, Backend für Sicherheit

## Was diese Architektur explizit ablehnt

- **Microservices** – Monolith mit Modul-Trennung reicht für ~10k 
  Tenants
- **GraphQL** – Supabase-PostgREST + RPC genügt
- **Eigene Auth** – Supabase Auth, später ggf. SSO über Supabase
- **Eigene File-Storage** – Supabase Storage, kein S3 direkt
- **Server-Side-Rendering** – SPA reicht (interne App, kein SEO-Bedarf)
- **Eigene Design-System-Library** – shadcn/ui mit Berko AI-Tokens
- **Über-Engineering von Mehrsprachigkeit** – DE ist Primärsprache, 
  EN/RU sind Add-On

## Erweiterung dieses Dokuments

Wenn ein Modul-Prompt eine **neue allgemeine Konvention** einführt 
(z.B. „alle Notifications laufen über X"), wird diese hier ergänzt, 
nicht nur im Modul-Prompt. So bleibt das Architektur-Dokument der 
Single Point of Truth.

Architecture Decision Records für größere Entscheidungen unter 
`docs/adr/`. Format: 
[MADR](https://adr.github.io/madr/).

## Referenz für Modul-Prompts

Jeder Modul-Prompt beginnt mit:
> Dieser Prompt baut auf `docs/prompts/00-architecture-overview.md` 
> auf. Tech-Stack, Folder-Struktur, RLS-Patterns, Naming, Audit, i18n 
> und Code-Stil sind dort definiert. Dieses Dokument beschreibt nur 
> die modul-spezifischen Anforderungen.

Damit muss der Modul-Prompt nicht mehr alle Basics wiederholen und 
bleibt fokussiert.