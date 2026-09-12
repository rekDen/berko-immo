// Server-only — nur von der API-Route importiert, s. styles.ts.
// Struktur nach Spec 8.3: Kopf, Kostentabelle (Kostenart/Gesamtbetrag/
// Schlüssel/Gesamtwert des Schlüssels/Wert der Einheit/Anteil der Einheit),
// hervorgehobener Ergebnisblock (K/E/R/V/S), klar abgesetzter Infoblock (5.4.5).
import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s, formatCents, formatDecimalWeight, MUTED } from "./styles";
import { PHeader, PFooter } from "./PageChrome";

export interface EinzelabrechnungCostRow {
  costTypeName: string;
  allocationKeyName: string | null;
  total: number;
  keyTotalWeight: number | null;
  unitWeight: number | null;
  share: number; // signed: positiv = Anteil an Ausgabe (K), wird bei Einnahmen als E geführt
  direction: "expense" | "income";
}

export interface EinzelabrechnungInfoBlock {
  openAdvances: number;
  openSpecialLevies: number;
  par35a: { category: string; amount: number }[];
  apportionable: { betrkvNo: number; amount: number }[];
  nonApportionable: number;
  co2: { amount: number; landlordSharePct: number | null }[];
}

export interface EinzelabrechnungProps {
  propertyName: string;
  year: number;
  unitNumber: string;
  coOwnershipShare: number | null;
  addresseeName: string;
  addresseeAddress: string | null;
  statusLabel: string;
  costRows: EinzelabrechnungCostRow[];
  costs: number;
  income: number;
  result: number;
  advancesSoll: number;
  balance: number;
  info: EinzelabrechnungInfoBlock;
}

const PAR35A_LABELS: Record<string, string> = {
  household_employment: "Haushaltsnahes Beschäftigungsverhältnis",
  household_service: "Haushaltsnahe Dienstleistung",
  craftsman: "Handwerkerleistung",
};

export function EinzelabrechnungPDF({
  propertyName, year, unitNumber, coOwnershipShare, addresseeName, addresseeAddress, statusLabel,
  costRows, costs, income, result, advancesSoll, balance, info,
}: EinzelabrechnungProps) {
  const title = `Einzelabrechnung ${year} — ${propertyName}, Einheit ${unitNumber}`;

  return (
    <Document title={title} producer="Berko AI">
      <Page size="A4" style={s.page}>
        <PHeader label="EINZELABRECHNUNG" title={title} page={1} total={1} />

        <View style={s.coverBlock}>
          <Text style={s.coverEyebrow}>WEG-JAHRESABRECHNUNG · EINZELABRECHNUNG</Text>
          <Text style={s.coverTitle}>{propertyName} — Einheit {unitNumber}</Text>
          <Text style={s.coverSubtitle}>Abrechnungsjahr {year} · Status: {statusLabel}</Text>
        </View>

        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Einheit</Text>
            <Text style={s.infoCellValue}>{unitNumber}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Miteigentumsanteil</Text>
            <Text style={s.infoCellValue}>{formatDecimalWeight(coOwnershipShare)}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Zeitraum</Text>
            <Text style={s.infoCellValue}>01.01.{year} – 31.12.{year}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Adressat</Text>
            <Text style={s.infoCellValue}>{addresseeName}</Text>
            {addresseeAddress && <Text style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>{addresseeAddress}</Text>}
          </View>
        </View>

        <View style={s.sectionBlock}>
          <Text style={s.sectionHead}>KOSTEN- UND EINNAHMENVERTEILUNG</Text>
        </View>
        <View style={s.table}>
          <View style={s.tableHeadRow}>
            <Text style={[s.tableHeadCell, { flex: 2.2 }]}>Kostenart</Text>
            <Text style={[s.tableHeadCell, { flex: 1.2 }]}>Schlüssel</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Gesamtbetrag</Text>
            <Text style={[s.tableHeadCell, { flex: 0.9, textAlign: "right" }]}>Gesamtwert</Text>
            <Text style={[s.tableHeadCell, { flex: 0.9, textAlign: "right" }]}>Wert Einheit</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Anteil</Text>
          </View>
          {costRows.map((r, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 2.2 }]}>{r.costTypeName}{r.direction === "income" ? " (Einnahme)" : ""}</Text>
              <Text style={[s.tableCell, { flex: 1.2, color: MUTED }]}>{r.allocationKeyName ?? "Messdienst"}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.total)}</Text>
              <Text style={[s.tableCellRight, { flex: 0.9 }]}>{formatDecimalWeight(r.keyTotalWeight)}</Text>
              <Text style={[s.tableCellRight, { flex: 0.9 }]}>{formatDecimalWeight(r.unitWeight)}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.share)}</Text>
            </View>
          ))}
        </View>

        <View style={s.resultBox}>
          <Text style={s.resultLabel}>ERGEBNIS</Text>
          <View style={s.resultRow}>
            <Text style={s.resultRowKey}>Kosten (K)</Text>
            <Text style={s.resultRowValue}>{formatCents(costs)}</Text>
          </View>
          <View style={s.resultRow}>
            <Text style={s.resultRowKey}>Einnahmen (E)</Text>
            <Text style={s.resultRowValue}>{formatCents(income)}</Text>
          </View>
          <View style={s.resultRow}>
            <Text style={s.resultRowKey}>Kostenergebnis (R = K - E)</Text>
            <Text style={s.resultRowValue}>{formatCents(result)}</Text>
          </View>
          <View style={s.resultRow}>
            <Text style={s.resultRowKey}>Soll-Vorschüsse (V)</Text>
            <Text style={s.resultRowValue}>{formatCents(advancesSoll)}</Text>
          </View>
          <View style={s.resultSpitzeRow}>
            <Text style={s.resultSpitzeKey}>Abrechnungsspitze (S = R - V)</Text>
            <Text style={[s.resultSpitzeValue, { color: balance > 0 ? "#b91c1c" : balance < 0 ? "#047857" : undefined }]}>
              {formatCents(balance)} {balance > 0 ? "(Nachschuss)" : balance < 0 ? "(Guthaben)" : ""}
            </Text>
          </View>
        </View>

        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerText}>
            Die folgenden Angaben sind nicht Gegenstand des Beschlusses und dienen nur der Information.
          </Text>
        </View>

        <View style={s.sectionBlock}>
          <Text style={s.sectionHead}>INFORMATIONSBLOCK</Text>
        </View>
        <View style={{ marginHorizontal: 36 }}>
          <Text style={s.bodyText}>Offene Vorschüsse (Rückstände): {formatCents(info.openAdvances)}</Text>
          <Text style={s.bodyText}>Offene Sonderumlagen: {formatCents(info.openSpecialLevies)}</Text>

          {info.apportionable.length > 0 && (
            <>
              <Text style={[s.bodyText, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>Umlagefähige Kosten nach § 2 BetrKV:</Text>
              {info.apportionable.map((a, i) => (
                <Text key={i} style={s.bodyText}>  Nr. {a.betrkvNo}: {formatCents(a.amount)}</Text>
              ))}
            </>
          )}
          <Text style={s.bodyText}>Nicht umlagefähige Kosten: {formatCents(info.nonApportionable)}</Text>

          {info.par35a.length > 0 && (
            <>
              <Text style={[s.bodyText, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>Ausweis nach § 35a EStG (haushaltsnahe Leistungen):</Text>
              {info.par35a.map((p, i) => (
                <Text key={i} style={s.bodyText}>  {PAR35A_LABELS[p.category] ?? p.category}: {formatCents(p.amount)}</Text>
              ))}
              <Text style={[s.mutedText, { marginTop: 2 }]}>Die steuerliche Würdigung obliegt dem Eigentümer.</Text>
            </>
          )}

          {info.co2.length > 0 && (
            <>
              <Text style={[s.bodyText, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>CO2-Kosten:</Text>
              {info.co2.map((c, i) => (
                <Text key={i} style={s.bodyText}>
                  {formatCents(c.amount)}{c.landlordSharePct !== null ? ` (Vermieteranteil ${formatDecimalWeight(c.landlordSharePct)} %)` : ""}
                </Text>
              ))}
            </>
          )}
        </View>

        <PFooter note={`${propertyName} · Einheit ${unitNumber} · Einzelabrechnung ${year}`} />
      </Page>
    </Document>
  );
}
