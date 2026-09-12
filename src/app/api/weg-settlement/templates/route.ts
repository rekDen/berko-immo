import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { DEFAULT_ANSCHREIBEN_SUBJECT, DEFAULT_ANSCHREIBEN_BODY, DEFAULT_BESCHLUSSVORLAGE_BODY } from "@/lib/weg-settlement/template";

const DEFAULTS: Record<"anschreiben" | "beschlussvorlage", { subject: string | null; body: string }> = {
  anschreiben: { subject: DEFAULT_ANSCHREIBEN_SUBJECT, body: DEFAULT_ANSCHREIBEN_BODY },
  beschlussvorlage: { subject: null, body: DEFAULT_BESCHLUSSVORLAGE_BODY },
};

// GET /api/weg-settlement/templates
// Liefert die gespeicherten Vorlagen des Mandanten, ergänzt um die
// eingebauten Defaults für noch nicht angepasste Vorlagenarten (Spec 8.3:
// "pflegbare Vorlagen" — ein Mandant ohne eigene Anpassung bekommt trotzdem
// sinnvollen Text, keine leere Vorlage).
export async function GET() {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { data, error } = await supabase
    .from("weg_settlement_templates")
    .select("kind, subject, body, updated_at")
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byKind = new Map((data ?? []).map((t) => [t.kind, t]));
  const result = (["anschreiben", "beschlussvorlage"] as const).map((kind) => {
    const saved = byKind.get(kind);
    return {
      kind,
      subject: saved?.subject ?? DEFAULTS[kind].subject,
      body: saved?.body ?? DEFAULTS[kind].body,
      isDefault: !saved,
      updatedAt: saved?.updated_at ?? null,
    };
  });
  return NextResponse.json(result);
}

// PUT /api/weg-settlement/templates
// Body: { kind: 'anschreiben' | 'beschlussvorlage', subject?: string | null, body: string }
export async function PUT(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const payload = await request.json();
  if (payload.kind !== "anschreiben" && payload.kind !== "beschlussvorlage") {
    return badRequest("kind muss 'anschreiben' oder 'beschlussvorlage' sein");
  }
  if (!payload.body || typeof payload.body !== "string") {
    return badRequest("Pflichtfeld: body");
  }

  const { data, error } = await supabase
    .from("weg_settlement_templates")
    .upsert(
      { tenant_id: tenantId, kind: payload.kind, subject: payload.subject ?? null, body: payload.body, updated_by: user.id },
      { onConflict: "tenant_id,kind" },
    )
    .select("kind, subject, body, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
