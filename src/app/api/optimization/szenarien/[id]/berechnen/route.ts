import { NextRequest, NextResponse } from "next/server";
import { unauthorized, withAuth } from "@/lib/supabase/api";
import { berechneSzenario } from "@/lib/optimization/engine";
import { ladeKontext, ladeSzenarioMassnahmen } from "@/lib/optimization/server-load";

type Params = { params: Promise<{ id: string }> };

// POST /api/optimization/szenarien/:id/berechnen
// Lädt Objekt + Maßnahmen + gültiges Regelwerk, führt die deterministische
// Engine aus, schreibt einen kennzahlen_snapshot und cached die Maßnahmenwerte.
export async function POST(_request: NextRequest, { params }: Params) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const { id } = await params;

  const { data: szenario } = await supabase
    .from("szenario")
    .select("id, property_id")
    .eq("id", id)
    .single();
  if (!szenario) return NextResponse.json({ error: "Szenario nicht gefunden" }, { status: 404 });

  const stichtag = new Date().toISOString().split("T")[0];
  const ctx = await ladeKontext(supabase, szenario.property_id, stichtag);
  if (!ctx) return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });

  const inputs = await ladeSzenarioMassnahmen(supabase, id);
  const snap = berechneSzenario(inputs, ctx);

  // Snapshot persistieren (Inputs für Reproduzierbarkeit mitspeichern).
  const { data: snapshot, error: snapErr } = await supabase
    .from("kennzahlen_snapshot")
    .insert({
      tenant_id: tenantId,
      szenario_id: id,
      noi_eur: snap.noi_eur,
      faktor: snap.faktor,
      verkehrswert_eur: snap.verkehrswert_eur,
      bruttorendite: snap.bruttorendite,
      nettorendite: snap.nettorendite,
      ek_rendite: snap.ek_rendite,
      irr: snap.irr,
      aufteilungsgewinn_eur: snap.aufteilungsgewinn_eur,
      afa_effekt_eur: snap.afa_effekt_eur,
      inputs: { ctx, inputs },
      engine_version: snap.engine_version,
    })
    .select()
    .single();
  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 });

  // Berechnete Werte je Maßnahme zurückschreiben (Cache).
  await Promise.all(
    snap.massnahmen.map((m) =>
      supabase
        .from("massnahme")
        .update({
          invest_eur: m.invest_eur,
          ertragswirkung_pa_eur: m.ertragswirkung_pa_eur,
          werthebel_eur: m.werthebel_eur,
          amortisation_jahre: m.amortisation_jahre,
          zulaessigkeit: m.zulaessigkeit,
        })
        .eq("id", m.massnahme_id),
    ),
  );

  return NextResponse.json({ snapshot, ergebnis: snap });
}
