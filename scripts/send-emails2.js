#!/usr/bin/env node
/**
 * send-emails.js
 *
 * Versendet 50 realistische Hausverwaltungs-E-Mails an daniel.tauscher@akturio.com.
 * Die E-Mails sind gleichmäßig auf 11 Kategorien verteilt:
 *   6 Kategorien mit 5 Mails + 5 Kategorien mit 4 Mails = 50
 *
 * Jede E-Mail hat einen individuellen, zum Inhalt passenden Absender
 * (Mieter, Dienstleister, Behörden, Eigentümer usw.).
 *
 * ABSENDER-MODI (über SENDER_MODE):
 *   1. "reply-to" (Default, EMPFOHLEN):
 *      - Mail-FROM bleibt deine echte SMTP-Adresse
 *      - Anzeigename = simulierter Absender, z.B. '"Anja Becker (via Heinz)" <smtp@example.com>'
 *      - Reply-To-Header = simulierte Absenderadresse
 *      Funktioniert mit JEDEM SMTP-Server (Gmail, Office365, IONOS, eigener Server).
 *
 *   2. "spoof":
 *      - Mail-FROM = simulierter Absender direkt
 *      Funktioniert NUR, wenn der SMTP-Server beliebige Absenderadressen erlaubt
 *      (eigener Mailserver, Mailtrap, lokales Dev-Setup, ...).
 *      Bei Gmail/Office365/IONOS wird die Mail abgewiesen!
 *
 * Voraussetzungen:
 *   npm install nodemailer
 *
 * Konfiguration über Umgebungsvariablen:
 *   SMTP_HOST       z.B. smtp.gmail.com / smtp.office365.com / mail.your-server.de
 *   SMTP_PORT       z.B. 587 (STARTTLS) oder 465 (SSL)
 *   SMTP_SECURE     "true" für Port 465, sonst "false"
 *   SMTP_USER       SMTP-Benutzername
 *   SMTP_PASS       SMTP-Passwort / App-Passwort
 *   SMTP_FROM       Echte Absenderadresse, z.B. "noreply@Heinz-estate.de"
 *   SMTP_TO         (optional) Standard: daniel.tauscher@akturio.com
 *   SEND_DELAY_MS   (optional) Verzögerung zwischen Mails, Default 1500
 *   SENDER_MODE     (optional) "reply-to" (Default) oder "spoof"
 *   DRY_RUN         (optional) "true" => keine Mails versenden, nur Vorschau ausgeben
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
  senderMode: "reply-to",
  delayMs: parseInt(process.env.SEND_DELAY_MS || '1500', 10),
  dryRun: (process.env.DRY_RUN || 'false').toLowerCase() === 'true',
};
// ---------- E-Mail-Vorlagen mit individuellen Absendern ----------
// Jede E-Mail hat:
//   category : eine der 11 Kategorien
//   sender   : { name, email } - simulierter Absender, passend zum Inhalt
//   subject  : Betreff
//   body     : Mail-Text

const EMAILS = [
  // ===== objektbezogen (5) =====
  {
    category: 'objektbezogen',
    sender: { name: 'Heinz Estate – Aufnahme', email: 'aufnahme@Heinz-estate.de' },
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
Hausverwaltung Heinz`,
  },
  {
    category: 'objektbezogen',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'objektbezogen',
    sender: { name: 'Frank Schneider (Hausmeister)', email: 'schneider@hausmeister-leipzig.de' },
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
F. Schneider`,
  },
  {
    category: 'objektbezogen',
    sender: { name: 'Energieberatung Krause', email: 'info@energieberatung-krause.de' },
    subject: 'Energieausweis Eisenbahnstraße 47 läuft ab',
    body:
`Sehr geehrter Herr Tauscher,

der Energieausweis für das Objekt Eisenbahnstraße 47 läuft am 30.06. ab.
Wir bitten um rechtzeitige Beauftragung des neuen Verbrauchsausweises.

Letzte Verbrauchsdaten der Heizung können von Techem direkt übermittelt werden.
Bitte teilen Sie uns mit, ob wir die Anforderung übernehmen sollen.

Mit freundlichen Grüßen
Stefan Krause
Energieberater`,
  },
  {
    category: 'objektbezogen',
    sender: { name: 'Schindler Aufzüge AG', email: 'service.leipzig@schindler.com' },
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
Schindler Service Leipzig`,
  },

  // ===== Mieterkommunikation (5) =====
  {
    category: 'Mieterkommunikation',
    sender: { name: 'Anja Becker', email: 'anja.becker82@gmail.com' },
    subject: 'Anfrage Untervermietung Arbeitszimmer',
    body:
`Sehr geehrter Herr Tauscher,

ich wende mich mit der Bitte um Erlaubnis zur teilweisen Untervermietung an Sie.
Ich bewohne die WE 4 in der Hofer Str. 23 und möchte mein Arbeitszimmer für
6 Monate an einen Studenten untervermieten, da ich beruflich häufig im Ausland bin.

Bitte teilen Sie mir mit, welche Unterlagen Sie hierfür benötigen.

Mit freundlichen Grüßen
Anja Becker`,
  },
  {
    category: 'Mieterkommunikation',
    sender: { name: 'Familie Petrov', email: 'm.petrov@web.de' },
    subject: 'Erneute Lärmbelästigung durch Mieter über uns',
    body:
`Sehr geehrte Hausverwaltung,

leider müssen wir uns erneut über nächtlichen Lärm aus der Wohnung über uns
beschweren (Mieter Hr. Wagner, 1. OG, Karl-Heine-Str. 12). Es ist mittlerweile
die dritte Beschwerde innerhalb von 6 Wochen.

Letzte Nacht (Sa/So) wurde bis 03:00 Uhr morgens laut Musik gehört und es waren
mehrfach Stimmen und Schritte zu hören. Wir haben kleine Kinder und sind mit
unseren Nerven am Ende.

Wir bitten dringend um eine Klärung.

Mit freundlichen Grüßen
Familie Petrov`,
  },
  {
    category: 'Mieterkommunikation',
    sender: { name: 'Markus Schulz', email: 'markus.schulz77@gmx.de' },
    subject: 'Kündigung Mietverhältnis Industriestr. 8, WE 2 zum 31.07.',
    body:
`Sehr geehrte Damen und Herren,

hiermit kündige ich das Mietverhältnis über die Wohnung Industriestr. 8, WE 2
fristgerecht zum 31.07.2026.

Der Grund ist ein beruflich bedingter Umzug nach München.
Ich bitte Sie um eine kurze Bestätigung des Kündigungseingangs sowie um
einen frühzeitigen Vorabnahmetermin Mitte Juli.

Über eine Nachmieterregelung bin ich gerne bereit zu sprechen.

Mit freundlichen Grüßen
Markus Schulz`,
  },
  {
    category: 'Mieterkommunikation',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Mieterkommunikation',
    sender: { name: 'Sandra Krüger', email: 'sandra.krueger@t-online.de' },
    subject: 'Anfrage Haltung einer Hauskatze',
    body:
`Sehr geehrter Herr Tauscher,

ich bewohne seit zwei Jahren die WE 3 in der Bornaische Str. 54 und möchte eine
kleine Hauskatze (kastriert, ausschließlich Wohnungshaltung) bei mir aufnehmen.

In meinem Mietvertrag steht zur Tierhaltung "in Absprache mit dem Vermieter".
Ich bitte daher um Ihre schriftliche Zustimmung.

Selbstverständlich verpflichte ich mich, eventuelle Schäden zu ersetzen.

Mit freundlichen Grüßen
Sandra Krüger`,
  },

  // ===== Finanzen & Abrechnung (5) =====
  {
    category: 'Finanzen & Abrechnung',
    sender: { name: 'Buchhaltung Heinz Estate', email: 'buchhaltung@Heinz-estate.de' },
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
Buchhaltung`,
  },
  {
    category: 'Finanzen & Abrechnung',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Finanzen & Abrechnung',
    sender: { name: 'Techem Energy Services GmbH', email: 'kundenservice@techem.de' },
    subject: 'Heizkostenabrechnung Mockauer Str. 22 - Plausibilitätshinweis',
    body:
`Sehr geehrter Herr Tauscher,

anbei die Heizkostenabrechnungen für 4 Objekte in Ihrer Verwaltung.
Bei Objekt Mockauer Str. 22 fällt der Verbrauch von WE 11 auffällig hoch aus
(+ 87% gegenüber Vorjahr).

Mögliche Ursachen:
- Ablesefehler
- Defektes Erfassungsgerät
- Tatsächlich erhöhter Verbrauch

Wir empfehlen eine Kontrolle vor Ort. Gerne senden wir einen Techniker.

Mit freundlichen Grüßen
Techem Kundenservice`,
  },
  {
    category: 'Finanzen & Abrechnung',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Finanzen & Abrechnung',
    sender: { name: 'Buchhaltung Heinz Estate', email: 'buchhaltung@Heinz-estate.de' },
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
Buchhaltung`,
  },

  // ===== Schäden & Instandhaltung (5) =====
  {
    category: 'Schäden & Instandhaltung',
    sender: { name: 'Anja Becker', email: 'anja.becker82@gmail.com' },
    subject: 'DRINGEND: Wasserschaden im Bad - Hofer Str. 23, WE 4',
    body:
`Sehr geehrte Hausverwaltung,

ich melde mich mit einer dringenden Sache: In meinem Bad ist gerade Wasser unter
dem Waschtisch ausgetreten - vermutlich ein Eckventil. Das Wasser läuft auf den
Dielenboden.

Ich habe den Hauptwasserhahn der Wohnung geschlossen.

Bitte schnellstmöglich Notdienst schicken!
Erreichbar bin ich heute den ganzen Tag unter 0151-23456789.

Mit Grüßen
Anja Becker`,
  },
  {
    category: 'Schäden & Instandhaltung',
    sender: { name: 'Frank Schneider (Hausmeister)', email: 'schneider@hausmeister-leipzig.de' },
    subject: 'Heizungsausfall Eisenbahnstr. 47 - Status nach Notdienst',
    body:
`Sehr geehrter Herr Tauscher,

die Heizungsanlage (Vaillant ecoTEC plus, Bj. 2018) ist heute Nacht ausgefallen.
3 Mieter haben sich gemeldet.

Status nach Vor-Ort-Termin:
- Notdienst Heizungsbau Krause war vor Ort
- Diagnose: defekter Druckschalter
- Ersatzteil bestellt, Lieferung morgen
- Übergangsweise elektrische Heizlüfter verteilt (Kosten 240 EUR)

Bitte Schadensmeldung für Versicherung vorbereiten.

Gruß
F. Schneider`,
  },
  {
    category: 'Schäden & Instandhaltung',
    sender: { name: 'Frank Schneider (Hausmeister)', email: 'schneider@hausmeister-leipzig.de' },
    subject: 'Dachrinne Karl-Heine-Str. 12 - Wartung dringend fällig',
    body:
`Sehr geehrter Herr Tauscher,

bei meiner letzten Begehung habe ich festgestellt, dass die Dachrinne im Hofbereich
stark zugesetzt ist (Laub, Moos). Risiko von Wassereintritt in Nachbargebäude.

Bitte:
1. 3 Angebote für Reinigung einholen (Dachdecker)
2. Optimal vor der Regenperiode im Mai erledigen
3. Falls gewünscht, kann ich die Anfragen vorbereiten

Beste Grüße
F. Schneider`,
  },
  {
    category: 'Schäden & Instandhaltung',
    sender: { name: 'Familie Hoffmann', email: 'hoffmann.leipzig@gmx.net' },
    subject: 'Schimmelbildung im Schlafzimmer - Mockauer Str. 22, WE 6',
    body:
`Sehr geehrte Hausverwaltung,

wir haben in unserem Schlafzimmer an der Außenwand mehrere dunkle Flecken entdeckt,
die wir als Schimmel identifiziert haben. Der Befall hat sich in den letzten
zwei Wochen deutlich vergrößert (siehe Anhang folgt mit Foto).

Wir lüften regelmäßig (mind. 2x täglich Stoßlüften), die Möbel stehen mit Abstand
zur Wand. Wir vermuten daher eine bauliche Ursache.

Bitte nehmen Sie sich der Sache zeitnah an. Unsere Tochter (4 Jahre) schläft
in diesem Raum.

Mit freundlichen Grüßen
Sebastian und Mareike Hoffmann`,
  },
  {
    category: 'Schäden & Instandhaltung',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
    subject: 'Treppenhaus-Renovierung Bornaische Str. 54 - Beschlussvorlage',
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
jochen`,
  },

  // ===== Verträge & Dokumente (5) =====
  {
    category: 'Verträge & Dokumente',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Verträge & Dokumente',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Verträge & Dokumente',
    sender: { name: 'Frank Schneider (Hausmeister)', email: 'schneider@hausmeister-leipzig.de' },
    subject: 'Hausmeistervertrag - Verlängerung zum 01.07.',
    body:
`Sehr geehrter Herr Tauscher,

mein Dienstvertrag läuft am 30.06. aus. Ich möchte gerne verlängern und
übernehme bei Bedarf auch das Objekt Riemannstr. 8 zusätzlich.

Aufgrund der allgemeinen Kostensteigerung würde ich um eine Anpassung
der Vergütung von 1.450 EUR auf 1.580 EUR / Monat bitten, plus 180 EUR
für das Zusatzobjekt.

Bitte um Rückmeldung, ob das so umsetzbar ist.

Mit freundlichen Grüßen
Frank Schneider`,
  },
  {
    category: 'Verträge & Dokumente',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Verträge & Dokumente',
    sender: { name: 'RA Dr. Walter & Partner', email: 'kanzlei@walter-partner.de' },
    subject: 'Aktualisierung Datenschutzerklärung Mieter - Empfehlung',
    body:
`Sehr geehrter Herr Tauscher,

aufgrund der aktuellen DSGVO-Hinweise des LfDI Sachsen empfehlen wir, Ihre
Datenschutzerklärung für Mieter zu aktualisieren.

Schwerpunkte der Anpassung:
- Klarere Zwecke der Datenverarbeitung
- Speicherfristen konkret benennen (10 Jahre nach Vertragsende)
- Hinweis auf Auftragsverarbeiter (Techem, Brunata, etc.)
- Ergänzung Auskunfts- und Löschungsrechte

Wir können den Entwurf gerne übernehmen oder Ihren Entwurf gegenprüfen.

Mit freundlichen Grüßen
Dr. Andreas Walter
Rechtsanwalt`,
  },

  // ===== Eigentümer / WEG (5) =====
  {
    category: 'Eigentümer / WEG',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Eigentümer / WEG',
    sender: { name: 'Joachim Klein (Verwaltungsbeirat Riebeckstr. 17)', email: 'jklein.beirat@gmail.com' },
    subject: 'Beschlusssammlung WEG Riebeckstr. 17 - bitte aktualisieren',
    body:
`Sehr geehrter Herr Tauscher,

als Vorsitzender des neu gewählten Verwaltungsbeirats bitte ich Sie, die
Beschlüsse der Eigentümerversammlung vom 22.04. zeitnah in die Beschlusssammlung
aufzunehmen:

- TOP 4: Beauftragung Dachrinnenreinigung (einstimmig)
- TOP 5: Sonderumlage 8.000 EUR für Heizungsmodernisierung (mehrheitlich)
- TOP 7: Wahl neuer Verwaltungsbeirat (Hr. Klein, Fr. Walter, Hr. Bauer)

Gemäß § 24 Abs. 7 WEG bitten wir um Aufnahme und Versand einer Kopie an alle
Eigentümer.

Mit freundlichen Grüßen
Joachim Klein
Verwaltungsbeirat`,
  },
  {
    category: 'Eigentümer / WEG',
    sender: { name: 'Buchhaltung Heinz Estate', email: 'buchhaltung@Heinz-estate.de' },
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
Buchhaltung`,
  },
  {
    category: 'Eigentümer / WEG',
    sender: { name: 'Dr. Stefan Müller', email: 'dr.s.mueller@outlook.de' },
    subject: 'Anfrage zu geplantem Wanddurchbruch Wohnzimmer/Küche',
    body:
`Sehr geehrter Herr Tauscher,

als Eigentümer der WE 5 in der Goethestr. 14 plane ich, die Wand zwischen
Wohnzimmer und Küche teilweise zu öffnen, um einen offenen Wohn-/Essbereich
zu schaffen.

Meine Frage: Handelt es sich nach der Teilungserklärung um eine tragende Wand?
Benötige ich eine Zustimmung der WEG?

Ich würde selbstverständlich auf eigene Kosten einen Statiker beauftragen
und alle notwendigen Genehmigungen einholen.

Können Sie mir Auskunft geben oder die Frage in die nächste Eigentümerversammlung
aufnehmen?

Mit freundlichen Grüßen
Dr. Stefan Müller`,
  },
  {
    category: 'Eigentümer / WEG',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
Heinz`,
  },

  // ===== Behörden & Recht (4) =====
  {
    category: 'Behörden & Recht',
    sender: { name: 'RA Dr. Walter & Partner', email: 'kanzlei@walter-partner.de' },
    subject: 'Räumungsklage Özdemir / 12 C 234/26 - Sachstand',
    body:
`Sehr geehrter Herr Tauscher,

zum aktuellen Stand der Räumungsklage gegen Hr. Özdemir (Zschocherrsche Str. 14):

- Klage wurde am 14.04. beim AG Leipzig eingereicht
- Aktenzeichen: 12 C 234/26
- Erste mündliche Verhandlung: 03.06.2026
- Wir vertreten Sie wie besprochen

Bitte ergänzen Sie Ihre Akte. Erinnerung an den Termin folgt 5 Tage vorher.

Mit kollegialen Grüßen
Dr. Andreas Walter
Rechtsanwalt`,
  },
  {
    category: 'Behörden & Recht',
    sender: { name: 'Finanzamt Leipzig II', email: 'poststelle@fa-leipzig-2.smf.sachsen.de' },
    subject: 'Grundsteuerbescheide 2026 - mehrere Objekte',
    body:
`Sehr geehrter Herr Tauscher,

anbei die Grundsteuerbescheide 2026 für mehrere von Ihnen verwaltete Objekte.

Auffällige Änderungen:
- Goethestr. 14: Erhöhung um 18% (war 1.245 EUR, jetzt 1.470 EUR)
- Riemannstr. 8: keine Änderung
- Mockauer Str. 22: leichte Senkung (-3%)

Einspruchsfrist: 1 Monat ab Bekanntgabe.

Mit freundlichen Grüßen
Finanzamt Leipzig II`,
  },
  {
    category: 'Behörden & Recht',
    sender: { name: 'BSF Bauer (Schornsteinfeger)', email: 'bauer@schornsteinfeger-leipzig.de' },
    subject: 'Feuerstättenbescheid 2026 - 4 Objekte',
    body:
`Sehr geehrter Herr Tauscher,

als zuständiger bevollmächtigter Bezirksschornsteinfeger übersende ich Ihnen
den Feuerstättenbescheid für die folgenden Objekte:

- Eisenbahnstr. 47: Hauptkehrung Q3/2026
- Karl-Heine-Str. 12: Messung Heizung 09/2026
- Industriestr. 8: Hauptkehrung Q4/2026
- Mockauer Str. 22: Sichtprüfung 11/2026

Bitte tragen Sie alle Termine in den Objektkalender ein und informieren die Mieter.

Mit freundlichen Grüßen
Thomas Bauer
Bevollm. Bezirksschornsteinfeger`,
  },
  {
    category: 'Behörden & Recht',
    sender: { name: 'Anja Becker', email: 'anja.becker82@gmail.com' },
    subject: 'Auskunftsersuchen nach Art. 15 DSGVO',
    body:
`Sehr geehrte Damen und Herren,

hiermit beantrage ich gemäß Art. 15 DSGVO Auskunft über alle bei Ihnen zu meiner
Person gespeicherten Daten.

Ich bitte um:
- Kopie aller gespeicherten personenbezogenen Daten
- Angabe der Verarbeitungszwecke
- Kategorien der betroffenen Daten
- Empfänger oder Kategorien von Empfängern
- Geplante Speicherdauer
- Herkunft der Daten, soweit nicht bei mir erhoben

Die gesetzliche Frist von 1 Monat (28.05.2026) bitte ich einzuhalten.

Mit freundlichen Grüßen
Anja Becker`,
  },

  // ===== Dienstleister & Partner (4) =====
  {
    category: 'Dienstleister & Partner',
    sender: { name: 'Klar & Sauber GmbH', email: 'angebote@klar-und-sauber.de' },
    subject: 'Anpassung Konditionen 2026 - Treppenhausreinigung',
    body:
`Sehr geehrter Herr Tauscher,

aufgrund der gestiegenen Personal- und Materialkosten müssen wir leider unsere
Preise für die Treppenhausreinigung anpassen:

- Goethestr. 14: 285 EUR / Monat (vorher 245 EUR)
- Riemannstr. 8: 198 EUR / Monat (vorher 175 EUR)
- Industriestr. 8: 320 EUR / Monat (vorher 290 EUR)

Die Erhöhung von ca. 12-13% ergibt sich durch die Mindestlohnerhöhung und
allgemeine Materialkostensteigerungen.

Wir bitten um Bestätigung bzw. Rücksprache bis Ende Mai.

Mit freundlichen Grüßen
Klar & Sauber GmbH
Petra Lange`,
  },
  {
    category: 'Dienstleister & Partner',
    sender: { name: 'Versicherungsmakler Wolf', email: 'office@versicherung-wolf.de' },
    subject: 'Empfehlung Tarifwechsel Wohngebäudeversicherung Allianz',
    body:
`Sehr geehrter Herr Tauscher,

ich empfehle Ihnen einen Tarifwechsel bei der Wohngebäudeversicherung von
Allianz Standard auf Allianz Premium für Ihren Bestand.

Vorteile:
- Elementarschäden bereits enthalten (vorher Zusatz)
- Neuwertentschädigung statt Zeitwert
- Höhere Deckungssumme bei Glas

Mehrkosten: ca. 8% / Jahr.
Sinnvoll, da viele Ihrer Objekte in Hochwasser-gefährdeten Gebieten liegen
(Plagwitz, Lindenau).

Detaillierten Vergleich sende ich gerne nach Ihrem OK.

Mit freundlichen Grüßen
Michael Wolf
Versicherungsmakler`,
  },
  {
    category: 'Dienstleister & Partner',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
Heinz`,
  },
  {
    category: 'Dienstleister & Partner',
    sender: { name: 'Techem Energy Services GmbH', email: 'vertrieb@techem.de' },
    subject: 'Vertragsverlängerung 2027 - 6 Objekte',
    body:
`Sehr geehrter Herr Tauscher,

Ihr Servicevertrag mit Techem für Heizkostenabrechnung und Geräteservice
in 6 Objekten läuft am 31.12.2026 aus.

Aktuelle Konditionen:
- Geräteservice: 4,80 EUR / Erfassungsgerät / Jahr
- Abrechnungsdienstleistung: 18 EUR / Wohneinheit / Jahr
- Funkablesung: enthalten

Wir würden gerne verlängern und können bei einer Laufzeit von 3 Jahren
einen Rabatt von 5% anbieten.

Mit freundlichen Grüßen
Techem Vertrieb Region Ost`,
  },

  // ===== Termine & Organisation (4) =====
  {
    category: 'Termine & Organisation',
    sender: { name: 'Architekturbüro Lehmann', email: 'kontakt@architekturbuero-lehmann.de' },
    subject: 'Bestätigung Begehung Goethestr. 14 - 12.05. 10:00',
    body:
`Sehr geehrter Herr Tauscher,

hiermit bestätige ich den Termin für die Objektbegehung Goethestr. 14:

Datum: 12.05.2026, ab 10:00 Uhr
Teilnehmer:
- Hausmeister Schneider
- Herr Heinz
- Sie als Verwalter
- Ich (wegen Dachsanierung)

Geplant: Keller, Treppenhaus, Dachboden, Hof, Fassade.
Bitte das Begehungsprotokoll wie üblich vorab versenden.

Mit freundlichen Grüßen
Dipl.-Ing. Martin Lehmann
Architekt`,
  },
  {
    category: 'Termine & Organisation',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Termine & Organisation',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
    subject: 'Jahresplanung 2026 - bitte Termine eintragen',
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
Heinz`,
  },
  {
    category: 'Termine & Organisation',
    sender: { name: 'Sekretariat Heinz Estate', email: 'sekretariat@Heinz-estate.de' },
    subject: 'Mieter-Sprechstunde 14.05. - aktuelle Anmeldungen',
    body:
`Sehr geehrter Herr Tauscher,

am 14.05.2026 von 16-18 Uhr findet die monatliche Mieter-Sprechstunde im Büro statt.

Bisherige Anmeldungen:
1. Fam. Petrov (Karl-Heine-Str. 12) - Lärmproblematik
2. Hr. Wagner - Reaktion auf Ermahnung
3. Frau Krüger - Haustier-Anfrage
4. Fam. Hoffmann - Schimmel-Update

Bitte: Termine je 20 Min einplanen, Akten vorbereiten, Wartebereich organisieren.

Mit freundlichen Grüßen
Sekretariat`,
  },

  // ===== Intern (4) =====
  {
    category: 'Intern',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
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
jochen`,
  },
  {
    category: 'Intern',
    sender: { name: 'Jochen Heinz', email: 'jochen@Heinz-estate.de' },
    subject: 'Urlaubsvertretung Juni - bitte Bestätigung',
    body:
`Sehr geehrter Herr Tauscher,

ich bin vom 15.-26. Juni im Urlaub. Bitte Vertretungsregelung abstimmen:

- Notfälle (Wasser, Heizung): Hr. Schmidt (Mobil)
- Mieter-Anfragen: Sie persönlich
- Buchhaltung: Frau Wagner
- Eigentümerversammlung am 18.06.: bitte verschieben oder Sie übernehmen

Bitte Bestätigung bis Freitag.

MfG
Heinz`,
  },
  {
    category: 'Intern',
    sender: { name: 'Akturio Customer Success', email: 'success@akturio.com' },
    subject: 'Schulungstermine Akturio - Anmeldung Ihrer Mitarbeiter',
    body:
`Sehr geehrter Herr Tauscher,

wir freuen uns, dass Sie Akturio einsetzen. Hier die Termine für die Onboarding-Schulungen:

- Modul 1: Stammdaten & Objekte - 20.05., 14-17 Uhr
- Modul 2: Buchhaltung & Abrechnung - 27.05., 14-17 Uhr
- Modul 3: WEG-Verwaltung - 03.06., 14-17 Uhr
- Modul 4: Mieter-Self-Service-Portal - 10.06., 14-17 Uhr

Bitte melden Sie alle relevanten Mitarbeiter über das Customer Success-Portal an.
Nachbereitung-Materialien gehen automatisch an die Teilnehmer.

Mit freundlichen Grüßen
Lisa Hartmann
Akturio Customer Success`,
  },
  {
    category: 'Intern',
    sender: { name: 'IT-Administration Heinz', email: 'it@Heinz-estate.de' },
    subject: 'Neue einheitliche E-Mail-Signatur ab 01.05.',
    body:
`Sehr geehrter Herr Tauscher,

ab 01.05. gilt eine neue einheitliche E-Mail-Signatur für alle Mitarbeiter:

---
Vor- und Nachname
Position
Heinz Estate / Hausverwaltung
Beispielstraße 12, 04109 Leipzig
Tel: +49 341 1234567
E-Mail: name@Heinz-estate.de
Web: www.Heinz-estate.de

Geschäftsführer: Jochen Heinz
Sitz: Leipzig, HRB 12345
---

Bitte umstellen und Kollegen informieren.
Bei Problemen einfach kurz Bescheid geben.

MfG
IT-Administration`,
  },

  // ===== Newsletter (4) =====
  {
    category: 'Newsletter',
    sender: { name: 'Hausverwaltung Heinz – Newsletter', email: 'newsletter@Heinz-estate.de' },
    subject: 'Newsletter Mai 2026 - Hausverwaltung Heinz',
    body:
`Sehr geehrte Mieter, sehr geehrte Eigentümer,

unser monatlicher Newsletter mit den wichtigsten Informationen rund um Ihre Immobilie:

THEMEN MAI 2026:
- Neue Mülltrennungspflichten in Leipzig ab 01.06.
- Tipps zum richtigen Lüften (Schimmelvorbeugung)
- Ankündigung: Modernisierung Eisenbahnstr. 47
- Vorstellung unseres neuen Hausmeisters Hr. Schneider

Wir wünschen Ihnen eine schöne Frühlingszeit!

Ihre Hausverwaltung Heinz`,
  },
  {
    category: 'Newsletter',
    sender: { name: 'Hausverwaltung Heinz – Newsletter', email: 'newsletter@Heinz-estate.de' },
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

Ihre Hausverwaltung Heinz`,
  },
  {
    category: 'Newsletter',
    sender: { name: 'Hausverwaltung Heinz – Newsletter', email: 'newsletter@Heinz-estate.de' },
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

Ihre Hausverwaltung Heinz`,
  },
  {
    category: 'Newsletter',
    sender: { name: 'Hausverwaltung Heinz – Newsletter', email: 'newsletter@Heinz-estate.de' },
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

Ihre Hausverwaltung Heinz`,
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
  if (!['spoof', 'reply-to'].includes(CONFIG.senderMode)) {
    console.error('FEHLER: SENDER_MODE muss "spoof" oder "reply-to" sein.');
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

function formatAddress(person) {
  return person.name + ' <' + person.email + '>';
}

/**
 * Baut FROM- und REPLY-TO-Header je nach Modus.
 *
 * spoof    : FROM = simulierter Absender (kann beim SMTP-Server fehlschlagen)
 * reply-to : FROM = "Simulierter Name (via Heinz) <SMTP_FROM>"
 *            Reply-To = simulierte E-Mail-Adresse
 */
function buildHeaders(mail) {
  const simulated = mail.sender;

  if (CONFIG.senderMode === 'spoof') {
    return {
      from: formatAddress(simulated),
      replyTo: formatAddress(simulated),
    };
  }

  const realFromMatch = /<([^>]+)>/.exec(CONFIG.from);
  const realFromAddr = realFromMatch ? realFromMatch[1] : CONFIG.from;

  return {
    from: '"' + simulated.name + '" <' + realFromAddr + '>',
    replyTo: formatAddress(simulated),
  };
}

// ---------- Hauptlogik ----------

async function main() {
  console.log('==========================================');
  console.log('Hausverwaltungs-E-Mail-Versand');
  console.log('==========================================');
  console.log('Empfänger:           ' + CONFIG.to);
  console.log('Anzahl E-Mails:      ' + EMAILS.length);
  console.log('Verzögerung:         ' + CONFIG.delayMs + ' ms');
  console.log('Sender-Modus:        ' + CONFIG.senderMode);
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
    const headers = buildHeaders(mail);
    const senderInfo = mail.sender.email.padEnd(42);

    if (CONFIG.dryRun) {
      console.log(num + '/50  [DRY] from=' + senderInfo + ' ' + subjectWithCategory);
      success++;
      continue;
    }

    try {
      const info = await transporter.sendMail({
        from: headers.from,
        replyTo: headers.replyTo,
        to: CONFIG.to,
        subject: subjectWithCategory,
        text: mail.body,
      });
      console.log(num + '/50  ✓ from=' + senderInfo + ' ' + subjectWithCategory +
                  '   (id: ' + info.messageId + ')');
      success++;
    } catch (err) {
      console.error(num + '/50  ✗ from=' + senderInfo + ' ' + subjectWithCategory +
                    '   FEHLER: ' + err.message);
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
