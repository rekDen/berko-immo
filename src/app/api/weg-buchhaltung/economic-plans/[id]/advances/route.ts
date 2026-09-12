import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { dayBefore } from "@/lib/weg-buchhaltung/dates";
import { generateAdvanceMonths } from "@/lib/weg-buchhaltung/advance-schedule";

const DUE_DAY_OF_MONTH = 1; // Spec B7.2/6.2 "Standard Monatserster"; kein eigenes Feld im Wirtschaftsplan
const OPEN_ENDED_HORIZON_MONTHS = 12; // Spec B7.2: "bei offenem Ende rollierend für zwölf Monate"

function addMonths(iso: string, months: number): string {
  const [y, m] = iso.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

// POST /api/weg-buchhaltung/economic-plans/[id]/advances
// Body: { unit_id, monthly_operating, monthly_reserve, valid_from }
// Legt einen neuen Soll-Vorschuss je Einheit an. Existiert für dieselbe
// Einheit bereits ein aktiver Vorschuss (valid_to = null, gleich welchen
// Plans — die Gültigkeit ist planübergreifend fortlaufend, Spec 5.5.3),
// wird dessen valid_to auf den Vortag des neuen valid_from gesetzt.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id: planId } = await params;

  const body = await request.json();
  if (!body.unit_id || body.monthly_operating === undefined || body.monthly_reserve === undefined || !body.valid_from) {
    return badRequest("Pflichtfelder: unit_id, monthly_operating, monthly_reserve, valid_from");
  }
  if (!Number.isInteger(body.monthly_operating) || !Number.isInteger(body.monthly_reserve)) {
    return badRequest("monthly_operating/monthly_reserve müssen ganzzahlige Cent-Beträge sein");
  }

  const { data: plan, error: planErr } = await supabase
    .from("economic_plans").select("id, property_id").eq("id", planId).single();
  if (planErr || !plan) return badRequest("Wirtschaftsplan nicht gefunden");

  const { data: propertyPlans, error: propPlansErr } = await supabase
    .from("economic_plans").select("id").eq("property_id", plan.property_id);
  if (propPlansErr) return NextResponse.json({ error: propPlansErr.message }, { status: 500 });

  const { data: active, error: activeErr } = await supabase
    .from("plan_advances")
    .select("id, valid_from")
    .eq("unit_id", body.unit_id)
    .in("plan_id", (propertyPlans ?? []).map((p) => p.id))
    .is("valid_to", null)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });

  if (active && active.valid_from >= body.valid_from) {
    return badRequest("Es existiert bereits ein aktiver Vorschuss ab einem gleichen oder späteren Datum für diese Einheit");
  }

  if (active) {
    const { error: closeErr } = await supabase
      .from("plan_advances")
      .update({ valid_to: dayBefore(body.valid_from) })
      .eq("id", active.id);
    if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("plan_advances")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      plan_id: planId,
      unit_id: body.unit_id,
      monthly_operating: body.monthly_operating,
      monthly_reserve: body.monthly_reserve,
      valid_from: body.valid_from,
    })
    .select("id, plan_id, unit_id, monthly_operating, monthly_reserve, valid_from, valid_to, units ( unit_number )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sollstellungen erzeugen (B7.2). Bei Planänderung (B7.3): unbezahlte
  // Receivables ab valid_from werden storniert und neu erzeugt; bereits
  // teilweise/vollständig ausgeglichene bleiben unangetastet und werden
  // hier NICHT automatisch durch eine Anpassungssollstellung ergänzt — das
  // ist eine fachliche Detailregel (Differenzbildung je Monat), die nicht
  // unilateral entschieden wird. Solche Monate werden als "needsReview"
  // zurückgemeldet.
  let receivablesCreated = 0;
  const needsReview: string[] = [];

  if (body.monthly_operating > 0 || body.monthly_reserve > 0) {
    const { data: existingReceivables } = await supabase
      .from("receivables")
      .select("id, due_date, status")
      .eq("unit_id", body.unit_id)
      .eq("kind", "advance")
      .gte("due_date", body.valid_from);

    const openToCancel = (existingReceivables ?? []).filter((r) => r.status === "open");
    const notCancellable = (existingReceivables ?? []).filter((r) => r.status === "partial" || r.status === "settled");
    const coveredDueDates = new Set(notCancellable.map((r) => r.due_date));

    if (openToCancel.length > 0) {
      await supabase
        .from("receivables")
        .update({ status: "cancelled", cancelled_reason: `Planänderung: neuer Vorschuss ab ${body.valid_from}` })
        .in("id", openToCancel.map((r) => r.id));
    }
    for (const r of notCancellable) needsReview.push(r.due_date);

    const horizonEnd = body.valid_to ?? addMonths(body.valid_from, OPEN_ENDED_HORIZON_MONTHS);
    const months = generateAdvanceMonths({
      validFrom: body.valid_from,
      validTo: body.valid_to ?? null,
      horizonEnd,
      dueDayOfMonth: DUE_DAY_OF_MONTH,
      monthlyOperating: body.monthly_operating,
      monthlyReserve: body.monthly_reserve,
    }).filter((mo) => !coveredDueDates.has(mo.dueDate));

    const rows = [];
    for (const mo of months) {
      const { data: ownerRole } = await supabase
        .from("contact_roles")
        .select("contact_id, is_primary, valid_from")
        .eq("unit_id", body.unit_id)
        .eq("role", "owner")
        .lte("valid_from", mo.dueDate)
        .or(`valid_to.is.null,valid_to.gte.${mo.dueDate}`)
        .order("is_primary", { ascending: false })
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ownerRole) {
        needsReview.push(mo.dueDate);
        continue;
      }

      rows.push({
        tenant_id: tenantId,
        property_id: plan.property_id,
        unit_id: body.unit_id,
        owner_id: ownerRole.contact_id,
        kind: "advance",
        amount: mo.amount,
        components: { operating: mo.operating, reserve: mo.reserve },
        due_date: mo.dueDate,
        period_month: mo.periodMonth,
        source_plan_advance_id: data.id,
        created_by: user.id,
      });
    }

    if (rows.length > 0) {
      const { error: recErr } = await supabase.from("receivables").insert(rows);
      if (!recErr) receivablesCreated = rows.length;
    }
  }

  return NextResponse.json({ ...data, receivables_created: receivablesCreated, needs_review: needsReview }, { status: 201 });
}
