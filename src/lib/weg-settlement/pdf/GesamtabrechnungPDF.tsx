// Server-only — nur von der API-Route importiert, s. styles.ts.
import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s, formatCents } from "./styles";
import { PHeader, PFooter } from "./PageChrome";

export interface GesamtabrechnungBankAccount {
  label: string;
  kind: "operating" | "reserve";
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  computedClosing: number;
  confirmedClosing: number | null;
}

export interface GesamtabrechnungCostRow {
  name: string;
  amount: number;
}

export interface GesamtabrechnungProps {
  propertyName: string;
  year: number;
  statusLabel: string;
  bankAccounts: GesamtabrechnungBankAccount[];
  expenseRows: GesamtabrechnungCostRow[];
  incomeRows: GesamtabrechnungCostRow[];
  overall: {
    advancePaymentsIst: number;
    specialLevyPaymentsIst: number;
    otherIncomeTotal: number;
    expenseTotal: number;
    internalTransfersNet: number;
    priorYearSettlementPayments: number;
  };
}

export function GesamtabrechnungPDF({ propertyName, year, statusLabel, bankAccounts, expenseRows, incomeRows, overall }: GesamtabrechnungProps) {
  const title = `Gesamtabrechnung ${year} — ${propertyName}`;
  const totalIncome = overall.advancePaymentsIst + overall.specialLevyPaymentsIst + overall.otherIncomeTotal;

  return (
    <Document title={title} producer="Berko AI">
      <Page size="A4" style={s.page}>
        <PHeader label="GESAMTABRECHNUNG" title={title} page={1} total={1} />

        <View style={s.coverBlock}>
          <Text style={s.coverEyebrow}>WEG-JAHRESABRECHNUNG · GESAMTABRECHNUNG</Text>
          <Text style={s.coverTitle}>{propertyName}</Text>
          <Text style={s.coverSubtitle}>Abrechnungsjahr {year} · Status: {statusLabel}</Text>
        </View>

        <View style={s.sectionBlock}>
          <Text style={s.sectionHead}>EINNAHMEN (IST)</Text>
        </View>
        <View style={s.table}>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 2 }]}>Hausgeldzahlungen</Text>
            <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(overall.advancePaymentsIst)}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 2 }]}>Sonderumlagezahlungen</Text>
            <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(overall.specialLevyPaymentsIst)}</Text>
          </View>
          {incomeRows.map((r, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 2 }]}>{r.name}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.amount)}</Text>
            </View>
          ))}
          <View style={s.tableTotalRow}>
            <Text style={[s.tableTotalLabel, { flex: 2 }]}>Summe Einnahmen</Text>
            <Text style={[s.tableTotalValue, { flex: 1 }]}>{formatCents(totalIncome)}</Text>
          </View>
        </View>

        <View style={s.sectionBlock}>
          <Text style={s.sectionHead}>AUSGABEN NACH KOSTENART</Text>
        </View>
        <View style={s.table}>
          <View style={s.tableHeadRow}>
            <Text style={[s.tableHeadCell, { flex: 2 }]}>Kostenart</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Betrag</Text>
          </View>
          {expenseRows.map((r, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 2 }]}>{r.name}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(r.amount)}</Text>
            </View>
          ))}
          <View style={s.tableTotalRow}>
            <Text style={[s.tableTotalLabel, { flex: 2 }]}>Summe Ausgaben</Text>
            <Text style={[s.tableTotalValue, { flex: 1 }]}>{formatCents(overall.expenseTotal)}</Text>
          </View>
        </View>

        {overall.internalTransfersNet !== 0 && (
          <View style={s.sectionBlock}>
            <Text style={s.bodyText}>Umbuchungen zwischen Gemeinschaftskonten (netto, weder Einnahme noch Ausgabe): {formatCents(overall.internalTransfersNet)}</Text>
          </View>
        )}
        {overall.priorYearSettlementPayments !== 0 && (
          <View style={s.sectionBlock}>
            <Text style={s.bodyText}>Zahlungen aus Vorjahresabrechnungen (eigene Position, nicht erneut verteilt): {formatCents(overall.priorYearSettlementPayments)}</Text>
          </View>
        )}

        <View style={s.sectionBlock}>
          <Text style={s.sectionHead}>KONTENABSTIMMUNG</Text>
        </View>
        <View style={s.table}>
          <View style={s.tableHeadRow}>
            <Text style={[s.tableHeadCell, { flex: 2 }]}>Konto</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Anfang</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Zugänge</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Abgänge</Text>
            <Text style={[s.tableHeadCell, { flex: 1, textAlign: "right" }]}>Ende</Text>
          </View>
          {bankAccounts.map((b, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 2 }]}>{b.label} ({b.kind === "operating" ? "Bewirtschaftung" : "Rücklage"})</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(b.openingBalance)}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(b.totalIn)}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(b.totalOut)}</Text>
              <Text style={[s.tableCellRight, { flex: 1 }]}>{formatCents(b.computedClosing)}</Text>
            </View>
          ))}
        </View>

        <PFooter note={`${propertyName} · Gesamtabrechnung ${year}`} />
      </Page>
    </Document>
  );
}
