// Server-only — nur von der API-Route importiert, s. styles.ts.
// Objekt-Ebene (nicht je Einheit): Fließtext aus der (gerenderten) Vorlage,
// gedacht zum Einfügen in die Einladung/Niederschrift der Eigentümerversammlung.
import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s } from "./styles";
import { PHeader, PFooter } from "./PageChrome";

export interface BeschlussvorlageProps {
  propertyName: string;
  year: number;
  bodyParagraphs: string[];
}

export function BeschlussvorlagePDF({ propertyName, year, bodyParagraphs }: BeschlussvorlageProps) {
  const title = `Beschlussvorlage ${year} — ${propertyName}`;

  return (
    <Document title={title} producer="Berko AI">
      <Page size="A4" style={s.page}>
        <PHeader label="BESCHLUSSVORLAGE" title={title} page={1} total={1} />

        <View style={s.coverBlock}>
          <Text style={s.coverEyebrow}>WEG-JAHRESABRECHNUNG · BESCHLUSSVORLAGE</Text>
          <Text style={s.coverTitle}>{propertyName}</Text>
          <Text style={s.coverSubtitle}>Abrechnungsjahr {year}</Text>
        </View>

        <View style={{ marginHorizontal: 36, marginTop: 10 }}>
          {bodyParagraphs.map((p, i) => (
            <Text key={i} style={[s.bodyText, { marginBottom: 10 }]}>{p}</Text>
          ))}
        </View>

        <PFooter note={`${propertyName} · Beschlussvorlage ${year}`} />
      </Page>
    </Document>
  );
}
