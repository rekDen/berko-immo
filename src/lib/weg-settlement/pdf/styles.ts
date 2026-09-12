// Server-only — nur von /api/weg-settlement/.../documents importiert, nie
// von Client-Komponenten. Farb-/Stilkonventionen gespiegelt von
// src/lib/expose/pdf.tsx, damit alle vom System erzeugten PDFs einheitlich
// wirken.
import { StyleSheet } from "@react-pdf/renderer";

export const NAVY = "#1e293b";
export const ACCENT = "#1e3a5f";
export const LIGHT = "#f1f5f9";
export const TEXT = "#334155";
export const MUTED = "#64748b";
export const WHITE = "#ffffff";
export const DIVIDER = "#e2e8f0";
export const NEGATIVE = "#b91c1c";
export const POSITIVE = "#047857";

export const s = StyleSheet.create({
  page: { backgroundColor: WHITE, fontFamily: "Helvetica", flexDirection: "column", paddingBottom: 50 },

  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLabel: { color: WHITE, fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  headerTitle: { color: "#94a3b8", fontSize: 7.5, flex: 1, textAlign: "center", paddingHorizontal: 10 },
  headerPage: { color: "#94a3b8", fontSize: 8 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerNote: { color: "#94a3b8", fontSize: 7.5 },

  sectionBlock: { paddingHorizontal: 36, paddingTop: 20, paddingBottom: 8 },
  sectionHead: { fontSize: 8, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 2, marginBottom: 8 },
  bodyText: { fontSize: 9.5, color: TEXT, lineHeight: 1.5 },
  mutedText: { fontSize: 8, color: MUTED },
  divider: { height: 1, backgroundColor: DIVIDER, marginHorizontal: 36, marginVertical: 4 },

  coverBlock: { paddingHorizontal: 36, paddingTop: 26, paddingBottom: 10 },
  coverEyebrow: { fontSize: 7, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 3, marginBottom: 8 },
  coverTitle: { fontSize: 17, fontFamily: "Helvetica-Bold", color: NAVY, lineHeight: 1.3, marginBottom: 6 },
  coverSubtitle: { fontSize: 10, color: MUTED },

  // ── Tabellen ──────────────────────────────────────────────────────────────
  table: { marginHorizontal: 36, marginBottom: 4 },
  tableHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: ACCENT, paddingBottom: 4, marginBottom: 3 },
  tableHeadCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 0.5, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: DIVIDER, paddingVertical: 4 },
  tableCell: { fontSize: 9, color: TEXT },
  tableCellRight: { fontSize: 9, color: TEXT, textAlign: "right" },
  tableTotalRow: { flexDirection: "row", paddingTop: 6, marginTop: 2, borderTopWidth: 1, borderTopColor: ACCENT },
  tableTotalLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY },
  tableTotalValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },

  // ── Ergebnisblock (K/E/R/V/S) ─────────────────────────────────────────────
  resultBox: {
    marginHorizontal: 36,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 2, marginBottom: 8 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  resultRowKey: { fontSize: 9.5, color: TEXT },
  resultRowValue: { fontSize: 9.5, color: TEXT, fontFamily: "Helvetica-Bold" },
  resultSpitzeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: DIVIDER },
  resultSpitzeKey: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  resultSpitzeValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },

  // ── Kopf-Infoblock (Objekt/Einheit/Adressat) ──────────────────────────────
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 36, marginBottom: 6 },
  infoCell: { width: "50%", marginBottom: 8 },
  infoCellLabel: { fontSize: 7, color: MUTED, letterSpacing: 1, marginBottom: 2, textTransform: "uppercase" },
  infoCellValue: { fontSize: 10, color: NAVY, fontFamily: "Helvetica-Bold" },

  disclaimerBox: {
    marginHorizontal: 36,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fffbeb",
    borderLeftWidth: 3,
    borderLeftColor: "#d97706",
  },
  disclaimerText: { fontSize: 8, color: "#92400e", fontStyle: "italic" },
});

export function formatCents(cents: number): string {
  const eur = cents / 100;
  return eur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function formatDecimalWeight(value: number | null): string {
  if (value === null) return "–";
  return value.toLocaleString("de-DE", { maximumFractionDigits: 4 });
}
