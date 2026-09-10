# Hausverwaltungs-E-Mail-Versand

Versendet 50 realistische Hausverwaltungs-E-Mails an `daniel.tauscher@akturio.com`,
gleichmäßig verteilt auf 11 Kategorien.

## Verteilung (50 Mails auf 11 Kategorien)

| Kategorie                   | Anzahl |
|-----------------------------|--------|
| objektbezogen               | 5      |
| Mieterkommunikation         | 5      |
| Finanzen & Abrechnung       | 5      |
| Schäden & Instandhaltung    | 5      |
| Verträge & Dokumente        | 5      |
| Eigentümer / WEG            | 5      |
| Behörden & Recht            | 4      |
| Dienstleister & Partner     | 4      |
| Termine & Organisation      | 4      |
| Intern                      | 4      |
| Newsletter                  | 4      |
| **Gesamt**                  | **50** |

(50 / 11 = 4,55 — daher 6 Kategorien à 5 Mails + 5 Kategorien à 4 Mails.
Eine exakt gleichmäßige Verteilung ist mathematisch nicht möglich.)

## Installation

```bash
npm install nodemailer
```

## Konfiguration

Setze die folgenden Umgebungsvariablen (z.B. in einer `.env`-Datei oder direkt im Shell):

```bash
export SMTP_HOST="mail.your-server.de"
export SMTP_PORT="587"
export SMTP_SECURE="false"          # true bei Port 465
export SMTP_USER="absender@example.com"
export SMTP_PASS="dein-passwort-oder-app-password"
export SMTP_FROM="Hausverwaltung Berkovich <absender@example.com>"

# Optional:
export SMTP_TO="daniel.tauscher@akturio.com"   # Default ist bereits gesetzt
export SEND_DELAY_MS="1500"                    # Verzögerung zwischen Mails
export DRY_RUN="false"                         # true = nur Vorschau
```

### Hinweise zu gängigen Anbietern

- **Gmail**: `SMTP_HOST=smtp.gmail.com`, `PORT=587`, App-Passwort erforderlich.
- **Office 365**: `SMTP_HOST=smtp.office365.com`, `PORT=587`.
- **IONOS**: `SMTP_HOST=smtp.ionos.de`, `PORT=587`.
- **Eigener Server (z. B. Hetzner Mail)**: Zugangsdaten beim Provider.

## Test (ohne Versand)

```bash
DRY_RUN=true node send-emails.js
```

Zeigt nur die Verteilung und alle Betreffzeilen, sendet aber nichts.

## Versand

```bash
node send-emails.js
```

Das Script:
1. prüft die SMTP-Verbindung,
2. versendet die 50 Mails sequentiell mit konfigurierbarer Verzögerung,
3. loggt Erfolg/Fehler je Mail und gibt am Ende eine Zusammenfassung aus.

Jede Betreffzeile beginnt mit `[Kategorie]`, damit sich die Mails in
Akturio später einfach den Kategorien zuordnen lassen.

## Wichtig

- **Anti-Spam**: 50 Mails in kurzer Zeit an dieselbe Adresse können bei manchen
  Providern als Spam gewertet werden. Standard-Verzögerung 1,5 Sek. zwischen
  Mails ist defensiv. Bei strengen Providern ggf. `SEND_DELAY_MS=5000` setzen.
- **Eigene SMTP-Limits**: Gmail erlaubt z.B. nur 500 Mails/Tag bei Free-Accounts.
- **DKIM/SPF**: Damit die Mails nicht im Spam landen, sollte deine Absender-Domain
  korrekt eingerichtet sein.
