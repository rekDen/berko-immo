# Berko AI – Hausverwaltung

SaaS-Plattform für deutsche Hausverwaltungen (WEG, Mietverwaltung, Sondereigentum). Mandantenfähig (ein Verwaltungsunternehmen = ein Tenant), mit CRM, Dokumentenmanagement, E-Mail-Anbindung und KI-gestützten Modulen.

Das npm-Paket heißt intern `hv`. Die verbindlichen Architektur- und Namenskonventionen stehen in [00-architecture-overview.md](00-architecture-overview.md).

## Tech-Stack

- **Frontend/Backend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Datenbank & Auth:** Supabase (Postgres, Auth, Storage, Row Level Security, pgvector)
- **KI:** Anthropic Claude (`@anthropic-ai/sdk`), OpenAI-kompatible Clients, IONOS AI Model Hub (Embeddings)
- **E-Mail:** IMAP (`imapflow`, `mailparser`) und SMTP (`nodemailer`)
- **Telefonie & Sprache:** Twilio, ElevenLabs
- **Dokumente:** `pdf-lib`, `@react-pdf/renderer`, `unpdf`, `mammoth`, `xlsx`
- **Tests:** Vitest

## Module

| Bereich | Pfad (`src/app/(app)/…`) | Inhalt |
|---|---|---|
| Dashboard | `dashboard` | Überblick und Kennzahlen |
| CRM | `kontakte`, `objekte`, `vertraege`, `vorgaenge` | Kontakte, Objekte/Einheiten, Verträge, Tickets |
| DMS | `dokumente` | Dokumente, Ordner, Kategorien, Freigaben, Übergaben |
| E-Mail | `emails` | IMAP-Sync, Kategorisierung, Entwürfe, Versand |
| Fristen & Diktat | `deadlines`, `dictation` | Fristenverwaltung, Diktate mit Transkription |
| Telefonassistent | `telefonassistent` | Anrufe über Twilio und ElevenLabs |
| WEG-Buchhaltung | `api/weg-buchhaltung` | Wirtschaftspläne, Journal, Forderungen, Sonderumlagen |
| Hausgeldabrechnung | `api/weg-settlement` | Abrechnungen, Heizkostenimport, PDF-Export |
| Mietermatching | `api/mietermatching`, `bewerbung/[unitId]` | Bewerberprofile und öffentliches Bewerbungsformular |
| Immobilienoptimierung | `immobilienoptimierung` | Potenzialflächen, Maßnahmen, Szenarien |
| Exposé-Erstellung | `expose-erstellung` | Exposés aus Objektdaten |
| Daten einlesen | `daten-einlesen` | Ingestion-Pipeline mit Volltext- und Vektorindex |
| Legal AI | `legal-ai` | KI-Unterstützung für rechtliche Fragen |
| Einstellungen | `einstellungen` | Profil, Nutzerverwaltung |

## Voraussetzungen

- Node.js 20 oder neuer
- Ein Supabase-Projekt (oder lokal via `supabase start`)
- Optional je nach Modul: Anthropic-, IONOS-, Twilio-, ElevenLabs-, Google- und Dropbox-Zugänge

## Einrichtung

```bash
npm install
```

Danach eine `.env.local` im Projektroot anlegen (siehe unten).

### Umgebungsvariablen (`.env.local`)

| Variable | Verwendung |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase-Client im Browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-seitiger Zugriff, umgeht RLS (nie im Frontend nutzen) |
| `CREDENTIALS_ENCRYPTION_KEY` | 32 Byte, Base64. Verschlüsselt gespeicherte IMAP-Passwörter (AES-256-GCM). Erzeugen: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Nicht verlieren und nicht wechseln, sonst sind gespeicherte Passwörter unlesbar. |
| `ANTHROPIC_API_KEY`, `KIMI_API_KEY` | KI-Modelle |
| `IONOS_API_KEY`, `IONOS_API_SECRET` | IONOS AI Model Hub für Embeddings |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWD` | E-Mail-Versand |
| `TWILIO_*` | Telefonassistent (Account, API-Key, TwiML-App, Rufnummer) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_TO_BERKO_KEY` | Sprachausgabe und Telefonassistent |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Adresssuche und Google-Anbindung |
| `DROPBOX_CLIENT_ID` | Dropbox-Konnektor |
| `APP_URL` | Basis-URL der App |

`.env.local` enthält Secrets und gehört nie ins Repository.

### Datenbank

1. Basisschema in Supabase einspielen: [supabase-schema.sql](supabase-schema.sql). Es enthält Cleanup-Statements und löscht vorhandene Tabellen, daher nur auf leeren oder Testdatenbanken ausführen.
2. Danach die Migrationen aus [scripts/](scripts) (`migration-*.sql`) in zeitlicher Reihenfolge der Module einspielen.
3. Optional Testdaten laden (`scripts/seed-*.sql` bzw. `seed-*.ts`).

## Entwicklung

```bash
npm run dev          # Dev-Server auf http://localhost:3000
npm run build        # Produktions-Build
npm run start        # Produktions-Server
npm run lint         # ESLint
npm test             # Vitest (einmalig)
npm run test:watch   # Vitest im Watch-Modus
```

Tests liegen neben dem Code in `__tests__`-Ordnern (`src/**/*.test.ts`).

## Projektstruktur

```
src/
  app/
    (app)/       Geschützte Oberfläche (Seiten pro Modul)
    api/         Route Handler pro Modul
    login/       Anmeldung
    bewerbung/   Öffentliches Bewerbungsformular für Mietinteressenten
  components/    UI-Komponenten pro Modul (crm, dms, weg-*, mietermatching, …)
  lib/           Fachlogik pro Modul, Supabase-Clients, Ingestion
  middleware.ts  Auth-Prüfung
worker/          Ingestion-Worker (extract → chunk → embed via pgmq), siehe worker/README.md
scripts/         SQL-Migrationen, Seeds, Hilfsskripte, Spezifikationen
docs/            Modul-Spezifikationen und Prompts
supabase/        Supabase-CLI-Konfiguration
public/          Statische Dateien
```

## Multi-Tenancy und Sicherheit

- Jede fachliche Tabelle hat `tenant_id`, `created_at`, `updated_at`, `created_by` und `deleted_at` (Soft-Delete).
- Zugriff läuft über Row Level Security mit den Helfern `current_tenant_id()`, `is_tenant_admin()` und `user_has_role_on(...)`.
- Eigentümer, Mieter und Beiräte gehören zu keinem Tenant und sehen nur das DMS-Portal über ihre `contact_roles`.
- Hard-Deletes gibt es nicht, gelöscht wird per `deleted_at`.

Details und Policy-Vorlagen: [00-architecture-overview.md](00-architecture-overview.md).

## E-Mail-Integration

```
Browser                    Next.js (Server)             Extern
/emails
  │ GET  /api/emails ───────► emails-Tabelle (Supabase)
  │ POST /api/emails/sync ──► imap.ts ───────────────► IONOS IMAP (imap.ionos.de:993)
  │ GET/POST /api/emails/credentials                     holt neue Mails,
  │   (Passwort aus email_accounts, service_role)        speichert in emails
```

Neue Mails kommen in Echtzeit an:

```
IMAP IDLE → Supabase DB INSERT → Supabase Realtime (WebSocket) → Browser
            (SSE-Route schreibt)                                  (Liste + Toast)

EventSource ─────────────────────────────────────────────────► Live-Badge
(hält IMAP IDLE am Leben, sendet keine Benachrichtigungen mehr)
```

Der Browser bekommt neue Mails über Supabase Realtime statt über das SSE-Event selbst. Das ist robuster, weil die frühere Kette `IMAP IDLE → SSE → refreshEmails()` an mehreren Stellen blockieren konnte.

## Ingestion-Worker

Der Worker unter [worker/](worker) verarbeitet hochgeladene Dokumente und Quellen asynchron über pgmq (Extrahieren, Chunking, Embeddings). Konfiguration, Docker-Start und das Hinzufügen neuer Quellen stehen in [worker/README.md](worker/README.md).

## Hilfsskripte

[scripts/README.md](scripts/README.md) beschreibt das Skript zum Versand von Test-E-Mails (`send-emails.js`), mit dem sich E-Mail-Sync und -Kategorisierung testen lassen.

## Weiterführende Dokumente

- [00-architecture-overview.md](00-architecture-overview.md): Stack, RLS, Naming, Fehlerbehandlung, i18n
- [docs/specs/](docs/specs): Spezifikationen für Mietermatching, Hausgeldabrechnung und WEG-Buchhaltung
- [docs/prompts/](docs/prompts): Modul-Prompts für CRM und DMS
