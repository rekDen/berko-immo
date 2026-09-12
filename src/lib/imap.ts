/**
 * IMAP-Helper für die Anbindung an IONOS-Postfächer.
 *
 * Wird ausschließlich serverseitig (API-Routes) verwendet.
 * Nutzt den service_role-Admin-Client, um die gespeicherten
 * Zugangsdaten aus Supabase zu lesen (umgeht RLS).
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateTableSource, indexTableRow } from "@/lib/ingestion/index-row";

// ─── Typen ─────────────────────────────────────────────────────────────────

export interface ImapCredentials {
  email: string;
  host: string;
  port: number;
  user: string;
  password: string;
  tenantId: string;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

// Kategorien, die die emails-Tabelle erlaubt
type EmailCategory =
  | "objektbezogen"
  | "mieterkommunikation"
  | "finanzen"
  | "schaeden"
  | "vertraege"
  | "weg"
  | "behoerden"
  | "dienstleister"
  | "termine"
  | "intern"
  | "newsletter";

// ─── Zugangsdaten aus Supabase lesen ───────────────────────────────────────

export async function getImapCredentials(
  userId: string
): Promise<ImapCredentials | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_accounts")
    .select("email, imap_host, imap_port, imap_user, imap_password, tenant_id")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    email: data.email,
    host: data.imap_host,
    port: data.imap_port,
    user: data.imap_user,
    password: data.imap_password,
    tenantId: data.tenant_id as string,
  };
}

// ─── Haupt-Sync-Funktion ───────────────────────────────────────────────────

/**
 * Verbindet mit dem IMAP-Server, liest die letzten `limit` Nachrichten
 * aus INBOX und speichert neue E-Mails in der Supabase-Tabelle `emails`.
 * Bereits vorhandene Nachrichten (anhand imap_uid) werden übersprungen.
 */
export async function syncImapEmails(
  credentials: ImapCredentials,
  userId: string,
  limit = 75
): Promise<SyncResult> {
  const admin = createAdminClient();
  const result: SyncResult = { synced: 0, skipped: 0, errors: [] };

  // Quelle für die semantische Indexierung einmalig sicherstellen, damit jede
  // neu eingelesene E-Mail sofort vektorisiert und durchsuchbar wird.
  // Schlägt dies fehl, darf der eigentliche E-Mail-Sync trotzdem weiterlaufen.
  let sourceId: string | null = null;
  try {
    sourceId = await getOrCreateTableSource(admin, credentials.tenantId);
  } catch (err) {
    console.error("[Ingestion] Quelle konnte nicht angelegt werden:", err instanceof Error ? err.message : err);
  }

  // Bereits synchronisierte UIDs laden (für Deduplizierung in O(1))
  const { data: existingRows } = await admin
    .from("emails")
    .select("imap_uid")
    .eq("tenant_id", credentials.tenantId)
    .not("imap_uid", "is", null);

  const existingUids = new Set<number>(
    (existingRows ?? []).map((r) => r.imap_uid as number)
  );

  // Gelöschte UIDs laden — diese dürfen nicht erneut importiert werden
  const { data: accountData } = await admin
    .from("email_accounts")
    .select("deleted_uids")
    .eq("user_id", userId)
    .single();

  const deletedUids = new Set<number>(
    ((accountData?.deleted_uids as number[]) ?? [])
  );

  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: true,
    auth: {
      user: credentials.user,
      pass: credentials.password,
    },
    logger: false,
  });

  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = (client.mailbox as { exists: number }).exists ?? 0;
      if (total === 0) return result;

      // Nur die letzten `limit` Nachrichten abrufen
      const startSeq = Math.max(1, total - limit + 1);
      const range = `${startSeq}:*`;

      for await (const msg of client.fetch(range, {
        uid: true,
        source: true,
      })) {
        // Bereits bekannte oder gelöschte UIDs überspringen
        if (existingUids.has(msg.uid) || deletedUids.has(msg.uid)) {
          result.skipped++;
          continue;
        }

        try {
          if (!msg.source) {
            result.skipped++;
            continue;
          }

          const parsed = await simpleParser(msg.source as Buffer);

          const fromAddr = parsed.from?.value?.[0];
          const fromAddress = fromAddr?.address ?? "";
          const fromName = fromAddr?.name || fromAddress;
          const subject = parsed.subject ?? "(Kein Betreff)";
          const rawHtml = typeof parsed.html === "string" ? parsed.html : "";
          const body = parsed.text ?? stripHtml(rawHtml);
          const date = parsed.date ?? new Date();
          const messageId = parsed.messageId ?? null;
          const trimmedBody = body.trim() || "(kein Inhalt)";
          const category = await categorizeEmail(subject, trimmedBody);

          const { data: insertedEmail, error: insertError } = await admin
            .from("emails")
            .insert({
              tenant_id: credentials.tenantId,
              created_by: userId,
              from_address: fromAddress,
              from_name: fromName || fromAddress,
              subject,
              body: trimmedBody,
              date: date.toISOString(),
              category,
              ai_categorized: true,
              read: false,
              starred: false,
              ai_summary: "",
              ai_draft: "",
              imap_uid: msg.uid,
              message_id: messageId,
            })
            .select("id")
            .single();

          if (insertError || !insertedEmail) {
            // Duplikat-Fehler (message_id-Kollision) leise ignorieren
            if (!insertError?.message.includes("duplicate")) {
              result.errors.push(`UID ${msg.uid}: ${insertError?.message ?? "Insert fehlgeschlagen"}`);
            } else {
              result.skipped++;
            }
          } else {
            result.synced++;

            // Sofort vektorisieren, damit die E-Mail direkt semantisch durchsuchbar ist.
            if (sourceId) {
              try {
                await indexTableRow(
                  admin,
                  credentials.tenantId,
                  sourceId,
                  "emails",
                  {
                    id: insertedEmail.id,
                    from_address: fromAddress,
                    from_name: fromName || fromAddress,
                    subject,
                    body: trimmedBody,
                    category,
                  },
                  ["from_address", "from_name", "subject", "body", "category"],
                );
              } catch (indexErr) {
                console.error(
                  "[Ingestion] Vektorisierung fehlgeschlagen für E-Mail",
                  insertedEmail.id,
                  indexErr instanceof Error ? indexErr.message : indexErr,
                );
              }
            }
          }
        } catch (parseErr) {
          result.errors.push(
            `UID ${msg.uid}: ${
              parseErr instanceof Error ? parseErr.message : "Parse-Fehler"
            }`
          );
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  // Letzten Sync-Zeitstempel und ggf. Fehler speichern
  await admin
    .from("email_accounts")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_error:
        result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return result;
}

// ─── Verbindungstest ───────────────────────────────────────────────────────

export async function testImapConnection(
  credentials: Pick<ImapCredentials, 'host' | 'port' | 'user' | 'password'>
): Promise<{ ok: boolean; error?: string }> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: true,
    auth: {
      user: credentials.user,
      pass: credentials.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen",
    };
  }
}

// ─── E-Mail auf IMAP-Server löschen ───────────────────────────────────────

/**
 * Löscht eine E-Mail auf dem IMAP-Server anhand der UID.
 * Setzt das \Deleted-Flag und führt EXPUNGE aus.
 */
export async function deleteImapEmail(
  credentials: ImapCredentials,
  imapUid: number
): Promise<{ ok: boolean; error?: string }> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: true,
    auth: { user: credentials.user, pass: credentials.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // messageDelete setzt \Deleted + EXPUNGE in einem Schritt
      const result = await client.messageDelete(String(imapUid), { uid: true });
      console.log("[IMAP] Gelöscht UID:", imapUid, "Ergebnis:", result);
    } finally {
      lock.release();
    }

    await client.logout();
    return { ok: true };
  } catch (err) {
    console.error("[IMAP] Löschfehler UID:", imapUid, err);
    try { await client.logout(); } catch { /* ignore */ }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "IMAP-Löschfehler",
    };
  }
}

// ─── Sonnet-Kategorisierung ───────────────────────────────────────────────

const anthropic = new Anthropic();

const VALID_CATEGORIES: EmailCategory[] = [
  "objektbezogen",
  "mieterkommunikation",
  "finanzen",
  "schaeden",
  "vertraege",
  "weg",
  "behoerden",
  "dienstleister",
  "termine",
  "intern",
  "newsletter",
];

export async function categorizeEmail(
  subject: string,
  body: string,
): Promise<EmailCategory> {
  try {
    const snippet = body.slice(0, 1200);
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 30,
      system:
        "Du bist ein Klassifikator für E-Mails einer deutschen Hausverwaltung. " +
        "Ordne jede E-Mail genau EINER Kategorie zu. Antworte NUR mit dem Kategorie-Wort, nichts anderes.\n\n" +
        "Kategorien:\n" +
        "- objektbezogen: Allgemeine Anfragen oder Mitteilungen zu einem konkreten Objekt (Lage, Stammdaten, Hausordnung).\n" +
        "- mieterkommunikation: E-Mails von oder an Mieter — Anfragen, Beschwerden, Mitteilungen, allgemeiner Mieterkontakt (kein Schaden / keine Finanzfrage).\n" +
        "- finanzen: Hausgeld, Mietzahlung, Mahnung, Nebenkostenabrechnung, Wirtschaftsplan, Kontoauszug, Rechnung, Mahnungen.\n" +
        "- schaeden: Schadensmeldungen, Mängelanzeigen, Reparaturen, Wartung, Heizung/Wasser/Strom-Ausfall, Notdienste.\n" +
        "- vertraege: Mietverträge, Verwaltungsverträge, Kündigungen, Vertragsänderungen, Selbstauskünfte, Nachträge.\n" +
        "- weg: Eigentümerversammlungen, Beschlussvorlagen, Beirat, WEG-spezifische Themen, Stimmrecht, Vollmachten.\n" +
        "- behoerden: Bauamt, Ordnungsamt, Gericht, Anwalt, Klagen, Mahnbescheide, Genehmigungen, Zweckentfremdung.\n" +
        "- dienstleister: Handwerker, Hausmeister, Reinigung, Wartungsfirmen, Versorger, Versicherungen.\n" +
        "- termine: Terminbestätigungen, Einladungen, Kalender-Updates, Begehungen, ETV-Termine.\n" +
        "- intern: Verwaltungsinterne Kommunikation, Teamorganisation, Urlaubsvertretung.\n" +
        "- newsletter: Newsletter, Werbung, automatische Benachrichtigungen.",
      messages: [
        { role: "user", content: `Betreff: ${subject}\n\n${snippet}` },
      ],
    });

    const raw = (msg.content[0]?.type === "text" ? msg.content[0].text : "").trim().toLowerCase();
    const category = VALID_CATEGORIES.find((c) => raw.includes(c));
    return category ?? "mieterkommunikation";
  } catch (err) {
    console.error("[Sonnet] Kategorisierung fehlgeschlagen:", err instanceof Error ? err.message : err);
    return "mieterkommunikation";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
}
