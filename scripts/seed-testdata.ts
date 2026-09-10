/**
 * Seed-Script: Realistische Testdaten für Kanzleisoftware Akturio
 * Erstellt Fristen, Termine und Diktate.
 *
 * Ausführen: npx tsx scripts/seed-testdata.ts
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
  console.log("Erstelle Testdaten…\n");

  // ════════════════════════════════════════════════════════════════════════
  // FRISTEN & TERMINE
  // ════════════════════════════════════════════════════════════════════════

  const deadlines = [
    {
      az: "MF-2026/0098", date: "2026-05-06",
      title: "Mündliche Verhandlung — 23 C 1847/26",
      description: "Mündliche Verhandlung, AG Leipzig Saal 2.14. Gutachter SV Krause geladen.",
      type: "termin" as const, assigned_to: "MF", location: "Amtsgericht Leipzig, Saal 2.14",
    },
    {
      az: "MF-2026/0098", date: "2026-04-29",
      title: "Stellungnahme auf Klageerwiderung — 23 C 1847/26",
      description: "Frist zur Stellungnahme auf die Klageerwiderung der Gegenseite vom 10.04.2026.",
      type: "frist" as const, assigned_to: "MF", location: "",
    },
    {
      az: "MF-2026/0101", date: "2026-05-11",
      title: "Güteverhandlung — 14 Ca 892/26",
      description: "Güteverhandlung Bergmann ./. MetallWerk GmbH. Vergleichsbereitschaft prüfen.",
      type: "termin" as const, assigned_to: "MF", location: "Arbeitsgericht Leipzig, Saal 1.08",
    },
    {
      az: "MF-2026/0104", date: "2026-05-12",
      title: "Klagefrist § 4 KSchG — Herold ./. SaxPrint",
      description: "3-Wochen-Frist ab Zugang der Kündigung. Klage MUSS bis spätestens 12.05.2026 beim ArbG eingegangen sein.",
      type: "frist" as const, assigned_to: "MF", location: "",
    },
    {
      az: "MF-2026/0089", date: "2026-05-15",
      title: "Stellungnahme Abfindungsangebot — Petrov",
      description: "Frist zur Stellungnahme auf Abfindungsangebot Dr. Schwarz (18.000 EUR).",
      type: "frist" as const, assigned_to: "MF", location: "",
    },
    {
      az: "MF-2026/0103", date: "2026-05-04",
      title: "Frist Ablehnungsschreiben HUK — Hoffmann",
      description: "Ablehnungsschreiben mit Fristsetzung zur vollständigen Regulierung muss raus.",
      type: "frist" as const, assigned_to: "MF", location: "",
    },
    {
      az: "MF-2026/0099", date: "2026-05-20",
      title: "Anhörungstermin Nachlassgericht — 42 VI 384/26",
      description: "Anhörung zum Erbscheinsantrag. Originalhandschriftliches Testament mitbringen.",
      type: "termin" as const, assigned_to: "MF", location: "Amtsgericht Leipzig — Nachlassgericht, Zimmer 3.07",
    },
    {
      az: "MF-2025/0087", date: "2026-05-19",
      title: "Mündliche Verhandlung EM-Rente — S 18 R 412/25",
      description: "Mündl. Verhandlung Sozialgericht Leipzig. Gutachten Prof. Dr. Lehmann liegt vor.",
      type: "termin" as const, assigned_to: "MF", location: "Sozialgericht Leipzig, Saal 4.02",
    },
    {
      az: "MF-2026/0105", date: "2026-05-15",
      title: "Widerspruchsfrist Sanktionsbescheid — Dornbusch",
      description: "Einmonatsfrist ab Bekanntgabe Sanktionsbescheid. Widerspruch MUSS raus!",
      type: "frist" as const, assigned_to: "MF", location: "",
    },
  ];

  console.log("Erstelle Fristen & Termine…");
  for (const d of deadlines) {
    const { error } = await admin.from("deadlines").insert({
      user_id: USER_ID,
      az: d.az,
      date: d.date,
      title: d.title,
      description: d.description,
      type: d.type,
      assigned_to: d.assigned_to,
      location: d.location,
    });
    if (error) console.error(`  Fehler: ${d.title}:`, error.message);
    else console.log(`  ${d.type === "frist" ? "Frist" : "Termin"}: ${d.title}`);
  }

  console.log("\nAlle Fristen & Termine angelegt.\n");

  // ════════════════════════════════════════════════════════════════════════
  // DIKTATE
  // ════════════════════════════════════════════════════════════════════════

  const dictations: {
    title: string;
    raw: string;
    formatted: string;
    duration: number;
  }[] = [
    {
      title: "DIK-2026-0415 — Klageentwurf Herold ./. SaxPrint",
      duration: 312,
      raw: `frau hoffmann bitte folgende kündigungsschutzklage an das arbeitsgericht leipzig vorbereiten...`,
      formatted: `**KÜNDIGUNGSSCHUTZKLAGE**\n\n**Akte:** MF-2026/0104 — Herold ./. SaxPrint GmbH\n**Dringlichkeit:** eilig`,
    },
    {
      title: "DIK-2026-0419 — Widerspruch Sanktionsbescheid Dornbusch",
      duration: 178,
      raw: `frau hoffmann bitte folgenden widerspruch an das jobcenter leipzig vorbereiten...`,
      formatted: `**WIDERSPRUCH SANKTIONSBESCHEID**\n\n**Akte:** MF-2026/0105 — Dornbusch ./. Jobcenter Leipzig\n**Dringlichkeit:** eilig`,
    },
  ];

  console.log("Erstelle Diktate…");
  for (const d of dictations) {
    const { error } = await admin.from("dictations").insert({
      user_id: USER_ID,
      title: d.title,
      raw_transcription: d.raw,
      formatted_text: d.formatted,
      duration_seconds: d.duration,
    });
    if (error) console.error(`  Fehler Diktat ${d.title}:`, error.message);
    else console.log(`  Diktat: ${d.title}`);
  }

  console.log("\nAlle Diktate angelegt.\n");
  console.log("════════════════════════════════════════════════");
  console.log("Testdaten-Generierung abgeschlossen!");
  console.log(`  ${deadlines.length} Fristen & Termine`);
  console.log(`  ${dictations.length} Diktate`);
  console.log("════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Unerwarteter Fehler:", err);
  process.exit(1);
});
