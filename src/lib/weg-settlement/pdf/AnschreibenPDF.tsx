// Server-only — nur von der API-Route importiert, s. styles.ts.
// Einfacher Brief-Layout: Kopf mit Adressat, Fließtext aus der (gerenderten)
// Vorlage, Fußzeile wie die übrigen Settlement-PDFs.
import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s, MUTED, NAVY } from "./styles";
import { PHeader, PFooter } from "./PageChrome";

export interface AnschreibenProps {
  propertyName: string;
  year: number;
  unitNumber: string;
  addresseeName: string;
  addresseeAddress: string | null;
  subject: string;
  bodyParagraphs: string[];
}

export function AnschreibenPDF({ propertyName, year, unitNumber, addresseeName, addresseeAddress, subject, bodyParagraphs }: AnschreibenProps) {
  const title = `Anschreiben ${year} — ${propertyName}, Einheit ${unitNumber}`;

  return (
    <Document title={title} producer="Berko AI">
      <Page size="A4" style={s.page}>
        <PHeader label="ANSCHREIBEN" title={title} page={1} total={1} />

        <View style={{ marginHorizontal: 36, marginTop: 26, marginBottom: 20 }}>
          <Text style={{ fontSize: 10, color: MUTED }}>{addresseeName}</Text>
          {addresseeAddress && <Text style={{ fontSize: 10, color: MUTED }}>{addresseeAddress}</Text>}
        </View>

        <View style={{ marginHorizontal: 36, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>{subject}</Text>
        </View>

        <View style={{ marginHorizontal: 36 }}>
          {bodyParagraphs.map((p, i) => (
            <Text key={i} style={[s.bodyText, { marginBottom: 10 }]}>{p}</Text>
          ))}
        </View>

        <PFooter note={`${propertyName} · Einheit ${unitNumber} · Anschreiben ${year}`} />
      </Page>
    </Document>
  );
}
