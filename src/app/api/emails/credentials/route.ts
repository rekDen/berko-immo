import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { testImapConnection } from "@/lib/imap";

/**
 * GET /api/emails/credentials
 *
 * Gibt zurück, ob Zugangsdaten vorhanden sind — OHNE das Passwort.
 * Letzten Sync-Zeitpunkt und ggf. Fehler werden mitgeliefert.
 */
export async function GET() {
  const { user, tenantId } = await withAuth();
  if (!user || !tenantId) return unauthorized();

  const admin = createAdminClient();
  const { data } = await admin
    .from("email_accounts")
    .select("id, email, imap_host, imap_port, imap_user, last_sync_at, sync_error")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    configured: !!data,
    account: data
      ? {
          email: data.email,
          imap_host: data.imap_host,
          imap_port: data.imap_port,
          imap_user: data.imap_user,
          last_sync_at: data.last_sync_at,
          sync_error: data.sync_error,
        }
      : null,
  });
}

/**
 * POST /api/emails/credentials
 *
 * Speichert oder aktualisiert die IMAP-Zugangsdaten via service_role
 * (Passwort wird nie an den Browser gesendet). Optional kann vorher
 * ein Verbindungstest durchgeführt werden (test=true im Body).
 */
export async function POST(request: NextRequest) {
  const { user, tenantId } = await withAuth();
  if (!user || !tenantId) return unauthorized();

  const body = await request.json();
  const {
    email,
    imap_host,
    imap_port,
    imap_user,
    imap_password,
    test_connection,
  } = body;

  if (!email || !imap_password) {
    return badRequest("Pflichtfelder: email, imap_password");
  }

  const credentials = {
    email,
    host: imap_host ?? "imap.ionos.de",
    port: Number(imap_port ?? 993),
    user: imap_user ?? email,
    password: imap_password,
  };

  // Optionaler Verbindungstest vor dem Speichern
  if (test_connection) {
    const { ok, error } = await testImapConnection(credentials);
    if (!ok) {
      return NextResponse.json(
        { error: `IMAP-Verbindungstest fehlgeschlagen: ${error}` },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("email_accounts").upsert(
    {
      tenant_id: tenantId,
      user_id: user.id,
      email: credentials.email,
      imap_host: credentials.host,
      imap_port: credentials.port,
      imap_user: credentials.user,
      imap_password: credentials.password,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
