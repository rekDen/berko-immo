import type { SupabaseClient } from "@supabase/supabase-js";
import { pickAllocationTargets, splitAdvancePayment, type OpenReceivable, type ReceivableKind } from "./allocation-order";

/**
 * Löst den Eigentümer einer Einheit zu einem Stichtag auf (Schuldner laut
 * Ownership, B7.1/B7.4). Bevorzugt `is_primary`, dann die zuletzt begonnene
 * Rolle — dieselbe Regel wie bei der Sollstellungs-Erzeugung aus
 * PlanAdvance/SpecialLevyUnit. Gibt `null` zurück, wenn keine aktive
 * Eigentümerrolle gefunden wird (z. B. Datenlücke) — der Aufrufer entscheidet,
 * was dann passiert.
 */
export async function resolveOwnerId(
  supabase: SupabaseClient,
  unitId: string,
  atDate: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("contact_roles")
    .select("contact_id")
    .eq("unit_id", unitId)
    .eq("role", "owner")
    .lte("valid_from", atDate)
    .or(`valid_to.is.null,valid_to.gte.${atDate}`)
    .order("is_primary", { ascending: false })
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.contact_id ?? null;
}

/**
 * Ordnet eine bestätigte Zahlung (Transaction, amount > 0) den offenen
 * Sollstellungen (Receivable) des Eigentümers zu, nach B7.6 (Ausgleichs-
 * reihenfolge) und B7.7 (proportionale Aufteilung Bewirtschaftung/Rücklage
 * bei Hausgeld-Teilzahlungen). Einheitenübergreifend je Eigentümer (B7.6.2).
 *
 * Muss NACH dem Buchungssatz aufgerufen werden (postJournalEntryForTransaction),
 * damit die Transaction bereits `status = 'confirmed'` trägt. Wirft bei
 * Fehlern — der Aufrufer entscheidet über Fehlerbehandlung.
 */
export async function applyPaymentToReceivables(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    propertyId: string;
    transactionId: string;
    ownerId: string;
    amount: number; // Cents, > 0
    userId: string;
    explicitSpecialLevyId?: string | null;
    unitId?: string | null;
  },
): Promise<{ allocated: number; receivableIds: string[] }> {
  if (params.amount <= 0) return { allocated: 0, receivableIds: [] };

  const { data: openRows, error: openErr } = await supabase
    .from("receivables")
    .select("id, due_date, kind, amount, components, source_special_levy_unit_id")
    .eq("owner_id", params.ownerId)
    .eq("property_id", params.propertyId)
    .in("status", ["open", "partial"]);
  if (openErr) throw new Error(openErr.message);

  const rows = openRows ?? [];
  if (rows.length === 0) return { allocated: 0, receivableIds: [] };

  const { data: existingAllocs, error: allocErr } = await supabase
    .from("payment_allocations")
    .select("receivable_id, amount, components")
    .in("receivable_id", rows.map((r) => r.id))
    .is("reversed_at", null);
  if (allocErr) throw new Error(allocErr.message);

  const allocatedByReceivable = new Map<string, number>();
  const componentsAllocated = new Map<string, { operating: number; reserve: number }>();
  for (const a of existingAllocs ?? []) {
    allocatedByReceivable.set(a.receivable_id, (allocatedByReceivable.get(a.receivable_id) ?? 0) + a.amount);
    const c = a.components as { operating?: number; reserve?: number } | null;
    if (c) {
      const prev = componentsAllocated.get(a.receivable_id) ?? { operating: 0, reserve: 0 };
      componentsAllocated.set(a.receivable_id, {
        operating: prev.operating + (c.operating ?? 0),
        reserve: prev.reserve + (c.reserve ?? 0),
      });
    }
  }

  const openReceivables: OpenReceivable[] = rows.map((r) => ({
    id: r.id,
    dueDate: r.due_date,
    kind: r.kind as ReceivableKind,
    openAmount: Math.abs(r.amount) - (allocatedByReceivable.get(r.id) ?? 0),
  }));

  let explicitReceivableId: string | undefined;
  if (params.explicitSpecialLevyId && params.unitId) {
    const { data: levyUnit } = await supabase
      .from("special_levy_units")
      .select("id")
      .eq("levy_id", params.explicitSpecialLevyId)
      .eq("unit_id", params.unitId)
      .maybeSingle();
    if (levyUnit) {
      const match = rows.find((r) => r.source_special_levy_unit_id === levyUnit.id);
      if (match) explicitReceivableId = match.id;
    }
  }

  const targets = pickAllocationTargets(openReceivables, params.amount, explicitReceivableId);
  if (targets.length === 0) return { allocated: 0, receivableIds: [] };

  const rowsToInsert = targets.map((t) => {
    const receivable = rows.find((r) => r.id === t.receivableId)!;
    let components: { operating: number; reserve: number } | null = null;
    if (receivable.kind === "advance") {
      const original = (receivable.components as { operating: number; reserve: number } | null) ?? { operating: 0, reserve: 0 };
      const already = componentsAllocated.get(receivable.id) ?? { operating: 0, reserve: 0 };
      const operatingOpen = original.operating - already.operating;
      const reserveOpen = original.reserve - already.reserve;
      components = splitAdvancePayment(t.amount, operatingOpen, reserveOpen);
    }
    return {
      tenant_id: params.tenantId,
      transaction_id: params.transactionId,
      receivable_id: t.receivableId,
      amount: t.amount,
      components,
      created_by_kind: "auto" as const,
      created_by: params.userId,
    };
  });

  const { error: insertErr } = await supabase.from("payment_allocations").insert(rowsToInsert);
  if (insertErr) throw new Error(insertErr.message);

  return { allocated: targets.reduce((s, t) => s + t.amount, 0), receivableIds: targets.map((t) => t.receivableId) };
}
