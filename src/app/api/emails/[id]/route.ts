import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImapCredentials, deleteImapEmail } from "@/lib/imap";

// GET /api/emails/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/emails/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const allowed = [
    "read", "starred", "ai_summary", "ai_draft", "ai_legal",
    "to_address", "cc", "bcc", "subject", "body", "folder",
    "linked_contact_id", "linked_property_id", "linked_ticket_id", "linked_contract_id",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("emails")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/emails/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;

  // Lesen mit User-Client (prüft per RLS, dass es zum Tenant gehört)
  const { data: email, error: fetchError } = await supabase
    .from("emails")
    .select("imap_uid")
    .eq("id", id)
    .single();

  if (fetchError || !email) {
    return NextResponse.json(
      { error: "E-Mail nicht gefunden oder keine Berechtigung" },
      { status: 404 }
    );
  }

  let imapError: string | null = null;
  if (email.imap_uid) {
    const credentials = await getImapCredentials(user.id);
    if (credentials) {
      const result = await deleteImapEmail(credentials, email.imap_uid);
      if (!result.ok) {
        imapError = result.error ?? "Unbekannter IMAP-Fehler";
        console.error("[DELETE] IMAP-Löschfehler:", imapError);
      }
    }
  }

  const admin = createAdminClient();

  if (email.imap_uid) {
    const { data: account } = await admin
      .from("email_accounts")
      .select("deleted_uids")
      .eq("user_id", user.id)
      .single();

    const deletedUids: number[] = (account?.deleted_uids as number[]) ?? [];
    if (!deletedUids.includes(email.imap_uid)) {
      deletedUids.push(email.imap_uid);
      await admin
        .from("email_accounts")
        .update({ deleted_uids: deletedUids })
        .eq("user_id", user.id);
    }
  }

  // Soft-Delete via Admin-Client (umgeht RLS-Stille); Tenant-Match doppelt absichern
  const { data: deleted, error: deleteError } = await admin
    .from("emails")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: "E-Mail konnte nicht gelöscht werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    ...(imapError ? { warning: `E-Mail als gelöscht markiert, aber IMAP-Fehler: ${imapError}` } : {}),
  });
}
