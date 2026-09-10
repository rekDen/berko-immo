This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



Architektur der IMAP-Integration

Browser                   Next.js (Server)           Extern
──────────────────────────────────────────────────────────
/emails page
  │  GET /api/emails ──────► emails-Tabelle (Supabase)
  │  POST /api/emails/sync ─► imap.ts
  │                               │
  │  Setup-Dialog                 ├─ liest Passwort aus
  │  POST /api/emails/credentials │  email_accounts (service_role)
  │  GET  /api/emails/credentials │
  │                               └─► IONOS IMAP (imap.ionos.de:993)
  │                                     └─ holt neue E-Mails
  │                                     └─ speichert in emails-Tabelle



Vergleich mit GraphQL Subscriptions
GraphQL Subscriptions	Unsere Implementierung
Browser → Server	WebSocket (ws://)	SSE (http://, nur Server→Client)
Protokoll	GraphQL über WebSocket	Rohes HTTP-Streaming
Server → Datenquelle	Beliebig (DB, MQTT, etc.)	IMAP IDLE (TCP)
Format	{ data: { emailReceived: {...} } }	data: {"type":"new_mail"}\n\n
Reconnect	Manuell oder via Apollo	Automatisch im Browser


Vorher — fragile Kette mit vielen Fehlerquellen:


IMAP IDLE → SSE Event → Browser empfängt → refreshEmails() → evtl. blockiert
Jetzt — zwei unabhängige, zuverlässige Mechanismen:


IMAP IDLE → Supabase DB INSERT ──→ Supabase WebSocket ──→ Browser
              (SSE-Route schreibt)    (PostgreSQL NOTIFY)    (setEmailList sofort)
                                                             (Toast erscheint)

EventSource  ──────────────────────────────────────────────→ Live-Badge
(hält IMAP IDLE am Leben, sendet keine Notifications mehr)