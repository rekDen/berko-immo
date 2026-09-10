// Brücke zwischen DB und reiner Engine: lädt Objekt, Rent-Roll und gültiges
// Regelwerk aus Supabase in einen EngineContext bzw. die Maßnahmen-Inputs.
// Bleibt außerhalb der Engine, damit diese DB-frei & testbar bleibt.
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterGueltig } from "./constraints";
import type { EngineContext, MassnahmeInput, Objekt, Regel } from "./types";

/** Standardfaktor, falls am Objekt (noch) kein Objektfaktor gepflegt ist. */
export const DEFAULT_OBJEKTFAKTOR = 20;

export async function ladeKontext(
  supabase: SupabaseClient,
  propertyId: string,
  stichtag: string,
): Promise<EngineContext | null> {
  const { data: p } = await supabase
    .from("properties")
    .select("id, objektfaktor, living_area, total_area, is_monument, erhaltungssatzung, gemeinde_id, monthly_management_costs, kaufpreis_eur, erwerbsnebenkosten_eur, eingesetztes_ek_eur, fremdkapital_eur, fk_zins_pct")
    .eq("id", propertyId)
    .single();
  if (!p) return null;

  const objekt: Objekt = {
    id: p.id,
    objektfaktor: p.objektfaktor ?? DEFAULT_OBJEKTFAKTOR,
    wohnflaeche_qm: p.living_area ?? p.total_area ?? null,
    denkmalschutz: p.is_monument ?? false,
    erhaltungssatzung: p.erhaltungssatzung ?? false,
    nicht_umlagefaehige_kosten_pa_eur: p.monthly_management_costs ? Number(p.monthly_management_costs) * 12 : 0,
    kaufpreis_eur: p.kaufpreis_eur ? Number(p.kaufpreis_eur) : null,
    erwerbsnebenkosten_eur: p.erwerbsnebenkosten_eur ? Number(p.erwerbsnebenkosten_eur) : null,
    eingesetztes_ek_eur: p.eingesetztes_ek_eur ? Number(p.eingesetztes_ek_eur) : null,
    fremdkapital_eur: p.fremdkapital_eur ? Number(p.fremdkapital_eur) : null,
    fk_zins_pct: p.fk_zins_pct ? Number(p.fk_zins_pct) : null,
  };

  const { data: mv } = await supabase
    .from("mietvertrag")
    .select("id, unit_id, mietart, kaltmiete_eur, leerstand, letzte_erhoehung, units!inner(property_id)")
    .eq("units.property_id", propertyId);

  const mietvertraege = (mv ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    unit_id: r.unit_id as string,
    mietart: r.mietart as "standard" | "index" | "staffel",
    kaltmiete_eur: Number(r.kaltmiete_eur),
    leerstand: Boolean(r.leerstand),
    letzte_erhoehung: (r.letzte_erhoehung as string | null) ?? null,
  }));

  let regeln: Regel[] = [];
  if (p.gemeinde_id) {
    const { data: rw } = await supabase
      .from("regelwerk")
      .select("regel_code, parameter, gueltig_von, gueltig_bis, quelle")
      .eq("gemeinde_id", p.gemeinde_id);
    regeln = filterGueltig((rw ?? []) as Regel[], stichtag);
  }

  return { objekt, mietvertraege, regeln, stichtag };
}

/** Lädt die Maßnahmen eines Szenarios als Engine-Inputs (inkl. Katalog-Metadaten). */
export async function ladeSzenarioMassnahmen(
  supabase: SupabaseClient,
  szenarioId: string,
): Promise<MassnahmeInput[]> {
  const { data } = await supabase
    .from("szenario_massnahme")
    .select("massnahme:massnahme_id ( id, typ_code, params, massnahme_typ ( kategorie, klasse, constraint_codes, label ) )")
    .eq("szenario_id", szenarioId);

  return (data ?? []).map((row: Record<string, unknown>) => mapMassnahme(row.massnahme as Record<string, unknown>));
}

/** Lädt alle Maßnahmen eines Objekts als Engine-Inputs (für die Priorisierung). */
export async function ladeObjektMassnahmen(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<MassnahmeInput[]> {
  const { data } = await supabase
    .from("massnahme")
    .select("id, typ_code, params, massnahme_typ ( kategorie, klasse, constraint_codes, label )")
    .eq("property_id", propertyId);

  return (data ?? []).map((row: Record<string, unknown>) => mapMassnahme(row));
}

function mapMassnahme(m: Record<string, unknown>): MassnahmeInput {
  const t = (m.massnahme_typ ?? {}) as Record<string, unknown>;
  return {
    id: m.id as string,
    typ_code: m.typ_code as string,
    kategorie: (t.kategorie as MassnahmeInput["kategorie"]) ?? "zusatzerloes",
    klasse: (t.klasse as MassnahmeInput["klasse"]) ?? "quick_win",
    constraint_codes: (t.constraint_codes as string[]) ?? [],
    label: t.label as string | undefined,
    params: (m.params as MassnahmeInput["params"]) ?? {},
  };
}
