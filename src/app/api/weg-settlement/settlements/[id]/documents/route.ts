import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { GesamtabrechnungPDF } from "@/lib/weg-settlement/pdf/GesamtabrechnungPDF";
import { EinzelabrechnungPDF } from "@/lib/weg-settlement/pdf/EinzelabrechnungPDF";
import { VermoegensberichtPDF } from "@/lib/weg-settlement/pdf/VermoegensberichtPDF";
import { buildRenterExportRows, renterExportToCsv, renterExportToXlsxBuffer } from "@/lib/weg-settlement/export/renter-export";
import { AnschreibenPDF } from "@/lib/weg-settlement/pdf/AnschreibenPDF";
import { BeschlussvorlagePDF } from "@/lib/weg-settlement/pdf/BeschlussvorlagePDF";
import {
  renderTemplate, splitParagraphs, buildAnschreibenVars, buildBeschlussvorlageVars,
  DEFAULT_ANSCHREIBEN_SUBJECT, DEFAULT_ANSCHREIBEN_BODY, DEFAULT_BESCHLUSSVORLAGE_BODY,
} from "@/lib/weg-settlement/template";
import { mergePdfBuffers, buildZipBuffer, type ZipFileEntry } from "@/lib/weg-settlement/bundle";
import { naturalCompare } from "@/lib/weg-settlement/allocation";

// Kategorien aus scripts/migration-weg-settlement-document-categories.sql,
// scripts/migration-weg-settlement-renter-export-category.sql,
// scripts/migration-weg-settlement-templates.sql und
// scripts/migration-weg-settlement-bundle-category.sql
const CATEGORY = {
  gesamtabrechnung: "dc000000-0000-0000-0014-000000000001",
  einzelabrechnung: "dc000000-0000-0000-0014-000000000002",
  vermoegensbericht: "dc000000-0000-0000-0014-000000000003",
  vermieterExport: "dc000000-0000-0000-0014-000000000004",
  anschreiben: "dc000000-0000-0000-0014-000000000005",
  beschlussvorlage: "dc000000-0000-0000-0014-000000000006",
  sammelPdf: "dc000000-0000-0000-0014-000000000007",
  zipExport: "dc000000-0000-0000-0014-000000000008",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf", review: "In Prüfung", final: "Final", resolved: "Beschlossen", superseded: "Überholt",
};

// Form von `settlements.result_snapshot` nach dem jsonb-Roundtrip (jedes
// `Decimal`-Feld der Engine ist hier bereits `number`, s. serialize.ts toPlain()).
interface StoredUnitInfo {
  openAdvances: number; openSpecialLevies: number;
  par35a: { category: string; amount: number }[];
  apportionable: { betrkvNo: number; amount: number }[];
  nonApportionable: number;
  co2: { amount: number; landlordSharePct: number | null }[];
}
interface StoredUnitSettlement {
  unitId: string; costs: number; income: number; result: number; advancesSoll: number; balance: number; info: StoredUnitInfo;
}
interface StoredCostTypeBreakdown {
  costTypeId: string; direction: "expense" | "income"; total: number; allocationKeyId: string | null;
  keyTotalWeight: number | null;
  perUnit: { unitId: string; weight: number | null; exactShare: number | null; amount: number }[];
}
interface StoredBankReconciliation {
  bankAccountId: string; openingBalance: number; totalIn: number; totalOut: number;
  computedClosing: number; confirmedClosing: number | null;
}
interface StoredReserveDevelopment {
  bankAccountId: string; openingBalance: number; sollZufuehrung: number; istZufuehrung: number;
  entnahmen: number; zinsen: number; computedClosing: number;
}
interface StoredAssetReport {
  bankBalances: { bankAccountId: string; kind: "operating" | "reserve"; balance: number | null }[];
  receivablesTotal: number;
  liabilities: { label: string; amount: number }[];
  otherAssets: { label: string; amount: number | null; note?: string }[];
}
interface StoredResult {
  year: number;
  costTypeBreakdowns: StoredCostTypeBreakdown[];
  units: StoredUnitSettlement[];
  bankReconciliations: StoredBankReconciliation[];
  reserveDevelopments: StoredReserveDevelopment[];
  assetReport: StoredAssetReport;
  overall: {
    advancePaymentsIst: number; specialLevyPaymentsIst: number; otherIncomeTotal: number;
    expenseTotal: number; internalTransfersNet: number; priorYearSettlementPayments: number;
  };
}

// GET /api/weg-settlement/settlements/[id]/documents
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { data: settlement, error: readErr } = await supabase.from("settlements").select("property_id, year").eq("id", id).single();
  if (readErr || !settlement) return badRequest("Abrechnung nicht gefunden");

  const { data, error } = await supabase
    .from("documents")
    .select("id, category_id, level, unit_id, title, storage_path, file_name, file_size, uploaded_at, document_categories ( name_de )")
    .eq("property_id", settlement.property_id)
    .eq("fiscal_year", settlement.year)
    .in("category_id", [
      CATEGORY.gesamtabrechnung, CATEGORY.einzelabrechnung, CATEGORY.vermoegensbericht,
      CATEGORY.vermieterExport, CATEGORY.anschreiben, CATEGORY.beschlussvorlage,
      CATEGORY.sammelPdf, CATEGORY.zipExport,
    ])
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/weg-settlement/settlements/[id]/documents
// Erzeugt Gesamtabrechnung, Vermögensbericht und je eine Einzelabrechnung pro
// Einheit als PDF (Kapitel 8.3) und legt sie im DMS ab (documents-Tabelle,
// nicht das Legacy-folders/files-System, s. hausgeldabrechnung-plan.md
// Abschnitt 4). Nur ab Status 'final'/'resolved' — die Spec verlangt, dass
// PDFs ausschließlich aus dem eingefrorenen Snapshot erzeugt werden (8.1).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const { data: settlement, error: readErr } = await supabase.from("settlements").select().eq("id", id).single();
  if (readErr || !settlement) return badRequest("Abrechnung nicht gefunden");
  if (settlement.status !== "final" && settlement.status !== "resolved") {
    return badRequest("Dokumente können erst ab Status 'Final' erzeugt werden — der Snapshot muss eingefroren sein (Spec 8.1)");
  }
  if (!settlement.result_snapshot) return badRequest("Abrechnung hat keinen Snapshot");

  const result = settlement.result_snapshot as StoredResult;
  const statusLabel = STATUS_LABELS[settlement.status] ?? settlement.status;

  const [{ data: property }, { data: costTypes }, { data: allocationKeys }, { data: bankAccounts }, { data: settlementUnits }, { data: templateRows }] = await Promise.all([
    supabase.from("properties").select("name").eq("id", settlement.property_id).single(),
    supabase.from("cost_types").select("id, name, betrkv_no, apportionable").eq("property_id", settlement.property_id),
    supabase.from("allocation_keys").select("id, name").eq("property_id", settlement.property_id),
    supabase.from("community_bank_accounts").select("id, label, kind").eq("property_id", settlement.property_id),
    supabase.from("settlement_units").select("unit_id, addressee_owner_id, units ( unit_number, mea )").eq("settlement_id", id),
    supabase.from("weg_settlement_templates").select("kind, subject, body").eq("tenant_id", tenantId),
  ]);

  const templateByKind = new Map((templateRows ?? []).map((t) => [t.kind as string, t]));
  const anschreibenSubjectTpl = (templateByKind.get("anschreiben")?.subject as string | null) ?? DEFAULT_ANSCHREIBEN_SUBJECT;
  const anschreibenBodyTpl = (templateByKind.get("anschreiben")?.body as string | undefined) ?? DEFAULT_ANSCHREIBEN_BODY;
  const beschlussvorlageBodyTpl = (templateByKind.get("beschlussvorlage")?.body as string | undefined) ?? DEFAULT_BESCHLUSSVORLAGE_BODY;

  const propertyName = property?.name ?? "Objekt";
  const costTypeById = new Map((costTypes ?? []).map((c) => [c.id, c.name as string]));
  const costTypeMetaById = new Map(
    (costTypes ?? []).map((c) => [
      c.id as string,
      { name: c.name as string, betrkvNo: c.betrkv_no as number | null, apportionable: c.apportionable as boolean },
    ]),
  );
  const keyById = new Map((allocationKeys ?? []).map((k) => [k.id, k.name as string]));
  const bankById = new Map((bankAccounts ?? []).map((b) => [b.id, b as { label: string; kind: "operating" | "reserve" }]));

  // ── Gesamtabrechnung ──────────────────────────────────────────────────
  const expenseRows = result.costTypeBreakdowns
    .filter((b) => b.direction === "expense")
    .map((b) => ({ name: costTypeById.get(b.costTypeId) ?? b.costTypeId, amount: b.total }));
  const incomeRows = result.costTypeBreakdowns
    .filter((b) => b.direction === "income")
    .map((b) => ({ name: costTypeById.get(b.costTypeId) ?? b.costTypeId, amount: b.total }));
  const gesamtBankAccounts = result.bankReconciliations.map((r) => ({
    label: bankById.get(r.bankAccountId)?.label ?? r.bankAccountId,
    kind: bankById.get(r.bankAccountId)?.kind ?? ("operating" as const),
    openingBalance: r.openingBalance, totalIn: r.totalIn, totalOut: r.totalOut,
    computedClosing: r.computedClosing, confirmedClosing: r.confirmedClosing,
  }));

  const gesamtBuffer = await renderToBuffer(
    React.createElement(GesamtabrechnungPDF, {
      propertyName, year: result.year, statusLabel, bankAccounts: gesamtBankAccounts, expenseRows, incomeRows, overall: result.overall,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );

  // ── Vermögensbericht ──────────────────────────────────────────────────
  const vermReserves = result.reserveDevelopments.map((r) => ({
    label: bankById.get(r.bankAccountId)?.label ?? r.bankAccountId,
    openingBalance: r.openingBalance, sollZufuehrung: r.sollZufuehrung, istZufuehrung: r.istZufuehrung,
    entnahmen: r.entnahmen, zinsen: r.zinsen, computedClosing: r.computedClosing,
  }));
  const vermBankBalances = result.assetReport.bankBalances.map((b) => ({
    label: bankById.get(b.bankAccountId)?.label ?? b.bankAccountId, kind: b.kind, balance: b.balance,
  }));

  const vermBuffer = await renderToBuffer(
    React.createElement(VermoegensberichtPDF, {
      propertyName, year: result.year, statusLabel, bankBalances: vermBankBalances, reserves: vermReserves,
      receivablesTotal: result.assetReport.receivablesTotal,
      liabilities: result.assetReport.liabilities, otherAssets: result.assetReport.otherAssets,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );

  // ── Beschlussvorlage (Kapitel 8.3 Erweiterung B) ───────────────────────
  const gesamteinnahmen = result.overall.advancePaymentsIst + result.overall.specialLevyPaymentsIst + result.overall.otherIncomeTotal;
  const beschlussvorlageVars = buildBeschlussvorlageVars({
    objektName: propertyName, jahr: result.year,
    gesamtkostenCents: result.overall.expenseTotal, gesamteinnahmenCents: gesamteinnahmen,
  });
  const beschlussvorlageBuffer = await renderToBuffer(
    React.createElement(BeschlussvorlagePDF, {
      propertyName, year: result.year,
      bodyParagraphs: splitParagraphs(renderTemplate(beschlussvorlageBodyTpl, beschlussvorlageVars)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );

  const { data: batch, error: batchErr } = await supabase
    .from("document_batches")
    .insert({
      tenant_id: tenantId, created_by: user.id,
      name: `Jahresabrechnung ${result.year} — ${propertyName}`,
      batch_type: "mass_upload", target_level: "property", status: "completed",
    })
    .select("id")
    .single();
  if (batchErr || !batch) return NextResponse.json({ error: batchErr?.message ?? "Sammelvorgang konnte nicht angelegt werden" }, { status: 500 });

  const created: { id: string; title: string }[] = [];
  // Für Sammel-PDF/ZIP (Kapitel 8.3 Erweiterung C) parallel gesammelt.
  const pdfBuffersForSammel: Buffer[] = [];
  const zipEntries: ZipFileEntry[] = [];

  const sortedSettlementUnits = [...(settlementUnits ?? [])].sort((a, b) => {
    const aNum = (a.units as unknown as { unit_number: string } | null)?.unit_number ?? "";
    const bNum = (b.units as unknown as { unit_number: string } | null)?.unit_number ?? "";
    return naturalCompare(aNum, bNum);
  });

  async function saveDocument(opts: {
    buffer: Buffer; categoryId: string; level: "property" | "unit"; unitId?: string; title: string; fileName: string;
    mimeType?: string; extension?: string;
  }) {
    const ext = opts.extension ?? "pdf";
    const mimeType = opts.mimeType ?? "application/pdf";
    const storagePath = opts.level === "property"
      ? `${settlement.property_id}/property/${opts.categoryId}/${randomUUID()}.${ext}`
      : `${settlement.property_id}/unit/${opts.unitId}/${opts.categoryId}/${randomUUID()}.${ext}`;

    const { error: upErr } = await supabase!.storage.from("documents").upload(storagePath, opts.buffer, { contentType: mimeType });
    if (upErr) throw new Error(upErr.message);

    const { data: doc, error: docErr } = await supabase!
      .from("documents")
      .insert({
        tenant_id: tenantId, created_by: user!.id, uploaded_by: user!.id,
        category_id: opts.categoryId, level: opts.level,
        property_id: settlement.property_id,
        unit_id: opts.level === "unit" ? opts.unitId : null,
        title: opts.title, storage_path: storagePath, file_name: opts.fileName,
        file_size: opts.buffer.length, mime_type: mimeType,
        fiscal_year: result.year, batch_id: batch!.id,
      })
      .select("id, title")
      .single();
    if (docErr || !doc) throw new Error(docErr?.message ?? "Dokument konnte nicht gespeichert werden");
    created.push(doc);
  }

  try {
    const gesamtFileName = `Gesamtabrechnung_${result.year}.pdf`;
    await saveDocument({
      buffer: gesamtBuffer as Buffer, categoryId: CATEGORY.gesamtabrechnung, level: "property",
      title: `Gesamtabrechnung ${result.year}`, fileName: gesamtFileName,
    });
    pdfBuffersForSammel.push(gesamtBuffer as Buffer);
    zipEntries.push({ path: gesamtFileName, buffer: gesamtBuffer as Buffer });

    const vermFileName = `Vermoegensbericht_${result.year}.pdf`;
    await saveDocument({
      buffer: vermBuffer as Buffer, categoryId: CATEGORY.vermoegensbericht, level: "property",
      title: `Vermögensbericht ${result.year}`, fileName: vermFileName,
    });
    pdfBuffersForSammel.push(vermBuffer as Buffer);
    zipEntries.push({ path: vermFileName, buffer: vermBuffer as Buffer });

    const beschlussFileName = `Beschlussvorlage_${result.year}.pdf`;
    await saveDocument({
      buffer: beschlussvorlageBuffer as Buffer, categoryId: CATEGORY.beschlussvorlage, level: "property",
      title: `Beschlussvorlage ${result.year}`, fileName: beschlussFileName,
    });
    pdfBuffersForSammel.push(beschlussvorlageBuffer as Buffer);
    zipEntries.push({ path: beschlussFileName, buffer: beschlussvorlageBuffer as Buffer });

    for (const su of sortedSettlementUnits) {
      const unitInfo = su.units as unknown as { unit_number: string; mea: number | null } | null;
      const unitNumber = unitInfo?.unit_number ?? "?";
      const unitResult = result.units.find((u) => u.unitId === su.unit_id);
      if (!unitResult) continue;

      let addresseeName = "Unbekannter Eigentümer";
      let addresseeAddress: string | null = null;
      if (su.addressee_owner_id) {
        const { data: contact } = await supabase
          .from("contacts").select("first_name, last_name, company_name, addresses")
          .eq("id", su.addressee_owner_id).single();
        if (contact) {
          addresseeName = contact.company_name ?? ([contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unbekannter Eigentümer");
          const addr = (contact.addresses as { street?: string; house_number?: string; zip_code?: string; city?: string }[] | null)?.[0];
          if (addr) addresseeAddress = `${addr.street ?? ""} ${addr.house_number ?? ""}, ${addr.zip_code ?? ""} ${addr.city ?? ""}`.trim();
        }
      }

      const costRows = result.costTypeBreakdowns.map((b) => {
        const perUnit = b.perUnit.find((p) => p.unitId === su.unit_id);
        return {
          costTypeName: costTypeById.get(b.costTypeId) ?? b.costTypeId,
          allocationKeyName: b.allocationKeyId ? keyById.get(b.allocationKeyId) ?? null : null,
          total: b.total,
          keyTotalWeight: b.keyTotalWeight,
          unitWeight: perUnit?.weight ?? null,
          share: perUnit?.amount ?? 0,
          direction: b.direction,
        };
      });

      const einzelBuffer = await renderToBuffer(
        React.createElement(EinzelabrechnungPDF, {
          propertyName, year: result.year, unitNumber, coOwnershipShare: unitInfo?.mea ?? null,
          addresseeName, addresseeAddress, statusLabel, costRows,
          costs: unitResult.costs, income: unitResult.income, result: unitResult.result,
          advancesSoll: unitResult.advancesSoll, balance: unitResult.balance, info: unitResult.info,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      );

      const einzelFileName = `Einzelabrechnung_${result.year}_${unitNumber}.pdf`;
      await saveDocument({
        buffer: einzelBuffer as Buffer, categoryId: CATEGORY.einzelabrechnung, level: "unit", unitId: su.unit_id,
        title: `Einzelabrechnung ${result.year} — Einheit ${unitNumber}`,
        fileName: einzelFileName,
      });
      pdfBuffersForSammel.push(einzelBuffer as Buffer);
      zipEntries.push({ path: `Einheiten/${unitNumber}/${einzelFileName}`, buffer: einzelBuffer as Buffer });

      // ── Anschreiben (Kapitel 8.3 Erweiterung B) ──────────────────────
      const anschreibenVars = buildAnschreibenVars({
        objektName: propertyName, jahr: result.year, einheit: unitNumber, spitzeCents: unitResult.balance,
      });
      const anschreibenBuffer = await renderToBuffer(
        React.createElement(AnschreibenPDF, {
          propertyName, year: result.year, unitNumber, addresseeName, addresseeAddress,
          subject: renderTemplate(anschreibenSubjectTpl, anschreibenVars),
          bodyParagraphs: splitParagraphs(renderTemplate(anschreibenBodyTpl, anschreibenVars)),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      );
      const anschreibenFileName = `Anschreiben_${result.year}_${unitNumber}.pdf`;
      await saveDocument({
        buffer: anschreibenBuffer as Buffer, categoryId: CATEGORY.anschreiben, level: "unit", unitId: su.unit_id,
        title: `Anschreiben ${result.year} — Einheit ${unitNumber}`,
        fileName: anschreibenFileName,
      });
      pdfBuffersForSammel.push(anschreibenBuffer as Buffer);
      zipEntries.push({ path: `Einheiten/${unitNumber}/${anschreibenFileName}`, buffer: anschreibenBuffer as Buffer });

      // ── Vermieter-Export (CSV/XLSX, Kapitel 8.3) ─────────────────────
      const renterRows = buildRenterExportRows(su.unit_id, result.costTypeBreakdowns, unitResult.info, costTypeMetaById);
      const renterCsv = renterExportToCsv(renterRows);
      const renterCsvBuffer = Buffer.from(renterCsv, "utf-8");
      const renterCsvFileName = `Vermieterexport_${result.year}_${unitNumber}.csv`;
      await saveDocument({
        buffer: renterCsvBuffer, categoryId: CATEGORY.vermieterExport, level: "unit", unitId: su.unit_id,
        title: `Vermieter-Export ${result.year} — Einheit ${unitNumber} (CSV)`,
        fileName: renterCsvFileName,
        mimeType: "text/csv", extension: "csv",
      });
      zipEntries.push({ path: `Einheiten/${unitNumber}/${renterCsvFileName}`, buffer: renterCsvBuffer });

      const renterXlsx = renterExportToXlsxBuffer(renterRows, unitNumber);
      const renterXlsxFileName = `Vermieterexport_${result.year}_${unitNumber}.xlsx`;
      await saveDocument({
        buffer: renterXlsx, categoryId: CATEGORY.vermieterExport, level: "unit", unitId: su.unit_id,
        title: `Vermieter-Export ${result.year} — Einheit ${unitNumber} (XLSX)`,
        fileName: renterXlsxFileName,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx",
      });
      zipEntries.push({ path: `Einheiten/${unitNumber}/${renterXlsxFileName}`, buffer: renterXlsx });
    }

    // ── Sammel-PDF und ZIP (Kapitel 8.3 Erweiterung C) ─────────────────
    const sammelBuffer = await mergePdfBuffers(pdfBuffersForSammel);
    await saveDocument({
      buffer: sammelBuffer, categoryId: CATEGORY.sammelPdf, level: "property",
      title: `Sammel-PDF ${result.year}`, fileName: `Sammelabrechnung_${result.year}.pdf`,
    });

    const zipBuffer = await buildZipBuffer(zipEntries);
    await saveDocument({
      buffer: zipBuffer, categoryId: CATEGORY.zipExport, level: "property",
      title: `ZIP-Export ${result.year}`, fileName: `Jahresabrechnung_${result.year}.zip`,
      mimeType: "application/zip", extension: "zip",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "PDF-Erzeugung fehlgeschlagen", created }, { status: 500 });
  }

  return NextResponse.json({ batchId: batch.id, documents: created }, { status: 201 });
}
