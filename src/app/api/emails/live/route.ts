import { ImapFlow } from "imapflow";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { getImapCredentials, syncImapEmails } from "@/lib/imap";

/**
 * GET /api/emails/live — SSE + IMAP IDLE
 *
 * Der Server hält eine dauerhafte IMAP-IDLE-Verbindung zu IONOS offen.
 * Wenn der Mailserver eine neue Nachricht meldet (EXISTS), werden die
 * neuen E-Mails in Supabase importiert und ein SSE-Event an den Browser
 * gesendet.
 */
export async function GET() {
  const { user } = await withAuth();
  if (!user) return unauthorized();

  const credentials = await getImapCredentials(user.id);
  if (!credentials) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "IMAP nicht konfiguriert" })}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();
  let idleClient: ImapFlow | null = null;
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        if (aborted) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch { /* controller closed */ }
      };

      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 25_000);

      try {
        idleClient = new ImapFlow({
          host: credentials.host,
          port: credentials.port,
          secure: true,
          auth: { user: credentials.user, pass: credentials.password },
          logger: false,
        });

        // EXISTS-Listener VOR connect registrieren (wie im funktionierenden Test)
        idleClient.on("exists", (data: { path: string; count: number; prevCount: number }) => {
          if (aborted) return;
          console.log("[IMAP IDLE] EXISTS:", data.count, "Nachrichten (vorher:", data.prevCount + ")");

          if (data.count > data.prevCount) {
            // Sync in separatem Promise — blockiert die IDLE-Verbindung nicht
            syncImapEmails(credentials, user.id, data.count - data.prevCount + 5)
              .then(() => {
                console.log("[IMAP IDLE] Sync fertig → sende new_mail");
                send({ type: "new_mail" });
              })
              .catch((err) => {
                console.error("[IMAP IDLE] Sync-Fehler:", err);
                // Trotzdem new_mail senden — Browser kann refreshen
                send({ type: "new_mail" });
              });
          }
        });

        await idleClient.connect();
        console.log("[IMAP IDLE] Verbunden mit", credentials.host);
        send({ type: "connected" });

        const lock = await idleClient.getMailboxLock("INBOX");
        console.log("[IMAP IDLE] INBOX geöffnet, Nachrichten:", idleClient.mailbox && idleClient.mailbox.exists);

        try {
          while (!aborted) {
            try {
              await idleClient.idle();
            } catch {
              break;
            }
          }
        } finally {
          lock.release();
        }
      } catch (err) {
        if (!aborted) {
          const msg = err instanceof Error ? err.message : "IMAP-Fehler";
          console.error("[IMAP IDLE] Fehler:", msg);
          send({ type: "error", message: msg });
        }
      } finally {
        clearInterval(heartbeat);
        if (idleClient) {
          try { await idleClient.logout(); } catch { /* ignore */ }
        }
        try { controller.close(); } catch { /* ignore */ }
      }
    },

    cancel() {
      aborted = true;
      if (idleClient) {
        try { idleClient.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
