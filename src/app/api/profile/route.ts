import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/profile
export async function GET() {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, name, firm_name, initials, signature_html, signature_text, role, language")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, email: user.email });
}

// PATCH /api/profile
export async function PATCH(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const body = await request.json();
  const { first_name, last_name, firm_name, signature_html, signature_text } = body;

  if (typeof first_name !== "string" && first_name !== null) return badRequest("Vorname fehlt");
  if (typeof last_name !== "string" && last_name !== null) return badRequest("Nachname fehlt");

  const fullName = [first_name, last_name].filter((v) => v && v.trim()).join(" ").trim();
  const initials = [first_name, last_name]
    .filter((v) => v && v.trim())
    .map((v: string) => v.trim()[0]?.toUpperCase())
    .join("");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: first_name || null,
      last_name: last_name || null,
      name: fullName || user.email || "Unbenannt",
      initials: initials || null,
      firm_name: firm_name ?? null,
      signature_html: signature_html ?? null,
      signature_text: signature_text ?? null,
    })
    .eq("id", user.id)
    .select("id, first_name, last_name, name, firm_name, initials, signature_html, signature_text")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
