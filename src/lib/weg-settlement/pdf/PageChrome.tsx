import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "./styles";

export function PHeader({ label, title, page, total }: { label: string; title: string; page: number; total: number }) {
  return (
    <View style={s.header} fixed>
      <Text style={s.headerLabel}>{label}</Text>
      <Text style={s.headerTitle}>{title}</Text>
      <Text style={s.headerPage}>Seite {page} / {total}</Text>
    </View>
  );
}

export function PFooter({ note }: { note: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerNote}>{note}</Text>
      <Text style={s.footerNote}>Alle Angaben ohne Gewähr</Text>
    </View>
  );
}
