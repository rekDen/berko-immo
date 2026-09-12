// Server-only — nur von der API-Route importiert, s. styles.ts.
// Struktur nach Spec 5.13/8.3: Kontostände, Rücklagenentwicklung, offene
// Forderungen, Verbindlichkeiten, sonstiges Vermögen — kein Beschlussgegenstand.
import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s, formatCents } from "./styles";
import { PHeader, PFooter } from "./PageChrome";

export interface VermoegensberichtBankBalance {
  label: string;
  kind: "operating" | "reserve";
  balance: number | null;
}

export interface VermoegensberichtReserve {
  label: string;
  openingBalance: number;
  sollZufuehrung: number;
  istZufuehrung: number;
  entnahmen: number;
  zinsen: number;
  computedClosing: number;
}

export interface VermoegensberichtProps {
  propertyName: string;
  year: number;
  statusLabel: string;
  bankBalances: VermoegensberichtBankBalance[];
  reserves: VermoegensberichtReserve[];
  receivablesTotal: number;
  liabilities: { label: string; amount: number }[];
  otherAssets: { label: string; amount: number | null; note?: string }[];
}

export function VermoegensberichtPDF({
  propertyName, year, statusLabel, bankBalances, reserves, receivablesTotal, liabilities, otherAssets,
}: VermoegensberichtProps) {
  const title = `Vermögensbericht ${year} — ${propertyName}`;

  return (
    <Document title={title} producer="Berko AI">
      <Page size="A4" style={s.page}>
        <PHeader label="VERMÖGENSBERICHT" title={title} page={1} total={1} />

        <View style={s.coverBlock}>
          <Text style={s.coverEyebrow}>WEG-JAHRESABRECHNUNG · VERMÖGENSBERICHT (§ 28 ABS. 4 WEG)</Text>
          <Text style={s.coverTitle}>{propertyName}</Text>
          <Text style={s.coverSubtitle}>Stand 31.12.{year} · Status: {statusLabel}</Text>
        </View>

        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerText}>Dieser Bericht ist kein Gegenstand des Beschlusses.</Text>
        </View>

        <View style={s.sectionBlock}>
          <Text style={s.sectionHead}>KONTOSTÄNDE ZUM 31.12.</Text>
        </View>
        <View style={s.table}>
          {bankBalances.map((b, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 2 }]}>{b.label} ({b.kind === "operating" ? "Bewirtschaftung" : "Rücklage"})</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{b.balance !== null ? formatCents(b.balance) : "nicht erfasst"}</Text>
            </View>
          ))}
        </View>

        {reserves.length > 0 && (
          <>
            <View style={s.sectionBlock}>
              <Text style={s.sectionHead}>ENTWICKLUNG DER ERHALTUNGSRÜCKLAGE</Text>
            </View>
            <View style={s.table}>
              <View style={s.tableHeadRow}>
                <Text style={[s.tableHeadCell, { flex: 1.6 }]}>Konto</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Anfang</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Soll-Zuf.</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Ist-Zuf.</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Entnahmen</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Zinsen</Text>
                <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Ende</Text>
              </View>
              {reserves.map((r, i) => (
                <View key={i} style={s.tableRow}>
                  <Text style={[s.tableCell, { flex: 1.6 }]}>{r.label}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.openingBalance)}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.sollZufuehrung)}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.istZufuehrung)}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.entnahmen)}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.zinsen)}</Text>
                  <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.computedClosing)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={s.sectionBlock}>
          <Text style={s.sectionHead}>FORDERUNGEN, VERBINDLICHKEITEN, SONSTIGES VERMÖGEN</Text>
        </View>
        <View style={s.table}>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 2 }]}>Offene Forderungen gegen Eigentümer (Vorschüsse/Sonderumlagen)</Text>
            <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(receivablesTotal)}</Text>
          </View>
          {liabilities.map((l, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 2 }]}>{l.label} (Verbindlichkeit)</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(l.amount)}</Text>
            </View>
          ))}
          {otherAssets.map((a, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 2 }]}>{a.label}{a.note ? ` (${a.note})` : ""}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{a.amount !== null ? formatCents(a.amount) : "kein Wert erfasst"}</Text>
            </View>
          ))}
          {liabilities.length === 0 && otherAssets.length === 0 && (
            <Text style={[s.mutedText, { paddingVertical: 6 }]}>Keine weiteren Positionen erfasst.</Text>
          )}
        </View>

        <PFooter note={`${propertyName} · Vermögensbericht ${year}`} />
      </Page>
    </Document>
  );
}
