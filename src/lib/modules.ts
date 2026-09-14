/**
 * Pfadpräfix → menschenlesbarer Modulname, für die Nutzungshistorie.
 * Reihenfolge egal (jeder Eintrag ist ein eigenständiges Top-Level-Präfix,
 * keine Überlappungen) — Liste synchron zu den Einträgen in
 * src/components/Sidebar.tsx (`navItems`) plus Einstellungen.
 */
const MODULE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/objekte": "Objekte",
  "/kontakte": "Kontakte",
  "/vertraege": "Verträge",
  "/vorgaenge": "Vorgänge",
  "/dokumente": "Dokumente",
  "/emails": "E-Mails",
  "/deadlines": "Fristen & Termine",
  "/immobilienoptimierung": "Bestandsentwicklung",
  "/daten-einlesen": "Daten einlesen",
  "/legal-ai": "Immo-KI",
  "/dictation": "Diktat",
  "/telefonassistent": "Telefonassistent",
  "/einstellungen": "Einstellungen",
};

/** Leitet aus einem Pfad (z. B. "/objekte/123/buchhaltung") den Modulnamen ab. */
export function resolveModule(pathname: string): string {
  const firstSegment = "/" + pathname.split("/").filter(Boolean)[0];
  return MODULE_LABELS[firstSegment] ?? firstSegment;
}
