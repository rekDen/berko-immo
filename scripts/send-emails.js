#!/usr/bin/env node
/**
 * send-emails.js
 *
 * Versendet 50 realistische Hausverwaltungs-E-Mails an daniel.tauscher@akturio.com.
 * Die E-Mails sind gleichmäßig auf 11 Kategorien verteilt:
 *   6 Kategorien mit 5 Mails + 5 Kategorien mit 4 Mails = 50
 *
 * Voraussetzungen:
 *   npm install nodemailer
 *
 * Konfiguration über Umgebungsvariablen (.env oder Shell):
 *   SMTP_HOST       z.B. smtp.gmail.com / smtp.office365.com / mail.your-server.de
 *   SMTP_PORT       z.B. 587 (STARTTLS) oder 465 (SSL)
 *   SMTP_SECURE     "true" für Port 465, sonst "false"
 *   SMTP_USER       SMTP-Benutzername
 *   SMTP_PASS       SMTP-Passwort / App-Passwort
 *   SMTP_FROM       Absenderadresse, z.B. "Hausverwaltung <noreply@example.com>"
 *   SMTP_TO         (optional) Standard: daniel.tauscher@akturio.com
 *   SEND_DELAY_MS   (optional) Verzögerung zwischen Mails, Default 1500
 *   DRY_RUN         "true" => keine Mails versenden, nur Vorschau ausgeben
 *
 * Aufruf:
 *   node send-emails.js
 */

const nodemailer = require('nodemailer');

// ---------- Konfiguration ----------
const CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.ionos.de',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  user: process.env.SMTP_USER || 'demo@akturio.com',
  pass: process.env.SMTP_PASS || 'm7WjQ.P8eyad@',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "demo@akturio.com",
  to: process.env.SMTP_TO || 'daniel.tauscher@akturio.com',
  delayMs: parseInt(process.env.SEND_DELAY_MS || '1500', 10),
  dryRun: (process.env.DRY_RUN || 'false').toLowerCase() === 'true',
};

// ---------- E-Mail-Vorlagen pro Kategorie ----------
// 11 Kategorien, insgesamt 50 Mails:
// objektbezogen, Mieterkommunikation, Finanzen & Abrechnung,
// Schäden & Instandhaltung, Verträge & Dokumente, Eigentümer / WEG,
// Behörden & Recht, Dienstleister & Partner, Termine & Organisation,
// Intern, Newsletter
//
// Verteilung: 6 Kategorien à 5 Mails + 5 Kategorien à 4 Mails = 50

const EMAILS = [
  // ===== objektbezogen (5) =====
  {
    category: 'objektbezogen',
    subject: 'Neue Objektaufnahme: Goethestraße 14, Leipzig',
    body:
`Sehr geehrter Herr Tauscher,

wir haben heute das Objekt Goethestraße 14 in 04109 Leipzig in unsere Verwaltung übernommen.
Es handelt sich um ein Mehrfamilienhaus mit 12 Wohneinheiten und 2 Gewerbeeinheiten.

Bitte legen Sie das Objekt im System an und ordnen Sie folgende Stammdaten zu:
- Eigentümer: Müller Immobilien GbR
- Baujahr: 1908
- Wohnfläche gesamt: 980 m²
- Hausmeister: Herr Schneider

Mit freundlichen Grüßen
Hausverwaltung Berkovich`,
  },
  {
    category: 'objektbezogen',
    subject: 'Leerstand WE 7 - Karl-Liebknecht-Str. 102',
    body:
`Hallo Daniel,

die Wohnung Nr. 7 (3. OG rechts) im Objekt Karl-Liebknecht-Str. 102 steht seit dem 01.04. leer.
Die Vormieter sind ausgezogen, Übergabeprotokoll liegt vor.

Bitte:
1. Inserat auf ImmoScout24 und Immowelt schalten
2. Kaltmiete 720 EUR, NK 180 EUR, Kaution 2.160 EUR
3. Besichtigungstermine über mein Kalender koordinieren

Danke und Gruß
Berko`,
  },
  {
    category: 'objektbezogen',
    subject: 'Schlüsselverwaltung - neuer Schließplan Riemannstraße 8',
    body:
`Sehr geehrter Herr Tauscher,

nach dem Einbruch in der vergangenen Woche wurde die Schließanlage in der Riemannstraße 8
komplett ausgetauscht. Der neue Schließplan liegt der Mail bei (Anhang folgt).

Bitte aktualisieren Sie:
- Schlüsselbuch im Objekt
- Übersicht der ausgegebenen Schlüssel
- Hausmeister informieren über neue Generalschlüssel

Vielen Dank
Berko`,
  },
  {
    category: 'objektbezogen',
    subject: 'Energieausweis Eisenbahnstraße 47 läuft ab',
    body:
`Hallo Daniel,

der Energieausweis für das Objekt Eisenbahnstraße 47 läuft am 30.06. ab.
Bitte beauftrage rechtzeitig einen neuen Verbrauchsausweis bei Energieberater Krause.

Letzte Verbrauchsdaten der Heizung sollten von Techem direkt übermittelt werden können.

Gruß
Berko`,
  },
  {
    category: 'objektbezogen',
    subject: 'Stammdaten-Update: Aufzug Connewitzer Kreuz 3',
    body:
`Sehr geehrter Herr Tauscher,

der Aufzug im Objekt Connewitzer Kreuz 3 wurde am 28.04. modernisiert.
Neue Daten für die Anlagenbuchhaltung:

- Hersteller: Schindler 3300
- Tragkraft: 630 kg / 8 Personen
- TÜV-Prüfung neu: 28.04.2027
- Wartungsvertrag: Schindler Aufzüge AG, monatlich 89 EUR netto

Bitte im Objektstamm hinterlegen.

MfG
Berkovich`,
  },

  // ===== Mieterkommunikation (5) =====
  {
    category: 'Mieterkommunikation',
    subject: 'Anfrage Mieter Frau Becker - Untervermietung',
    body:
`Sehr geehrter Herr Tauscher,

Frau Anja Becker (WE 4, Hofer Str. 23) hat schriftlich um Erlaubnis zur teilweisen
Untervermietung ihres Arbeitszimmers gebeten. Sie möchte einen Studenten für 6 Monate
aufnehmen.

Bitte prüfen, ob ein berechtigtes Interesse nach § 553 BGB vorliegt und einen
Antwortentwurf vorbereiten.

Mit besten Grüßen
Berko`,
  },
  {
    category: 'Mieterkommunikation',
    subject: 'Beschwerde wegen Lärm - Fam. Petrov',
    body:
`Hallo Daniel,

Familie Petrov (EG, Karl-Heine-Str. 12) hat sich erneut über nächtlichen Lärm aus der
Wohnung darüber beschwert (Mieter: Hr. Wagner). Es ist die dritte Beschwerde innerhalb
von 6 Wochen.

Bitte:
1. Höfliches Ermahnungsschreiben an Hr. Wagner aufsetzen
2. Hinweis auf Hausordnung und ggf. Abmahnung bei Wiederholung
3. Frau Petrov kurz schriftlich bestätigen, dass wir aktiv geworden sind

Danke
Berko`,
  },
  {
    category: 'Mieterkommunikation',
    subject: 'Kündigung Mietverhältnis - Hr. Schulz zum 31.07.',
    body:
`Sehr geehrter Herr Tauscher,

Herr Markus Schulz (Industriestr. 8, WE 2) hat heute fristgerecht zum 31.07. gekündigt.
Eingang Kündigung: 28.04. per Einschreiben.

Bitte:
- Kündigungseingang bestätigen
- Vorabnahmetermin für 15.07. anbieten
- Bewerbersuche starten
- Kautionsabrechnung vorbereiten

MfG
Berkovich`,
  },
  {
    category: 'Mieterkommunikation',
    subject: 'Mieterhöhung WE 12 nach Modernisierung',
    body:
`Hallo Daniel,

nach der energetischen Modernisierung in der Lützner Str. 198 (neue Fenster, Dämmung)
können wir eine Modernisierungsmieterhöhung nach § 559 BGB durchführen.

Modernisierungskosten gesamt: 48.500 EUR umlagefähig
Anteil WE 12: ca. 12% = 5.820 EUR
8% jährlich = 465,60 EUR / Jahr = 38,80 EUR / Monat

Bitte Erhöhungsschreiben formal korrekt vorbereiten (3 Monate Frist beachten).

Gruß
Berko`,
  },
  {
    category: 'Mieterkommunikation',
    subject: 'Anfrage Haustierhaltung - Frau Krüger',
    body:
`Sehr geehrter Herr Tauscher,

Frau Sandra Krüger (WE 3, Bornaische Str. 54) möchte eine kleine Hauskatze halten.
Im Mietvertrag steht keine konkrete Regelung, nur "Tierhaltung in Absprache".

Da es sich um eine Kleintierhaltung handelt und keine Beeinträchtigung anderer Mieter
zu erwarten ist, sehe ich kein Hindernis. Bitte schriftliche Zustimmung formulieren
mit Hinweis auf Schadenersatzpflicht bei Beschädigungen.

Danke
Berko`,
  },

  // ===== Finanzen & Abrechnung (5) =====
  {
    category: 'Finanzen & Abrechnung',
    subject: 'Nebenkostenabrechnung 2024 - Objekt Plagwitzer Str. 67',
    body:
`Sehr geehrter Herr Tauscher,

die Nebenkostenabrechnung für das Wirtschaftsjahr 2024 für das Objekt Plagwitzer Str. 67
ist fertig zur Prüfung. Eckdaten:

- Gesamtkosten umlagefähig: 38.420,67 EUR
- Verteilerschlüssel: Wohnfläche bzw. Verbrauch
- 9 von 12 Mietern erhalten Nachzahlung
- 3 Mieter erhalten Guthaben
- Höchste Nachzahlung: 412 EUR (WE 8)

Bitte vor Versand nochmal gegenprüfen.

MfG
Berkovich`,
  },
  {
    category: 'Finanzen & Abrechnung',
    subject: 'Mietrückstand Hr. Özdemir - 2 Monate',
    body:
`Hallo Daniel,

Herr Özdemir (Zschocherrsche Str. 14, WE 5) hat aktuell 2 Monatsmieten Rückstand
(März + April, je 685 EUR = 1.370 EUR offen).

Bisher: keine Reaktion auf Erinnerung vom 10.04.

Vorschlag:
1. Mahnung mit 14-Tage-Frist
2. Falls keine Reaktion: Kündigung wegen Zahlungsverzugs nach § 543 BGB vorbereiten
3. SCHUFA-Hinweis prüfen

Bitte bestätigen, dann setze ich um.

Gruß
Berko`,
  },
  {
    category: 'Finanzen & Abrechnung',
    subject: 'Heizkostenabrechnung Techem - Plausibilitätsprüfung',
    body:
`Sehr geehrter Herr Tauscher,

Techem hat die Heizkostenabrechnungen für 4 unserer Objekte geliefert.
Bei Objekt Mockauer Str. 22 fällt der Verbrauch von WE 11 auffällig hoch aus
(+ 87% gegenüber Vorjahr).

Bitte prüfen:
- Ablesefehler?
- Defekt am Thermostat?
- Ggf. Vor-Ort-Termin mit Hausmeister koordinieren

Vielen Dank
Berkovich`,
  },
  {
    category: 'Finanzen & Abrechnung',
    subject: 'Hausgeldzahlungen WEG Riebeckstr. 17 - Übersicht April',
    body:
`Hallo Daniel,

bitte erstelle die monatliche Hausgeld-Übersicht für die WEG Riebeckstr. 17 (Stand 30.04.):

- Eingegangene Zahlungen
- Säumige Eigentümer
- Aktueller Stand Instandhaltungsrücklage
- Aktueller Stand Bewirtschaftungskonto

Versand an die Eigentümer wie üblich am 5. des Folgemonats.

Danke
Berko`,
  },
  {
    category: 'Finanzen & Abrechnung',
    subject: 'Mietanpassung Indexmiete Hr. Lehmann',
    body:
`Sehr geehrter Herr Tauscher,

der Mietvertrag mit Hr. Lehmann (Gewerbeeinheit, Lützner Str. 198) enthält eine
Indexklausel (VPI). Die letzte Anpassung war im Mai 2024.

Aktueller Stand:
- VPI Mai 2024: 119,3
- VPI März 2026: 124,8 (laut destatis.de)
- Steigerung: ca. 4,6%

Bitte Anpassungsschreiben formal korrekt vorbereiten und an mich zur Freigabe.

MfG
Berkovich`,
  },

  // ===== Schäden & Instandhaltung (5) =====
  {
    category: 'Schäden & Instandhaltung',
    subject: 'Wasserschaden Bad WE 4 - Hofer Str. 23',
    body:
`Sehr geehrter Herr Tauscher,

DRINGEND: Frau Becker meldet einen Wasserschaden im Bad. Eckventil am Waschtisch
undicht, Wasser läuft auf Dielenboden.

Erforderlich:
1. Notdienst-Sanitär heute kontaktieren (Klempnerei Müller)
2. Trocknungsfirma für morgen einplanen (Belfor o. ähnliches)
3. Versicherung Allianz Hausrat informieren
4. Nachbar unter ihr (WE 2) prüfen, ob Durchfeuchtung vorhanden

Ich fahre selbst hin.

Berko`,
  },
  {
    category: 'Schäden & Instandhaltung',
    subject: 'Heizungsausfall Mehrfamilienhaus Eisenbahnstr. 47',
    body:
`Hallo Daniel,

die Heizungsanlage (Vaillant ecoTEC plus, Bj. 2018) ist heute Nacht ausgefallen.
3 Mieter haben sich gemeldet.

Status:
- Notdienst Heizungsbau Krause war vor Ort
- Diagnose: defekter Druckschalter
- Ersatzteil bestellt, Lieferung morgen
- Übergangsweise elektrische Heizlüfter verteilt (Kosten 240 EUR)

Bitte Schadensmeldung für Versicherung vorbereiten.

Gruß
Berko`,
  },
  {
    category: 'Schäden & Instandhaltung',
    subject: 'Dachrinne Karl-Heine-Str. 12 - Wartung fällig',
    body:
`Sehr geehrter Herr Tauscher,

bei der letzten Begehung wurde festgestellt, dass die Dachrinne im Hofbereich
zugesetzt ist (Laub, Moos). Risiko von Wassereintritt in Nachbargebäude.

Bitte:
1. 3 Angebote für Reinigung einholen (Dachdecker)
2. Optimal vor der Regenperiode im Mai erledigen
3. Budget bis 800 EUR netto kann ich freigeben

MfG
Berkovich`,
  },
  {
    category: 'Schäden & Instandhaltung',
    subject: 'Schimmelbildung Schlafzimmer WE 6 - Mockauer Str. 22',
    body:
`Hallo Daniel,

Mieter Familie Hoffmann meldet Schimmel an der Außenwand im Schlafzimmer.
Erste Begehung erfolgt durch Hausmeister Schneider.

Vorgehen:
1. Sachverständigengutachten beauftragen (Dr. Lange aus Halle)
2. Klärung Ursache: bauliche Mängel oder Lüftungsverhalten
3. Mieter parallel auf richtiges Lüften hinweisen (Merkblatt)
4. Bis zur Klärung Mietminderung vorab in Aussicht stellen (10%)

Gruß
Berko`,
  },
  {
    category: 'Schäden & Instandhaltung',
    subject: 'Treppenhaus-Renovierung Bornaische Str. 54',
    body:
`Sehr geehrter Herr Tauscher,

das Treppenhaus im Objekt Bornaische Str. 54 ist seit 12 Jahren nicht renoviert.
Wände stark vergilbt, Geländer angerostet.

Vorschlag für die nächste WEG-Versammlung:
- Maler-Angebot ca. 4.200 EUR
- Geländer schleifen + lackieren ca. 1.800 EUR
- Gesamtkosten ca. 6.000 EUR aus Instandhaltungsrücklage

Bitte Beschlussvorlage für die Eigentümer vorbereiten.

MfG
Berkovich`,
  },

  // ===== Verträge & Dokumente (5) =====
  {
    category: 'Verträge & Dokumente',
    subject: 'Neuer Mietvertrag - Hr. und Fr. Vogel',
    body:
`Sehr geehrter Herr Tauscher,

bitte erstelle einen neuen Mietvertrag für:

Mieter: Thomas und Lisa Vogel
Objekt: Industriestr. 8, WE 2
Mietbeginn: 01.08.2026
Kaltmiete: 845 EUR
NK-Vorauszahlung: 195 EUR
Kaution: 2.535 EUR (3 Kaltmieten)
Befristung: unbefristet

Standard-Vertrag mit Indexklausel und Kleinreparaturklausel (max. 100 EUR / Fall).

Danke
Berko`,
  },
  {
    category: 'Verträge & Dokumente',
    subject: 'Hausordnung Aktualisierung 2026',
    body:
`Hallo Daniel,

unsere Standard-Hausordnung muss aktualisiert werden.
Geänderte Punkte:

1. Neue Regelung E-Bike-Ladestationen im Hof
2. Mülltrennung gemäß neuer Leipziger Abfallsatzung
3. Klarstellung Ruhezeiten (22-7 Uhr werktags, ganztags So+Feiertag)
4. Hinweis auf Rauchverbot in Treppenhaus und Keller

Bitte Entwurf bis Freitag, ich gebe ihn dann zur Freigabe an die Eigentümer.

Gruß
Berko`,
  },
  {
    category: 'Verträge & Dokumente',
    subject: 'Hausmeister-Vertrag Hr. Schneider Verlängerung',
    body:
`Sehr geehrter Herr Tauscher,

der Hausmeisterdienstvertrag mit Hr. Frank Schneider läuft am 30.06. aus.
Er hat sehr gute Arbeit geleistet.

Vorschlag:
- Verlängerung um 24 Monate
- Anpassung Vergütung von 1.450 EUR auf 1.580 EUR / Monat (8% Inflation)
- Aufnahme zusätzliche Objekte (Riemannstr. 8, +180 EUR)

Bitte Vertragsentwurf vorbereiten.

MfG
Berkovich`,
  },
  {
    category: 'Verträge & Dokumente',
    subject: 'Übergabeprotokoll WE 7 Karl-Liebknecht-Str. 102',
    body:
`Hallo Daniel,

am 15.05. um 14:00 Uhr findet die Wohnungsübergabe an die neuen Mieter
(Familie Roth) in der Karl-Liebknecht-Str. 102, WE 7 statt.

Bitte Übergabeprotokoll vorbereiten:
- Zählerstände-Felder (Strom, Wasser kalt/warm, Heizung)
- Schlüsselübergabe-Tabelle (3x Wohnung, 2x Haustür, 1x Keller, 1x Briefkasten)
- Mängelliste / Zustand der Räume
- Rauchmelder-Check

Vorlage aus dem System nutzen, vorausgefüllt mit Daten der WE 7.

Danke
Berko`,
  },
  {
    category: 'Verträge & Dokumente',
    subject: 'Datenschutzerklärung für Mieter aktualisieren',
    body:
`Sehr geehrter Herr Tauscher,

wir müssen die Datenschutzerklärung für unsere Mieter nach den neuen DSGVO-Hinweisen
des LfDI Sachsen aktualisieren.

Schwerpunkte:
- Klarere Zwecke der Datenverarbeitung
- Speicherfristen konkret benennen (10 Jahre nach Vertragsende)
- Hinweis auf Auftragsverarbeiter (Techem, Brunata, etc.)
- Ergänzung Auskunfts- und Löschungsrechte

Bitte Entwurf erstellen, ich lasse rechtlich prüfen.

MfG
Berkovich`,
  },

  // ===== Eigentümer / WEG (5) =====
  {
    category: 'Eigentümer / WEG',
    subject: 'Einladung Eigentümerversammlung WEG Goethestr. 14',
    body:
`Sehr geehrter Herr Tauscher,

bitte Einladung zur ordentlichen Eigentümerversammlung der WEG Goethestr. 14 vorbereiten:

Termin: 18.06.2026, 18:30 Uhr
Ort: Hotel Mercure Leipzig City, Tagungsraum 2

Tagesordnungspunkte:
1. Begrüßung, Beschlussfähigkeit
2. Jahresabrechnung 2025
3. Wirtschaftsplan 2026
4. Beschluss Dachsanierung
5. Entlastung Verwalter
6. Verschiedenes

Frist: Versand mind. 3 Wochen vor Termin (also bis 28.05.).

MfG
Berkovich`,
  },
  {
    category: 'Eigentümer / WEG',
    subject: 'Beschlusssammlung WEG Riebeckstr. 17 aktualisieren',
    body:
`Hallo Daniel,

nach der Eigentümerversammlung vom 22.04. müssen folgende Beschlüsse in die
Beschlusssammlung aufgenommen werden:

- TOP 4: Beauftragung Dachrinnenreinigung (einstimmig)
- TOP 5: Sonderumlage 8.000 EUR für Heizungsmodernisierung (mehrheitlich)
- TOP 7: Wahl neuer Verwaltungsbeirat (Hr. Klein, Fr. Walter, Hr. Bauer)

Bitte gemäß § 24 Abs. 7 WEG ergänzen und Eigentümern Kopie schicken.

Danke
Berko`,
  },
  {
    category: 'Eigentümer / WEG',
    subject: 'Wirtschaftsplan 2027 - WEG Plagwitzer Str. 67',
    body:
`Sehr geehrter Herr Tauscher,

bitte Entwurf Wirtschaftsplan 2027 für die WEG Plagwitzer Str. 67 erstellen.

Anpassungen ggü. 2026:
- Erhöhung Zuführung Instandhaltungsrücklage von 8.000 auf 10.000 EUR/Jahr
- Heizkosten +12% (aktuelle Gaspreise)
- Versicherung +6% (Wohngebäude)
- Hausmeister +9%
- Verwaltergebühr unverändert

Vorlage zur Beschlussfassung in der nächsten Eigentümerversammlung.

MfG
Berkovich`,
  },
  {
    category: 'Eigentümer / WEG',
    subject: 'Anfrage Eigentümer Hr. Dr. Müller - Sondereigentum',
    body:
`Hallo Daniel,

Hr. Dr. Müller (Eigentümer WE 5, Goethestr. 14) plant einen Wanddurchbruch zwischen
Wohnzimmer und Küche.

Frage: Ist das tragend? Bedarf das einer WEG-Zustimmung?

Bitte:
1. Teilungserklärung prüfen (welche Wände sind Gemeinschaftseigentum)
2. Statiker-Empfehlung an Eigentümer geben
3. Falls notwendig: TOP für nächste Eigentümerversammlung

Gruß
Berko`,
  },
  {
    category: 'Eigentümer / WEG',
    subject: 'Verwaltervertrag WEG Industriestr. 8 - Verlängerung',
    body:
`Sehr geehrter Herr Tauscher,

unser Verwaltervertrag mit der WEG Industriestr. 8 läuft am 31.12.2026 aus.
Wir sollten frühzeitig die Verlängerung anstoßen.

Bitte bereite vor:
- Aktualisiertes Angebot mit Konditionen 2027ff
- Übersicht der erbrachten Leistungen 2024-2026
- Vergleich Marktpreise (für Argumentation)
- Beschlussvorschlag für die nächste Eigentümerversammlung

MfG
Berkovich`,
  },

  // ===== Behörden & Recht (4) =====
  {
    category: 'Behörden & Recht',
    subject: 'Räumungsklage Hr. Özdemir - Stand',
    body:
`Hallo Daniel,

zum aktuellen Stand der Räumungsklage gegen Hr. Özdemir (Zschocherrsche Str. 14):

- Klage wurde am 14.04. beim AG Leipzig eingereicht
- Aktenzeichen: 12 C 234/26
- Erste mündliche Verhandlung: 03.06.2026
- RA Dr. Walter vertritt uns

Bitte Akte digital ablegen und Termin in Kalender mit Erinnerung 5 Tage vorher.

Gruß
Berko`,
  },
  {
    category: 'Behörden & Recht',
    subject: 'Grundsteuer-Bescheid 2026 prüfen',
    body:
`Sehr geehrter Herr Tauscher,

die Grundsteuer-Bescheide 2026 vom Finanzamt Leipzig sind für 7 Objekte eingegangen.

Auffälligkeiten:
- Goethestr. 14: Erhöhung um 18% (war 1.245 EUR, jetzt 1.470 EUR)
- Riemannstr. 8: keine Änderung
- Mockauer Str. 22: leichte Senkung (-3%)

Bitte alle Bescheide auf Plausibilität prüfen und bei Auffälligkeiten Einspruchsfrist
(1 Monat) im Auge behalten.

MfG
Berkovich`,
  },
  {
    category: 'Behörden & Recht',
    subject: 'Schornsteinfeger-Bescheid - Feuerstättenbescheid',
    body:
`Hallo Daniel,

der bevollmächtigte Bezirksschornsteinfeger Hr. Bauer hat den Feuerstättenbescheid
für 4 unserer Objekte zugestellt.

Wichtige Termine:
- Eisenbahnstr. 47: Hauptkehrung Q3/2026
- Karl-Heine-Str. 12: Messung Heizung 09/2026
- Industriestr. 8: Hauptkehrung Q4/2026
- Mockauer Str. 22: Sichtprüfung 11/2026

Bitte alle Termine in den Objektkalender eintragen, Mieter rechtzeitig informieren.

Danke
Berko`,
  },
  {
    category: 'Behörden & Recht',
    subject: 'DSGVO Auskunftsersuchen - Frau Becker',
    body:
`Sehr geehrter Herr Tauscher,

Frau Becker (Hofer Str. 23) hat einen DSGVO-Auskunftsantrag nach Art. 15 DSGVO gestellt.
Sie möchte Auskunft über alle bei uns gespeicherten Daten.

Frist: 1 Monat (also bis 28.05.2026).

Bitte:
1. Daten zusammenstellen (Stammdaten, Mietvertrag, Schriftverkehr, Zahlungen)
2. Strukturierter Auskunftsbescheid nach unserem Standardtemplate
3. Vor Versand an mich zur Freigabe

MfG
Berkovich`,
  },

  // ===== Dienstleister & Partner (4) =====
  {
    category: 'Dienstleister & Partner',
    subject: 'Angebot Reinigungsfirma Klar & Sauber',
    body:
`Sehr geehrter Herr Tauscher,

die Reinigungsfirma Klar & Sauber GmbH hat ein neues Angebot für Treppenhausreinigung
in 3 unserer Objekte abgegeben:

- Goethestr. 14: 285 EUR / Monat (vorher 245 EUR)
- Riemannstr. 8: 198 EUR / Monat (vorher 175 EUR)
- Industriestr. 8: 320 EUR / Monat (vorher 290 EUR)

Erhöhung ca. 12-13%, Begründung: Mindestlohnerhöhung und Materialkosten.

Bitte 2 Vergleichsangebote einholen, bevor wir verlängern.

MfG
Berkovich`,
  },
  {
    category: 'Dienstleister & Partner',
    subject: 'Versicherung Wohngebäude - Allianz Tarifwechsel',
    body:
`Hallo Daniel,

unser Versicherungsmakler Hr. Wolf empfiehlt einen Tarifwechsel bei der Wohngebäude-
versicherung von Allianz Standard auf Allianz Premium.

Vorteile:
- Elementarschäden bereits enthalten (vorher Zusatz)
- Neuwertentschädigung statt Zeitwert
- Höhere Deckungssumme bei Glas

Mehrkosten: ca. 8% / Jahr.
Sinnvoll, da viele unserer Objekte in Hochwasser-gefährdeten Gebieten (Plagwitz, Lindenau).

Bitte detaillierten Vergleich zur Freigabe.

Gruß
Berko`,
  },
  {
    category: 'Dienstleister & Partner',
    subject: 'Neuer Heizungs-Wartungspartner gesucht',
    body:
`Sehr geehrter Herr Tauscher,

Heizungsbau Krause hat seine Preise für 2026 um 18% erhöht.
Das ist nicht mehr marktgerecht.

Bitte:
1. 3 Angebote bei Heizungsbauern aus Leipzig einholen
2. Vergleich Preise + Reaktionszeit Notdienst
3. Empfehlung für mich vorbereiten
4. Wir können bei Bedarf Bestandsverträge mit 3 Monaten Frist kündigen

MfG
Berkovich`,
  },
  {
    category: 'Dienstleister & Partner',
    subject: 'Techem Vertragsverlängerung',
    body:
`Hallo Daniel,

der Servicevertrag mit Techem für Heizkostenabrechnung und Geräteservice
in 6 Objekten läuft 31.12.2026 aus.

Aktuelle Konditionen:
- Geräteservice: 4,80 EUR / Erfassungsgerät / Jahr
- Abrechnungsdienstleistung: 18 EUR / Wohneinheit / Jahr
- Funkablesung: enthalten

Alternative: Brunata Metrona prüfen. Ggf. Wechsel-Angebote anfordern.

Gruß
Berko`,
  },

  // ===== Termine & Organisation (4) =====
  {
    category: 'Termine & Organisation',
    subject: 'Begehung Goethestr. 14 - Termin 12.05.',
    body:
`Sehr geehrter Herr Tauscher,

bitte koordinieren Sie die nächste Objektbegehung Goethestr. 14:

Datum: 12.05.2026, ab 10:00 Uhr
Teilnehmer:
- Hausmeister Schneider
- Architekt Lehmann (wegen Dach)
- Sie als Verwalter
- Ich

Ablauf: Keller, Treppenhaus, Dachboden, Hof, Fassade.
Bitte Begehungsprotokoll vorbereiten und vorab versenden.

MfG
Berkovich`,
  },
  {
    category: 'Termine & Organisation',
    subject: 'Wochenplan KW 19 - Besichtigungen',
    body:
`Hallo Daniel,

bitte stelle den Wochenplan für die Wohnungsbesichtigungen in KW 19 zusammen:

Anstehende WEs:
- WE 7 Karl-Liebknecht-Str. 102 (3 Interessenten)
- WE 12 Lützner Str. 198 (5 Interessenten)
- WE 4 Riemannstr. 8 (2 Interessenten)

Ziel: Sammeltermine, max. 30 Min Abstand.
Doodle-Link an Interessenten verschicken.

Gruß
Berko`,
  },
  {
    category: 'Termine & Organisation',
    subject: 'Jahresplanung 2026 - Termine eintragen',
    body:
`Sehr geehrter Herr Tauscher,

bitte folgende wiederkehrende Termine in den Jahreskalender 2026 eintragen:

- Q2: Eigentümerversammlungen alle WEGs
- Juni: TÜV Aufzüge (3 Objekte)
- Juli: Spielplatzprüfung
- August: Brandverhütungsschau Industriestr. 8
- September: Heizungsanlagen-Wartung
- Oktober: Hauptkehrungen Schornsteinfeger
- November: NK-Abrechnungen 2025 fertigstellen
- Dezember: Wirtschaftspläne 2027

MfG
Berkovich`,
  },
  {
    category: 'Termine & Organisation',
    subject: 'Mieter-Sprechstunde Mai - Anmeldungen',
    body:
`Hallo Daniel,

am 14.05.2026 von 16-18 Uhr findet die monatliche Mieter-Sprechstunde im Büro statt.

Bisherige Anmeldungen:
1. Fam. Petrov (Karl-Heine-Str. 12) - Lärmproblematik
2. Hr. Wagner - Reaktion auf Ermahnung
3. Frau Krüger - Haustier-Anfrage
4. Fam. Hoffmann - Schimmel-Update

Bitte: Termine je 20 Min einplanen, Akten vorbereiten, Wartebereich organisieren.

Gruß
Berko`,
  },

  // ===== Intern (4) =====
  {
    category: 'Intern',
    subject: 'Team-Meeting Montag 09:00 - Agenda',
    body:
`Hallo Daniel,

unser wöchentliches Team-Meeting findet wie immer Montag 09:00 Uhr statt.

Agenda:
1. Status laufende Projekte (jeder kurz)
2. Neue Objekte in Aufnahme
3. Engpässe / Eskalationen
4. Schulungsbedarf Akturio (neue Software)
5. Urlaubsplanung Sommer
6. Verschiedenes

Bitte Themen ergänzen, falls nötig. Dauer max. 60 Min.

Gruß
Berko`,
  },
  {
    category: 'Intern',
    subject: 'Urlaubsvertretung - Abstimmung Juni',
    body:
`Sehr geehrter Herr Tauscher,

ich bin vom 15.-26. Juni im Urlaub. Bitte Vertretungsregelung abstimmen:

- Notfälle (Wasser, Heizung): Hr. Schmidt (Mobil)
- Mieter-Anfragen: Sie persönlich
- Buchhaltung: Frau Wagner
- Eigentümerversammlung am 18.06.: bitte verschieben oder Sie übernehmen

Bitte Bestätigung bis Freitag.

MfG
Berkovich`,
  },
  {
    category: 'Intern',
    subject: 'Akturio-Schulung Termine - Anmeldung',
    body:
`Hallo Daniel,

die Schulung zur neuen Akturio-Software (unser zukünftiges Verwalter-Tool) ist
terminiert:

- Modul 1: Stammdaten & Objekte - 20.05., 14-17 Uhr
- Modul 2: Buchhaltung & Abrechnung - 27.05., 14-17 Uhr
- Modul 3: WEG-Verwaltung - 03.06., 14-17 Uhr
- Modul 4: Mieter-Self-Service-Portal - 10.06., 14-17 Uhr

Bitte ALLE Mitarbeiter anmelden, ist Pflichtschulung.
Nachbereitung-Materialien per E-Mail an Teilnehmer.

Gruß
Berko`,
  },
  {
    category: 'Intern',
    subject: 'IT-Update: Neue E-Mail-Signatur',
    body:
`Sehr geehrter Herr Tauscher,

ab 01.05. gilt eine neue einheitliche E-Mail-Signatur für alle Mitarbeiter:

---
Vor- und Nachname
Position
Berkovich Estate / Hausverwaltung
Beispielstraße 12, 04109 Leipzig
Tel: +49 341 1234567
E-Mail: name@berkovich-estate.de
Web: www.berkovich-estate.de

Geschäftsführer: Denis Berkovich
Sitz: Leipzig, HRB 12345
---

Bitte umstellen und Kollegen informieren.

MfG
Berkovich`,
  },

  // ===== Newsletter (4) =====
  {
    category: 'Newsletter',
    subject: 'Newsletter Mai 2026 - Hausverwaltung Berkovich',
    body:
`Sehr geehrte Mieter, sehr geehrte Eigentümer,

unser monatlicher Newsletter mit den wichtigsten Informationen rund um Ihre Immobilie:

THEMEN MAI 2026:
- Neue Mülltrennungspflichten in Leipzig ab 01.06.
- Tipps zum richtigen Lüften (Schimmelvorbeugung)
- Ankündigung: Modernisierung Eisenbahnstr. 47
- Vorstellung unseres neuen Hausmeisters Hr. Schneider

Wir wünschen Ihnen eine schöne Frühlingszeit!

Ihre Hausverwaltung Berkovich`,
  },
  {
    category: 'Newsletter',
    subject: 'Eigentümer-Newsletter Q2/2026',
    body:
`Sehr geehrte Eigentümerinnen und Eigentümer,

mit unserem Quartals-Newsletter informieren wir Sie über:

1. AKTUELLE GESETZESÄNDERUNGEN
- Heizungsgesetz (GEG) Anpassungen
- Neue Rauchmelder-Pflicht in Sachsen
- CO2-Aufteilung Vermieter / Mieter

2. MARKT-UPDATE LEIPZIG
- Mietpreisentwicklung Q1/2026
- Aktuelle Renditeerwartungen
- Trends auf dem Wohnungsmarkt

3. UNSERE LEISTUNGEN
- Neue digitale Eigentümer-Plattform live
- Erweiterte Notfall-Hotline 24/7

Ihre Hausverwaltung Berkovich`,
  },
  {
    category: 'Newsletter',
    subject: 'Sommer-Newsletter: Tipps für Mieter',
    body:
`Liebe Mieterinnen und Mieter,

der Sommer steht vor der Tür! Unsere Tipps für Sie:

HITZE-TIPPS
- Wohnung früh morgens und abends lüften
- Verdunkelung tagsüber
- Bei Klimagerät: vorher mit uns abstimmen

URLAUBS-TIPPS
- Wasserhaupthahn schließen
- Briefkasten regelmäßig leeren lassen
- Notfallkontakt bei uns hinterlegen

GARTEN/BALKON
- Pflanzen sicher befestigen (Sturmgefahr)
- Grillen nur auf erlaubten Flächen
- Rücksicht auf Nachbarn (Lautstärke)

Wir wünschen Ihnen einen schönen Sommer!

Ihre Hausverwaltung Berkovich`,
  },
  {
    category: 'Newsletter',
    subject: 'Sonder-Newsletter: Energie sparen im Mehrfamilienhaus',
    body:
`Sehr geehrte Bewohner,

angesichts der weiterhin volatilen Energiepreise möchten wir Sie unterstützen:

ENERGIE SPAR-TIPPS
- Heizung optimal einstellen (20-22°C Wohnraum, 17°C Schlafzimmer)
- Stoßlüften statt Kippstellung
- Geräte nicht im Standby lassen
- Wassersparende Duschköpfe (kostenlos bei uns abholbar)

GEMEINSCHAFTLICHE MASSNAHMEN
- Treppenhaus-Beleuchtung auf LED umgestellt (40% Einsparung)
- Heizungsanlagen werden hydraulisch abgeglichen
- Dämmung der obersten Geschossdecken in Planung

Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.

Ihre Hausverwaltung Berkovich`,
  },
];

// ---------- Hilfsfunktionen ----------

function validateConfig() {
  if (CONFIG.dryRun) return;
  const missing = [];
  if (!CONFIG.host) missing.push('SMTP_HOST');
  if (!CONFIG.user) missing.push('SMTP_USER');
  if (!CONFIG.pass) missing.push('SMTP_PASS');
  if (!CONFIG.from) missing.push('SMTP_FROM (oder SMTP_USER)');
  if (missing.length) {
    console.error('FEHLER: Fehlende Umgebungsvariablen:');
    missing.forEach((m) => console.error('  - ' + m));
    console.error('\nBitte setzen oder DRY_RUN=true verwenden.');
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeDistribution(emails) {
  const counts = {};
  for (const e of emails) counts[e.category] = (counts[e.category] || 0) + 1;
  return counts;
}

// ---------- Hauptlogik ----------

async function main() {
  console.log('==========================================');
  console.log('Hausverwaltungs-E-Mail-Versand');
  console.log('==========================================');
  console.log('Empfänger:           ' + CONFIG.to);
  console.log('Anzahl E-Mails:      ' + EMAILS.length);
  console.log('Verzögerung:         ' + CONFIG.delayMs + ' ms');
  console.log('DRY_RUN:             ' + CONFIG.dryRun);
  console.log('');

  const dist = summarizeDistribution(EMAILS);
  console.log('Verteilung nach Kategorie:');
  Object.entries(dist).forEach(([k, v]) => console.log('  ' + k.padEnd(28) + ': ' + v));
  console.log('');

  if (EMAILS.length !== 50) {
    console.error('FEHLER: Es sind ' + EMAILS.length + ' E-Mails definiert, erwartet: 50');
    process.exit(1);
  }

  validateConfig();

  let transporter = null;
  if (!CONFIG.dryRun) {
    transporter = nodemailer.createTransport({
      host: CONFIG.host,
      port: CONFIG.port,
      secure: CONFIG.secure,
      auth: { user: CONFIG.user, pass: CONFIG.pass },
    });

    try {
      await transporter.verify();
      console.log('SMTP-Verbindung erfolgreich verifiziert.\n');
    } catch (err) {
      console.error('SMTP-Verbindung fehlgeschlagen:', err.message);
      process.exit(1);
    }
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < EMAILS.length; i++) {
    const mail = EMAILS[i];
    //const subjectWithCategory = '[' + mail.category + '] ' + mail.subject;
    const subjectWithCategory = mail.subject;
    const num = String(i + 1).padStart(2, '0');

    if (CONFIG.dryRun) {
      console.log(num + '/50  [DRY] ' + subjectWithCategory);
      success++;
      continue;
    }

    try {
      const info = await transporter.sendMail({
        from: CONFIG.from,
        to: CONFIG.to,
        subject: subjectWithCategory,
        text: mail.body,
      });
      console.log(num + '/50  ✓ ' + subjectWithCategory + '   (id: ' + info.messageId + ')');
      success++;
    } catch (err) {
      console.error(num + '/50  ✗ ' + subjectWithCategory + '   FEHLER: ' + err.message);
      failed++;
    }

    if (i < EMAILS.length - 1) {
      await sleep(CONFIG.delayMs);
    }
  }

  console.log('');
  console.log('==========================================');
  console.log('Fertig. Erfolgreich: ' + success + ' / Fehler: ' + failed);
  console.log('==========================================');

  if (transporter) transporter.close();
}

main().catch((err) => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
