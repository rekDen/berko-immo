import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/profile/password
// Body: { currentPassword: string, newPassword: string }
export async function POST(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user || !user.email) return unauthorized();

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) return badRequest("Aktuelles und neues Passwort erforderlich");
  if (newPassword.length < 8) return badRequest("Neues Passwort muss mindestens 8 Zeichen lang sein");

  // Aktuelles Passwort verifizieren, bevor das neue gesetzt wird
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) return badRequest("Aktuelles Passwort ist falsch");

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
