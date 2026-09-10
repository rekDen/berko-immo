import { NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";
import { categorizeEmail } from "@/lib/imap";

// GET + POST /api/emails/recategorize
export async function GET() { return recategorize(); }
export async function POST() { return recategorize(); }

async function recategorize() {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { data: emails, error } = await supabase
    .from("emails")
    .select("id, subject, body");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!emails || emails.length === 0) return NextResponse.json({ updated: 0 });

  let updated = 0;
  for (const email of emails) {
    const category = await categorizeEmail(email.subject, email.body);
    const { error: updateError } = await supabase
      .from("emails")
      .update({ category, ai_categorized: true })
      .eq("id", email.id);

    if (!updateError) updated++;
  }

  return NextResponse.json({ updated });
}
