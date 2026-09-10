import { NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { getImapCredentials, syncImapEmails } from "@/lib/imap";

/**
 * POST /api/emails/sync
 *
 * Löst einen IMAP-Sync für den eingeloggten Nutzer aus.
 * Liest die Zugangsdaten aus Supabase (service_role) und
 * holt neue E-Mails vom IONOS-IMAP-Server.
 */
export async function POST() {
  const { user } = await withAuth();
  if (!user) return unauthorized();

  const credentials = await getImapCredentials(user.id);

  if (!credentials) {
    return NextResponse.json(
      {
        error:
          "Keine IMAP-Zugangsdaten konfiguriert. Bitte zuerst die E-Mail-Verbindung einrichten.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await syncImapEmails(credentials, user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "IMAP-Sync fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
