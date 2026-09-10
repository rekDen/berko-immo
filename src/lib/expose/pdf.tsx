// Server-only — only imported by /api/expose route, never by client components.
import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

export interface ExposeContent {
  titel: string;
  beschreibung: string;
  highlights: string[];
  lage: string;
  ausstattung: string[];
  preisinfo: string;
}

const NAVY    = "#1e293b";
const ACCENT  = "#1e3a5f";
const LIGHT   = "#f1f5f9";
const TEXT    = "#334155";
const MUTED   = "#64748b";
const WHITE   = "#ffffff";
const DIVIDER = "#e2e8f0";

const s = StyleSheet.create({
  page: { backgroundColor: WHITE, fontFamily: "Helvetica", flexDirection: "column" },

  // ── Per-page header bar ───────────────────────────────────────────────────
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
  headerPage:  { color: "#94a3b8", fontSize: 8 },

  // ── Cover page ────────────────────────────────────────────────────────────
  heroImg: { width: "100%", height: 290 },
  heroPh:  { width: "100%", height: 290, backgroundColor: LIGHT },

  coverBlock: {
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 20,
    flex: 1,
  },
  coverEyebrow: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 3,
    marginBottom: 10,
  },
  coverTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    lineHeight: 1.3,
    marginBottom: 14,
  },
  coverTagRow: { flexDirection: "row", marginBottom: 16 },
  coverTagType: {
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  coverTagPrice: {
    backgroundColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  coverTagTxt: { color: WHITE, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  coverTeaser: { fontSize: 10, color: TEXT, lineHeight: 1.6 },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerNote:  { color: "#94a3b8", fontSize: 7.5, lineHeight: 1.4 },
  footerPrice: { color: WHITE, fontSize: 9, fontFamily: "Helvetica-Bold" },

  // ── Section typography ────────────────────────────────────────────────────
  sectionBlock: { paddingHorizontal: 36, paddingTop: 22, paddingBottom: 14 },
  sectionHead:  {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 3,
    marginBottom: 10,
  },
  bodyText: { fontSize: 10, color: TEXT, lineHeight: 1.65 },
  divider:  { height: 1, backgroundColor: DIVIDER, marginHorizontal: 36, marginVertical: 6 },

  // ── Two-column bullet list ────────────────────────────────────────────────
  twoCol:   { flexDirection: "row", paddingHorizontal: 36, paddingTop: 12, paddingBottom: 10 },
  listCol:  { flex: 1, paddingRight: 14 },
  listHead: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 2.5,
    marginBottom: 9,
  },
  listItem: { flexDirection: "row", marginBottom: 5 },
  listDot:  { fontSize: 10, color: ACCENT, fontFamily: "Helvetica-Bold", marginRight: 7, lineHeight: 1.4 },
  listTxt:  { fontSize: 9.5, color: TEXT, flex: 1, lineHeight: 1.5 },

  // ── Highlighted info box (Lage / Preis) ───────────────────────────────────
  infoBox: {
    marginHorizontal: 36,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoBoxLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  infoBoxText: { fontSize: 9.5, color: TEXT, lineHeight: 1.6 },

  // ── Image gallery ─────────────────────────────────────────────────────────
  imgRow:  { flexDirection: "row", height: 170 },
  imgHalf: { flex: 1 },

  // ── Filler flex ───────────────────────────────────────────────────────────
  flex1: { flex: 1 },

  // ── Preisübersicht data row ───────────────────────────────────────────────
  priceRow: {
    paddingHorizontal: 36,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: "row",
    backgroundColor: LIGHT,
  },
  priceCell:  { flex: 1, paddingRight: 10 },
  priceLabel: { fontSize: 7, color: MUTED, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, marginBottom: 4 },
  priceValue: { fontSize: 15, color: NAVY, fontFamily: "Helvetica-Bold" },
});

interface HeaderProps {
  eyebrow: string;
  page: number;
  total: number;
}

function PHeader({ eyebrow, page, total }: HeaderProps) {
  return (
    <View style={s.header}>
      <Text style={s.headerLabel}>EXPOSÉ</Text>
      <Text style={s.headerTitle}>{eyebrow}</Text>
      <Text style={s.headerPage}>Seite {page} / {total}</Text>
    </View>
  );
}

interface Props {
  content: ExposeContent;
  images: string[];
  type: "kauf" | "miete";
  price: string;
}

export function ExposePDF({ content, images, type, price }: Props) {
  const label    = type === "kauf" ? "Kauf" : "Vermietung";
  const hasHL    = (content.highlights ?? []).length > 0;
  const hasAS    = (content.ausstattung ?? []).length > 0;
  const hasLage  = !!content.lage?.trim();
  const hasPInfo = !!content.preisinfo?.trim();
  const hasExtra = images.length > 1;

  const needsPage3 = hasLage || hasPInfo || hasExtra;
  const total      = needsPage3 ? 3 : 2;

  const teaser = content.beschreibung
    ? content.beschreibung.slice(0, 200) + (content.beschreibung.length > 200 ? " …" : "")
    : "";

  return (
    <Document title={content.titel} producer="Akturio">

      {/* ── SEITE 1: TITELSEITE ───────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <PHeader eyebrow={content.titel} page={1} total={total} />

        {images[0]
          ? <Image src={images[0]} style={s.heroImg} />
          : <View style={s.heroPh} />
        }

        <View style={s.coverBlock}>
          <Text style={s.coverEyebrow}>EXKLUSIVES IMMOBILIEN-EXPOSE</Text>
          <Text style={s.coverTitle}>{content.titel}</Text>
          <View style={s.coverTagRow}>
            <View style={s.coverTagType}>
              <Text style={s.coverTagTxt}>{label.toUpperCase()}</Text>
            </View>
            <View style={s.coverTagPrice}>
              <Text style={s.coverTagTxt}>{price}</Text>
            </View>
          </View>
          {!!teaser && <Text style={s.coverTeaser}>{teaser}</Text>}
        </View>

        <View style={s.footer}>
          <Text style={s.footerNote}>Alle Angaben ohne Gewähr · Irrtümer vorbehalten</Text>
          <Text style={s.footerPrice}>{label}: {price}</Text>
        </View>
      </Page>

      {/* ── SEITE 2: OBJEKTBESCHREIBUNG + HIGHLIGHTS / AUSSTATTUNG ───────── */}
      <Page size="A4" style={s.page}>
        <PHeader eyebrow={content.titel} page={2} total={total} />

        <View style={s.flex1}>
          <View style={s.sectionBlock}>
            <Text style={s.sectionHead}>DAS OBJEKT</Text>
            <Text style={s.bodyText}>{content.beschreibung}</Text>
          </View>

          {(hasHL || hasAS) && (
            <>
              <View style={s.divider} />
              <View style={s.twoCol}>
                {hasHL && (
                  <View style={s.listCol}>
                    <Text style={s.listHead}>HIGHLIGHTS</Text>
                    {content.highlights.map((h, i) => (
                      <View key={i} style={s.listItem}>
                        <Text style={s.listDot}>•</Text>
                        <Text style={s.listTxt}>{h}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {hasAS && (
                  <View style={s.listCol}>
                    <Text style={s.listHead}>AUSSTATTUNG</Text>
                    {content.ausstattung.map((a, i) => (
                      <View key={i} style={s.listItem}>
                        <Text style={s.listDot}>•</Text>
                        <Text style={s.listTxt}>{a}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        <View style={s.footer}>
          <Text style={s.footerNote}>Alle Angaben ohne Gewähr · Irrtümer vorbehalten</Text>
          <Text style={s.footerPrice}>{label}: {price}</Text>
        </View>
      </Page>

      {/* ── SEITE 3: LAGE + PREISDETAILS + GALERIE (optional) ─────────────── */}
      {needsPage3 && (
        <Page size="A4" style={s.page}>
          <PHeader eyebrow={content.titel} page={3} total={total} />

          <View style={s.flex1}>
            {hasLage && (
              <>
                <View style={s.sectionBlock}>
                  <Text style={s.sectionHead}>LAGE</Text>
                  <Text style={s.bodyText}>{content.lage}</Text>
                </View>
                {hasPInfo && <View style={s.divider} />}
              </>
            )}

            {hasPInfo && (
              <View style={s.infoBox}>
                <Text style={s.infoBoxLabel}>PREISDETAILS</Text>
                <Text style={s.infoBoxText}>{content.preisinfo}</Text>
              </View>
            )}

            {hasExtra && (
              <View style={[s.imgRow, { marginTop: hasPInfo || hasLage ? 14 : 0 }]}>
                {images.slice(1, 3).map((src, i) => (
                  <Image key={i} src={src} style={s.imgHalf} />
                ))}
              </View>
            )}
          </View>

          <View style={s.footer}>
            <Text style={s.footerNote}>Alle Angaben ohne Gewähr · Irrtümer vorbehalten</Text>
            <Text style={s.footerPrice}>{label}: {price}</Text>
          </View>
        </Page>
      )}

    </Document>
  );
}
