/**
 * Seed-Script: Fristen & Termine nachträglich einfügen
 * (location-Spalte existiert nicht in der DB)
 *
 * Ausführen: npx tsx scripts/seed-deadlines.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const USER_ID = "a661be49-c72f-4185-baf2-0ca9cecea0b4";

async function main() {
  // Case-IDs aus der DB holen
  const { data: casesData } = await admin
    .from("cases")
    .select("id, az")
    .eq("user_id", USER_ID);

  const caseByAz: Record<string, string> = {};
  for (const c of casesData ?? []) {
    caseByAz[c.az] = c.id;
  }

  console.log("Gefundene Akten:", Object.keys(caseByAz));

  const deadlines = [
    // ── Müller ./. Weber GmbH ──
    {
      az: "MF-2026/0098", date: "2026-05-06",
      title: "Mündliche Verhandlung — 23 C 1847/26",
      description: "Mündliche Verhandlung, AG Leipzig Saal 2.14. Gutachter SV Krause geladen. Unterlagen mitnehmen: Werkvertrag, Mängelprotokoll, Fotos.\nOrt: Amtsgericht Leipzig, Saal 2.14",
      type: "termin" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0098", date: "2026-04-29",
      title: "Stellungnahme auf Klageerwiderung — 23 C 1847/26",
      description: "Frist zur Stellungnahme auf die Klageerwiderung der Gegenseite vom 10.04.2026. Verlängerung wurde nicht beantragt.",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0098", date: "2026-04-28",
      title: "Mandantenbesprechung Müller",
      description: "Besprechung Verhandlungsvorbereitung. Fotos und Rechnungen mitbringen lassen.\nOrt: Kanzlei",
      type: "termin" as const, assigned_to: "MF",
    },

    // ── Bergmann ./. MetallWerk ──
    {
      az: "MF-2026/0101", date: "2026-05-11",
      title: "Güteverhandlung — 14 Ca 892/26",
      description: "Güteverhandlung Bergmann ./. MetallWerk GmbH. Vergleichsbereitschaft prüfen: Abfindung ab Faktor 0,75 akzeptabel lt. Mandant.\nOrt: Arbeitsgericht Leipzig, Saal 1.08",
      type: "termin" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0101", date: "2026-05-06",
      title: "Mandantenbesprechung Bergmann — Verhandlungsvorbereitung",
      description: "Vorbereitung Gütetermin. Sozialauswahl-Unterlagen durchgehen, Lohnabrechnung der letzten 12 Monate prüfen.\nOrt: Kanzlei",
      type: "termin" as const, assigned_to: "MF",
    },

    // ── Herold ./. SaxPrint ──
    {
      az: "MF-2026/0104", date: "2026-05-12",
      title: "Klagefrist § 4 KSchG — Herold ./. SaxPrint",
      description: "3-Wochen-Frist ab Zugang der Kündigung (21.04.2026). Zwingend! Klage MUSS bis spätestens 12.05.2026 beim ArbG eingegangen sein.",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0104", date: "2026-05-05",
      title: "Vorfrist Klagefrist Herold — Klageentwurf fertigstellen",
      description: "Vorfrist 5 Werktage vor Ablauf Klagefrist. Klageentwurf muss heute finalisiert und zur Durchsicht vorgelegt werden.",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0104", date: "2026-04-24",
      title: "Erstberatung Herold — Unterlagen sichten",
      description: "Mandant bringt Arbeitsvertrag, Kündigungsschreiben, Abmahnungen und Arbeitszeitnachweise mit.\nOrt: Kanzlei",
      type: "termin" as const, assigned_to: "MF",
    },

    // ── Petrov ./. LogiTrans ──
    {
      az: "MF-2026/0089", date: "2026-05-15",
      title: "Stellungnahme Abfindungsangebot — Petrov",
      description: "Frist zur Stellungnahme auf Abfindungsangebot Dr. Schwarz (18.000 EUR). Gegenforderung 36.000 EUR formulieren.",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0089", date: "2026-04-27",
      title: "Telefonkonferenz mit Mandant Petrov",
      description: "Besprechung Abfindungsangebot. Mandant will Mindestabfindung 30.000 EUR. Verhandlungsstrategie festlegen.\nOrt: Telefon",
      type: "termin" as const, assigned_to: "MF",
    },

    // ── Hoffmann ./. HUK-Coburg ──
    {
      az: "MF-2026/0103", date: "2026-05-04",
      title: "Frist Ablehnungsschreiben HUK — Hoffmann",
      description: "Selbstgesetzte Frist: Ablehnungsschreiben mit Fristsetzung zur vollständigen Regulierung muss raus. Polizeibericht und Gutachten SV Wehner beilegen.",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0103", date: "2026-04-29",
      title: "Mandantenbesprechung Hoffmann — Unfallhergang",
      description: "Unfallhergang detailliert besprechen. Fotos der Unfallstelle sichten. Dashcam-Video prüfen.\nOrt: Kanzlei",
      type: "termin" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0103", date: "2026-06-04",
      title: "Nachfrist HUK-Coburg — Regulierung",
      description: "Frist zur vollständigen Regulierung (2 Wochen nach Ablehnungsschreiben). Bei Fristablauf: Klageerhebung.",
      type: "frist" as const, assigned_to: "MF",
    },

    // ── Neumann (Erbscheinsverfahren) ──
    {
      az: "MF-2026/0099", date: "2026-05-20",
      title: "Anhörungstermin Nachlassgericht — 42 VI 384/26",
      description: "Anhörung zum Erbscheinsantrag. Originalhandschriftliches Testament mitbringen. Zeugin Frau Lehmann (Nachbarin) zur Testierfähigkeit geladen.\nOrt: Amtsgericht Leipzig — Nachlassgericht, Zimmer 3.07",
      type: "termin" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0099", date: "2026-05-08",
      title: "Stellungnahme auf Erbscheinsantrag Krüger — 42 VI 384/26",
      description: "Frist zur Stellungnahme auf den Erbscheinsantrag der Schwester Renate Krüger (je 1/2). Testierfähigkeit substantiiert darlegen.",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0099", date: "2026-04-28",
      title: "Mandantenbesprechung Dr. Neumann — Erbscheinsverfahren",
      description: "Testament und Nachlassverzeichnis durchgehen. Immobilienbewertung besprechen. Kontovollmacht prüfen.\nOrt: Kanzlei",
      type: "termin" as const, assigned_to: "MF",
    },

    // ── Henning ./. DRV ──
    {
      az: "MF-2025/0087", date: "2026-05-19",
      title: "Mündliche Verhandlung EM-Rente — S 18 R 412/25",
      description: "Mündl. Verhandlung Sozialgericht Leipzig. Gutachten Prof. Dr. Lehmann liegt vor (GdB 50). Mandantin vorbereiten: Tagesablauf schildern können.\nOrt: Sozialgericht Leipzig, Saal 4.02",
      type: "termin" as const, assigned_to: "MF",
    },
    {
      az: "MF-2025/0087", date: "2026-05-12",
      title: "Mandantenbesprechung Henning — Verhandlungsvorbereitung",
      description: "Vorbereitung mündliche Verhandlung. Gutachten besprechen, typischen Tagesablauf dokumentieren. Ggf. weiteres Attest Dr. Reinhardt anfordern.\nOrt: Kanzlei",
      type: "termin" as const, assigned_to: "MF",
    },

    // ── Dornbusch ./. Jobcenter ──
    {
      az: "MF-2026/0105", date: "2026-05-15",
      title: "Widerspruchsfrist Sanktionsbescheid — Dornbusch",
      description: "Einmonatsfrist ab Bekanntgabe Sanktionsbescheid (15.04.2026 + 3 Tage = 18.04.2026). Widerspruch MUSS raus!",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0105", date: "2026-05-08",
      title: "Vorfrist Widerspruch Dornbusch",
      description: "Vorfrist 5 Werktage vor Ablauf. Widerspruchsschreiben finalisieren, AU-Bescheinigung und Meldeaufforderung beilegen.",
      type: "frist" as const, assigned_to: "MF",
    },
    {
      az: "MF-2026/0105", date: "2026-04-24",
      title: "Erstberatung Dornbusch — Sanktionsbescheid",
      description: "Sanktionsbescheid prüfen, AU und Meldeaufforderung sichten. Beratungshilfe beantragen.\nOrt: Kanzlei",
      type: "termin" as const, assigned_to: "MF",
    },
  ];

  console.log("Erstelle Fristen & Termine…");
  let count = 0;
  for (const d of deadlines) {
    const caseId = caseByAz[d.az] ?? null;
    const { error } = await admin.from("deadlines").insert({
      user_id: USER_ID,
      case_id: caseId,
      az: d.az,
      date: d.date,
      title: d.title,
      description: d.description,
      type: d.type,
      assigned_to: d.assigned_to,
    });
    if (error) {
      console.error(`  Fehler: ${d.title}:`, error.message);
    } else {
      count++;
      console.log(`  ${d.type === "frist" ? "Frist" : "Termin"}: ${d.title}`);
    }
  }

  console.log(`\n${count} von ${deadlines.length} Fristen & Termine angelegt.`);
}

main().catch((err) => {
  console.error("Unerwarteter Fehler:", err);
  process.exit(1);
});
