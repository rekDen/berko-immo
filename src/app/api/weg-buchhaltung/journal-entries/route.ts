import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

type LineInput = { account_id: string; debit?: number | null; credit?: number | null; cost_type_id?: string | null; unit_id?: string | null; owner_id?: string | null };

// POST /api/weg-buchhaltung/journal-entries
// Body: { property_id, date, description, resolution_ref?, lines: LineInput[] }
// Freie Buchungssatz-Erfassung (weg-buchhaltung-spec.md 5.8.4) — für Vorgänge,
// die keine einzelne Transaction sind: Umbuchungen zwischen zwei
// Bestandskonten, Korrekturbuchungen, Rückstellungen. Mindestens zwei Zeilen,
// Σ debit = Σ credit wird zusätzlich DB-seitig durch den Trigger auf
// journal_entry_lines erzwungen (5.8.2) — hier nur eine frühe, freundlichere
// Fehlermeldung vor dem Insert.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  const { property_id, date, description, resolution_ref, lines } = body as {
    property_id?: string; date?: string; description?: string; resolution_ref?: string; lines?: LineInput[];
  };
  if (!property_id || !date || !description || !Array.isArray(lines) || lines.length < 2) {
    return badRequest("Pflichtfelder: property_id, date, description, lines (mind. 2 Zeilen)");
  }
  for (const l of lines) {
    if (!l.account_id) return badRequest("Jede Zeile benötigt account_id");
    const hasDebit = l.debit !== undefined && l.debit !== null;
    const hasCredit = l.credit !== undefined && l.credit !== null;
    if (hasDebit === hasCredit) return badRequest("Jede Zeile braucht genau eines von debit oder credit");
    if ((l.debit ?? 0) < 0 || (l.credit ?? 0) < 0) return badRequest("debit/credit dürfen nicht negativ sein");
  }
  const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (totalDebit !== totalCredit) {
    return badRequest(`Buchungssatz nicht ausgeglichen: Soll ${totalDebit} Cent ≠ Haben ${totalCredit} Cent`);
  }

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id,
      date,
      description,
      resolution_ref: resolution_ref ?? null,
    })
    .select("id")
    .single();
  if (entryErr || !entry) return NextResponse.json({ error: entryErr?.message ?? "Buchungssatz konnte nicht angelegt werden" }, { status: 500 });

  const { error: linesErr } = await supabase.from("journal_entry_lines").insert(
    lines.map((l) => ({
      tenant_id: tenantId,
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: l.debit ?? null,
      credit: l.credit ?? null,
      cost_type_id: l.cost_type_id ?? null,
      unit_id: l.unit_id ?? null,
      owner_id: l.owner_id ?? null,
    }))
  );
  if (linesErr) {
    // Best-effort — journal_entries hat bewusst keine DELETE-Policy
    // (append-only Ledger), s. Kommentar in src/lib/weg-buchhaltung/posting.ts.
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return NextResponse.json({ error: linesErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: entry.id }, { status: 201 });
}
