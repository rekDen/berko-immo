import { Email, Deadline, LegalQA } from "@/types";

export const emails: Email[] = [
  
];

export const deadlines: Deadline[] = [
  {
    id: "d1",
    date: "2026-06-09",
    title: "Schriftsatzfrist Müller ./. Schmidt",
    description: "Erwiderung auf den Schriftsatz der Gegenseite vom 01.04.2026",
    completed: false,
    assignedTo: "",
    type: "frist",
    az: "124/26-GW",
  },
  {
    id: "d2",
    date: "2026-06-10",
    title: "Stellungnahme Vergleichsangebot",
    description: "Frist zur Annahme/Ablehnung des Vergleichsangebots Krause (3 Bruttomonatsgehälter)",
    completed: false,
    assignedTo: "",
    type: "frist",
    az: "125/26-GW",
  },
  {
    id: "d3",
    date: "2026-06-10",
    title: "Mandantentermin Fischer",
    description: "Besprechung Erbsache — Schenkungsanfechtung, neue Unterlagen sichten",
    completed: false,
    assignedTo: "",
    type: "termin",
    az: "126/26-GW",
  },
  {
    id: "d4",
    date: "2026-06-11",
    title: "Mandantentermin Nexus Technologies",
    description: "Gesellschaftervereinbarung — Entwurf besprechen und Änderungswünsche aufnehmen",
    completed: false,
    assignedTo: "",
    type: "termin",
    az: "127/26-GW",
  },
  {
    id: "d5",
    date: "2026-06-12",
    title: "Mündliche Verhandlung Müller ./. Schmidt",
    description: "AG München, Saal 204, 10:00 Uhr — Gütetermin und mündliche Verhandlung",
    completed: false,
    assignedTo: "",
    type: "termin",
    az: "124/26-GW",
  },
  {
    id: "d6",
    date: "2026-06-13",
    title: "Berufungsfrist Fischer Erbsache",
    description: "Frist zur Einlegung der Berufung gegen Beschluss des Nachlassgerichts",
    completed: false,
    assignedTo: "",
    type: "frist",
    az: "126/26-GW",
  },
];

export const legalQA: LegalQA[] = [
  {
    q: "fristen",
    a: `## Fristen im Zivilprozess\n\nIm deutschen Zivilprozessrecht gibt es verschiedene Fristarten:\n\n**1. Gesetzliche Fristen** (nicht verlängerbar)\n- Berufungsfrist: **1 Monat** ab Zustellung (§ 517 ZPO)\n- Revisionsfrist: **1 Monat** ab Zustellung (§ 548 ZPO)\n- Einspruchsfrist gegen Versäumnisurteil: **2 Wochen** (§ 339 ZPO)\n\n**2. Richterliche Fristen** (verlängerbar auf Antrag)\n- Klageerwiderungsfrist\n- Schriftsatzfristen nach § 283 ZPO\n\n**3. Wiedereinsetzung in den vorigen Stand**\nBei unverschuldeter Fristversäumung möglich nach §§ 233 ff. ZPO. Antrag innerhalb von **2 Wochen** nach Wegfall des Hindernisses.\n\n📎 *Quellen: §§ 222 ff., 233 ff., 517, 548 ZPO*`,
  },
  {
    q: "eigenbedarf",
    a: `## Eigenbedarfskündigung\n\nDer Vermieter kann wegen Eigenbedarfs kündigen, wenn er die Wohnung für sich, Familienangehörige oder Haushaltsangehörige benötigt (§ 573 Abs. 2 Nr. 2 BGB).\n\n**Voraussetzungen:**\n- **Ernsthafter Nutzungswunsch** — kein vorgeschobener Eigenbedarf\n- **Konkrete Benennung** der Person, für die der Bedarf besteht\n- **Vernünftige Gründe** für den Wohnungswechsel\n\n**Kündigungsfristen (§ 573c BGB):**\n- Bis 5 Jahre Mietdauer: **3 Monate**\n- 5–8 Jahre: **6 Monate**\n- Über 8 Jahre: **9 Monate**\n\n**Härteklausel (§ 574 BGB):**\nDer Mieter kann Widerspruch einlegen, wenn der Auszug eine unzumutbare Härte darstellt (Alter, Krankheit, etc.).\n\n📎 *Quellen: §§ 573, 573c, 574 BGB; BGH VIII ZR 154/25*`,
  },
  {
    q: "kuendigungsschutz",
    a: `## Kündigungsschutz im Arbeitsrecht\n\nDas **Kündigungsschutzgesetz (KSchG)** gilt für Betriebe mit mehr als 10 Arbeitnehmern und bei einer Betriebszugehörigkeit von mehr als 6 Monaten.\n\n**Kündigungsgründe (§ 1 KSchG):**\n1. **Personenbedingt** — z.B. Langzeiterkrankung, fehlende Eignung\n2. **Verhaltensbedingt** — z.B. Arbeitszeitbetrug, Diebstahl (Abmahnung i.d.R. erforderlich)\n3. **Betriebsbedingt** — z.B. Wegfall des Arbeitsplatzes, Sozialauswahl\n\n**Kündigungsschutzklage:**\n- Frist: **3 Wochen** ab Zugang der Kündigung (§ 4 KSchG)\n- Zuständig: Arbeitsgericht am Sitz des Betriebs\n- Gütetermin innerhalb von 2 Wochen nach Klageerhebung\n\n**Besonderer Kündigungsschutz:**\n- Schwerbehinderte (§ 168 SGB IX)\n- Schwangere (§ 17 MuSchG)\n- Betriebsratsmitglieder (§ 15 KSchG)\n\n📎 *Quellen: §§ 1, 4, 15 KSchG; §§ 622, 626 BGB*`,
  },
  {
    q: "pflichtteil",
    a: `## Pflichtteilsrecht\n\nDer Pflichtteil sichert nahen Angehörigen eine Mindestbeteiligung am Nachlass (§§ 2303 ff. BGB).\n\n**Pflichtteilsberechtigt:**\n- Abkömmlinge des Erblassers\n- Ehegatte/Lebenspartner\n- Eltern (wenn keine Abkömmlinge vorhanden)\n\n**Höhe:**\n- **Die Hälfte** des gesetzlichen Erbteils\n- Berechnung auf Grundlage des Nachlasswertes zum Todeszeitpunkt\n\n**Pflichtteilsergänzung (§ 2325 BGB):**\n- Schenkungen der letzten **10 Jahre** werden berücksichtigt\n- Pro Jahr vor dem Erbfall schmilzt der Ergänzungsanspruch um 10% ab\n- Im 1. Jahr vor dem Tod: 100% anrechenbar\n\n**Verjährung:**\n- **3 Jahre** ab Kenntnis vom Erbfall und Enterbung (§ 195, 199 BGB)\n\n📎 *Quellen: §§ 2303, 2325 ff. BGB*`,
  },
];

export const firmInfo = {
  name: "Daniel Tauscher",
  user: {
    name: "Daniel Tauscher",
    title: "Inhaber",
    initials: "GW",
  },
};
