import { NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized, withAuth } from "@/lib/supabase/api";
import { berechneMassnahme } from "@/lib/optimization/engine";
import { bubbleMatrix, gruppiereNachKlasse, priorisiere } from "@/lib/optimization/priorisierung";
import { ladeKontext, ladeObjektMassnahmen, ladeSzenarioMassnahmen } from "@/lib/optimization/server-load";

// GET /api/optimization/priorisierung?property_id=<uuid>&szenario_id=<uuid>
// Aufwand-Wirkung-Rangliste + Bubble-Matrix. Mit szenario_id nur die Szenario-Maßnahmen.
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  const szenarioId = request.nextUrl.searchParams.get("szenario_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const stichtag = new Date().toISOString().split("T")[0];
  const ctx = await ladeKontext(supabase, propertyId, stichtag);
  if (!ctx) return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });

  const inputs = szenarioId
    ? await ladeSzenarioMassnahmen(supabase, szenarioId)
    : await ladeObjektMassnahmen(supabase, propertyId);
  const ergebnisse = inputs.map((m) => berechneMassnahme(m, ctx));

  return NextResponse.json({
    rangliste: priorisiere(ergebnisse),
    matrix: bubbleMatrix(ergebnisse),
    gruppen: gruppiereNachKlasse(priorisiere(ergebnisse)),
  });
}
