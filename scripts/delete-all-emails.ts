/**
 * Löscht alle E-Mails aus Supabase UND vom IMAP-Server.
 * Ausführen: npx tsx scripts/delete-all-emails.ts
 */

import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🔍  Lade IMAP-Zugangsdaten aus Supabase…");

  const { data: accounts, error: accErr } = await admin
    .from("email_accounts")
    .select("user_id, imap_host, imap_port, imap_user, imap_password");

  if (accErr || !accounts?.length) {
    console.log("⚠️  Keine IMAP-Zugangsdaten gefunden — lösche nur DB-Einträge.");
  }

  // ── 1. IMAP-Server leeren ──────────────────────────────────────────────────
  for (const account of accounts ?? []) {
    console.log(`\n📬  Verbinde mit IMAP (${account.imap_user})…`);
    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: true,
      auth: { user: account.imap_user, pass: account.imap_password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const mailbox = client.mailbox as { exists: number };
        const total = mailbox?.exists ?? 0;
        if (total === 0) {
          console.log("   INBOX ist bereits leer.");
        } else {
          console.log(`   ${total} Nachrichten gefunden — markiere als gelöscht…`);
          await client.messageDelete("1:*", { uid: false });
          console.log(`   ✅  ${total} Nachrichten auf IMAP-Server gelöscht.`);
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      console.error("   ❌  IMAP-Fehler:", err instanceof Error ? err.message : err);
    }
  }

  // ── 2. Supabase-Tabelle leeren ─────────────────────────────────────────────
  console.log("\n🗄️  Lösche alle E-Mails aus Supabase…");
  const { error: delErr, count } = await admin
    .from("emails")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // löscht alle Zeilen

  if (delErr) {
    console.error("❌  Supabase-Fehler:", delErr.message);
    process.exit(1);
  }
  console.log(`✅  ${count ?? "alle"} E-Mails aus Supabase gelöscht.`);

  // ── 3. deleted_uids zurücksetzen ──────────────────────────────────────────
  if (accounts?.length) {
    await admin
      .from("email_accounts")
      .update({ deleted_uids: [] })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("✅  deleted_uids-Liste zurückgesetzt.");
  }

  console.log("\n🎉  Fertig — alle E-Mails wurden gelöscht.");
}

main().catch((err) => {
  console.error("Unerwarteter Fehler:", err);
  process.exit(1);
});
