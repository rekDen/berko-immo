import { NextRequest, NextResponse } from "next/server";
import { unauthorized, withAuth } from "@/lib/supabase/api";
import { berechneSzenario } from "@/lib/optimization/engine";
import { ladeKontext, ladeSzenarioMassnahmen } from "@/lib/optimization/server-load";

type Params = { params: Promise<{ id: string }> };

// GET /api/optimization/szenarien/:id/vergleich
// Ist-Baseline vs. Szenario: Kennzahlen + Waterfall-Schritte (Ist → +Maßnahme → Potenzial).
export async function GET(_request: NextRequest, { params }: Params) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const { id } = await params;
  const { data: szenario } = await supabase
    .from("szenario")
    .select("id, name, property_id")
    .eq("id", id)
    .single();
  if (!szenario) return NextResponse.json({ error: "Szenario nicht gefunden" }, { status: 404 });

  const stichtag = new Date().toISOString().split("T")[0];
  const ctx = await ladeKontext(supabase, szenario.property_id, stichtag);
  if (!ctx) return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });

  const inputs = await ladeSzenarioMassnahmen(supabase, id);
  const ist = berechneSzenario([], ctx);
  const potenzial = berechneSzenario(inputs, ctx);

  // Waterfall: Verkehrswert Ist → je Maßnahme +Werthebel → Potenzial.
  const waterfall = [
    { label: "Ist", wert: ist.verkehrswert_eur, typ: "basis" as const },
    ...potenzial.massnahmen
      .filter((m) => m.zulaessigkeit !== "gesperrt" && m.werthebel_eur !== 0)
      .map((m) => ({ label: m.label ?? m.typ_code, wert: m.werthebel_eur, typ: "delta" as const })),
    { label: "Potenzial", wert: potenzial.verkehrswert_eur, typ: "summe" as const },
  ];

  return NextResponse.json({
    szenario: { id: szenario.id, name: szenario.name },
    ist,
    potenzial,
    waterfall,
    rent_roll: ctx.mietvertraege,
  });
}
