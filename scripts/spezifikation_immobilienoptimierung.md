# Spezifikation: Akturio-Modul „Potenzialanalyse / Value-Add-Underwriting"

**Version:** 1.0 (Entwurf)
**Stand:** Juni 2026
**Kontext:** Akturio (Supabase / NestJS / Next.js), Preisdatenbank, Document-Understanding-Pipeline und RoomPlan/ARKit-Scan.

---

## 1. Ziel und Abgrenzung

Füge dieses Modul unter den Navigationspunkt "Immobilienoptimierung" hinzu: 
Das Modul bewertet ein gesamtes Immobilienportfolio (mehrere Einheiten und/oder ein gesamtes Mehrfamilienhaus und/oder mehrere Mehrfamilienhäuser und/oder einzelne Wohnung oder Gewerbeeinheit) auf ihr Rendite- und Wertsteigerungspotenzial. Es bildet jeden Wert-/Renditehebel als parametrisierte **Maßnahme** ab, rechnet pro Maßnahme Invest, Ertragswirkung, Werthebel und Amortisation, prüft die rechtliche Zulässigkeit gegen ein versioniertes Regelwerk

**In Scope:** Objekterfassung, Maßnahmen-Katalog, deterministische Wirtschaftlichkeitsrechnung, Regel-/Baurecht-Gating, Priorisierung, Szenarienvergleich, Portfolio-Aggregation, geführter Umsetzungs-Workflow, AI-gestützte Datenerfassung.

**Out of Scope (v1):** Notarielle Aufteilungsabwicklung, Bauantragsstellung, Buchhaltung. Steuerberechnungen (AfA, 3-Objekt-Grenze) liefern Größenordnungen, ersetzen keinen Steuerberater.

---

## 2. Architekturprinzipien (verbindlich)

1. **Trennung deterministische Engine ↔ AI-Layer.** Alle Rendite-/Wertzahlen werden in getestetem Code berechnet — reproduzierbar und auditierbar. Das LLM erfasst nur Daten (Extraktion), schlägt Maßnahmen vor und erklärt Ergebnisse. Das LLM rechnet niemals die Rendite.

2. **Regelwerk ist Daten, nicht Code.** Rechtliche Grenzwerte (Kappung, Mietpreisbremse, §559-Deckel, Milieuschutz, ZwEVS) liegen in versionierten, gemeinde- und datumsbezogenen Tabellen. Keine hartkodierten Grenzwerte.

3. **Maßnahme als typisiertes Objekt.** Neue Hebel kommen als Katalog-Datensätze hinzu, nicht als neuer Code.

4. **Jede Maßnahme reduziert auf drei Kennzahlen** (Invest, ΔNetto-Ertrag p.a., Werthebel) — das macht alle Hebel vergleichbar und priorisierbar.

5. **Multi-Tenant via Supabase RLS** (bestehendes Akturio-Schema fortführen).

---

## 3. Tech-Stack

| Schicht | Technologie |
|---|---|
| Datenbank | Supabase / PostgreSQL, RLS pro Mandant, `pgvector` für Rechtsquellen-RAG |
| Backend / Engine | (Service-Klassen pro Maßnahmentyp), deterministisch |
| Frontend | Next.js (Szenario-Editor, Charts, Workflow) |
| AI | Anthropic API (Extraktion, Vorschläge, Erklärung), Document-Understanding-Pipeline |
| Scan | Apple RoomPlan/ARKit → Flächenmodell |
| Tests | Vitest, Supertest, Golden-Master für die Engine |

---

## 4. Datenmodell

### 4.1 Kern-Tabellen (DDL-Skizze)

```sql
-- Objekt
create table objekt (
  id              uuid primary key default gen_random_uuid(),
  mandant_id      uuid not null,
  bezeichnung     text not null,
  strasse         text, plz text, ort text, gemeinde_id uuid references gemeinde(id),
  baujahr         int,
  denkmalschutz   boolean default false,
  erhaltungssatzung boolean default false,    -- Milieuschutz
  grundstuecksflaeche_qm numeric,
  bgf_qm          numeric,
  wohnflaeche_qm  numeric,
  bodenrichtwert  numeric,
  energieklasse   text,                       -- A+..H
  objektfaktor    numeric,                     -- aktueller Verkehrswert-Multiplikator
  created_at      timestamptz default now()
);

-- Einheit (Whg / Gewerbe / Stellplatz / Nebenfläche)
create table einheit (
  id          uuid primary key default gen_random_uuid(),
  objekt_id   uuid not null references objekt(id),
  typ         text not null,                  -- wohnung|gewerbe|stellplatz|nebenflaeche
  bezeichnung text,
  flaeche_qm  numeric,
  lage        jsonb,                          -- Stockwerk, Ausrichtung, Merkmale
  status      text default 'ist'              -- ist|potenzial
);

-- Flächenkataster: Potenzialflächen (noch nicht vermietet/geschaffen)
create table potenzialflaeche (
  id          uuid primary key default gen_random_uuid(),
  objekt_id   uuid not null references objekt(id),
  art         text not null,                  -- dg_unausgebaut|souterrain|giebel_werbung|
                                              -- dachflaeche_pv|dachflaeche_antenne|
                                              -- stellplatz|kellerlager|fahrradbox|garten
  flaeche_qm  numeric,
  menge       int,                            -- z.B. Anzahl möglicher Stellplätze
  beschreibung text
);

-- Mietvertrag
create table mietvertrag (
  id            uuid primary key default gen_random_uuid(),
  einheit_id    uuid not null references einheit(id),
  mietart       text not null,               -- standard|index|staffel
  kaltmiete_eur numeric not null,
  beginn        date,
  letzte_erhoehung date,
  leerstand     boolean default false
);

-- Mietspiegel-Referenz (ortsübliche Vergleichsmiete je Segment)
create table mietspiegel (
  id          uuid primary key default gen_random_uuid(),
  gemeinde_id uuid references gemeinde(id),
  segment     jsonb,                          -- Baujahr, Lage, Ausstattung
  vergleichsmiete_eur_qm numeric,
  gueltig_von date, gueltig_bis date
);
```

### 4.2 Maßnahmen

```sql
-- Katalog der Maßnahmentypen (Stammdaten)
create table massnahme_typ (
  code        text primary key,              -- z.B. 'werbeflaeche_giebel'
  kategorie   text not null,                 -- mietertrag|zusatzerloes|flaeche|kosten|portfolio
  klasse      text not null,                 -- quick_win|capex
  label       text not null,
  param_schema jsonb,                        -- erwartete Parameter
  constraint_codes text[]                    -- welche Regeln zu prüfen sind
);

-- Konkrete Maßnahme an einem Objekt
create table massnahme (
  id            uuid primary key default gen_random_uuid(),
  objekt_id     uuid not null references objekt(id),
  typ_code      text not null references massnahme_typ(code),
  potenzialflaeche_id uuid references potenzialflaeche(id),  -- falls flächenaktivierend
  params        jsonb,                        -- typ-spezifisch
  invest_eur    numeric,
  ertragswirkung_pa_eur numeric,             -- ΔNOI
  -- berechnet & gecacht:
  werthebel_eur numeric,
  amortisation_jahre numeric,
  zulaessigkeit text                          -- zulaessig|bedingt|gesperrt
);
```

### 4.3 Szenarien

```sql
create table szenario (
  id          uuid primary key default gen_random_uuid(),
  objekt_id   uuid not null references objekt(id),
  name        text,
  ist_baseline boolean default false
);
create table szenario_massnahme (
  szenario_id  uuid references szenario(id),
  massnahme_id uuid references massnahme(id),
  primary key (szenario_id, massnahme_id)
);
-- Ergebnis-Snapshot je Szenario (reproduzierbar, auditierbar)
create table kennzahlen_snapshot (
  id           uuid primary key default gen_random_uuid(),
  szenario_id  uuid references szenario(id),
  noi_eur      numeric, faktor numeric, verkehrswert_eur numeric,
  bruttorendite numeric, nettorendite numeric, ek_rendite numeric, irr numeric,
  aufteilungsgewinn_eur numeric, afa_effekt_eur numeric,
  berechnet_am timestamptz default now(),
  engine_version text
);
```

### 4.4 Regelwerk & Baurecht

```sql
create table gemeinde (
  id uuid primary key default gen_random_uuid(),
  name text, bundesland text
);

-- Versioniertes, gemeinde-/datumsbezogenes Regelwerk
create table regelwerk (
  id            uuid primary key default gen_random_uuid(),
  gemeinde_id   uuid references gemeinde(id),
  regel_code    text not null,               -- kappungsgrenze|mietpreisbremse|
                                             -- modernisierung_deckel|zwevs|milieuschutz|
                                             -- umwandlungsverordnung
  parameter     jsonb not null,              -- z.B. {"kappung_pct": 15}
  gueltig_von   date not null,
  gueltig_bis   date,
  quelle        text                         -- Verordnung/Fundstelle
);

-- Baurechtliche Objektparameter
create table baurecht (
  objekt_id     uuid primary key references objekt(id),
  bplan         text,
  grz           numeric, gfz numeric,
  geplante_bgf  numeric,
  statik_reserve boolean,
  genehmigungslage jsonb
);
```

### 4.5 Portfolio

```sql
create table standardpaket (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid, name text,                -- 'Bad-Paket','Boden-Paket','Türen','Licht'
  kosten_pro_einheit_eur numeric,            -- aus Berko-Operations-Rahmenvertrag
  ertragswirkung_pa_eur numeric
);
create table capex_plan (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid, jahr int, objekt_id uuid references objekt(id),
  massnahme_id uuid references massnahme(id), budget_eur numeric, status text
);
```

---

## 5. Maßnahmen-Katalog (Seed `massnahme_typ`)

| Code | Kategorie | Klasse | Constraints | Kernparameter |
|---|---|---|---|---|
| `vergleichsmiete` | mietertrag | quick_win | kappungsgrenze, mietspiegel | zielmiete |
| `index_umstellung` | mietertrag | quick_win | index_deckel | index |
| `staffel_umstellung` | mietertrag | quick_win | mietpreisbremse | staffeln[] |
| `neuvermietung_sanierung` | mietertrag | capex | mietpreisbremse, zwevs | zielklientel, capEx |
| `modernisierung` | mietertrag | capex | modernisierung_deckel, milieuschutz | capEx, umlage_pct=8 |
| `stellplatz_anlegen` | zusatzerloes | quick_win | baurecht | menge, miete_pm |
| `werbeflaeche_giebel` | zusatzerloes | quick_win | denkmal | miete_pa |
| `dachpacht_mobilfunk` | zusatzerloes | quick_win | baurecht, statik | pacht_pa |
| `pv_dachpacht` / `pv_mieterstrom` | zusatzerloes | capex | baurecht | kWp, capEx |
| `kellerlager` / `fahrradbox` / `muenzwaschraum` | zusatzerloes | quick_win | – | menge, miete_pm |
| `garten_parzelle` / `container_stellplatz` | zusatzerloes | quick_win | baurecht | menge, miete_pm |
| `dg_ausbau` / `souterrain_ausbau` | flaeche | capex | baurecht, denkmal | neue_flaeche, baukosten_qm |
| `grundriss_teilen` | flaeche | capex | baurecht | aus_einheit, neue_einheiten |
| `balkonanbau` | flaeche | capex | baurecht, statik | menge, kosten |
| `umwidmung_gewerbe_wohnen` | flaeche | capex | baurecht, milieuschutz | flaeche |
| `nachverdichtung` | flaeche | capex | baurecht, grz_gfz | neues_baufeld |
| `aufteilung_etw` | flaeche | capex | umwandlungsverordnung, weg | global_faktor, einzel_faktor |
| `betriebskosten_buendeln` / `versorgerwechsel` | kosten | quick_win | – | einsparung_pa |
| `leerstandsabbau` | kosten | quick_win | – | – |
| `refinanzierung` | kosten | quick_win | – | alt_zins, neu_zins |
| `standardpaket_rollout` | portfolio | capex | (paketabhängig) | paket_id, objekte[] |
| `exit_vergleich` | portfolio | – | – | paket_faktor, einzel_faktor |

---

## 6. Rechen-Engine (deterministisch, NestJS)

### 6.1 Universelle Kennzahlen

```
NOI            = Σ Jahresnettomieten − nicht umlagefähige Kosten
Werthebel      = ΔNOI_p.a. × Objektfaktor
Amortisation   = Invest / ΔNetto-Ertrag_p.a.   [Jahre]
Verkehrswert   = NOI × Faktor
Bruttorendite  = Jahresmiete / Kaufpreis
Nettorendite   = NOI / (Kaufpreis + Erwerbsnebenkosten)
EK-Rendite     = (NOI − Fremdkapitalzins) / eingesetztes Eigenkapital
IRR            = über Halteperiode inkl. Exit (DCF)
Aufteilungsgewinn = Σ Einzelverkaufspreise − Globalwert − Aufteilungskosten
```

### 6.2 Maßnahmenspezifische Logik (Auszug)

- **vergleichsmiete:** Zielmiete = min(Mietspiegel-Vergleichsmiete, Ist-Miete × (1 + Kappung_pct)). In Leipzig Kappung 15 % / 3 Jahre. Wartefrist 15 Monate seit letzter Erhöhung berücksichtigen.
- **modernisierung:** Umlage = capEx × 8 % p.a.; Deckel = min(3 €/m²/6 J; 2 €/m² wenn Ausgangsmiete < 7 €/m²). Nicht von Kappungsgrenze erfasst.
- **neuvermietung_sanierung:** Zielmiete ≤ Vergleichsmiete × 1,10 (Mietpreisbremse), außer Ausnahme (Vormiete höher, umfassende Modernisierung, Neubau). Klientelwechsel (WG/möbliert) als €/m²-Aufschlag, sofern ZwEVS es zulässt.
- **werbeflaeche_giebel:** ΔNOI = miete_pa; Werthebel = miete_pa × Faktor (Beispiel: 1.200 € × 20 = 24.000 €).
- **aufteilung_etw:** Aufteilungsgewinn = Σ(Einheit_fläche × Einzel-€/m²) − Globalwert − Splitkosten. 3-Objekt-Grenze und Spekulationsfrist als Warnung markieren.
- **afa (Denkmal §7i):** beschleunigte Abschreibung der Sanierungskosten als Cashflow-Effekt für Kapitalanleger-Verkauf; nur als Größenordnung, mit Steuerberater-Vorbehalt.

### 6.3 Determinismus

Jede Engine-Version erhält eine `engine_version`. Snapshots speichern Inputs + Version, sodass jedes Ergebnis exakt reproduzierbar ist. Golden-Master-Tests sichern, dass identische Inputs identische Outputs erzeugen.

---

## 7. Regel- & Baurecht-Engine

### 7.1 Ablauf

Für jede Maßnahme werden ihre `constraint_codes` gegen das zum Stichtag und zur Gemeinde gültige `regelwerk` geprüft. Rückgabe je Maßnahme:

```
zulaessigkeit: 'zulaessig' | 'bedingt' | 'gesperrt'
begruendung:   string   // Klartext via RAG
auflagen:      string[]  // z.B. "Genehmigung nach §250 BauGB erforderlich"
```

### 7.2 Gating-Logik (Beispiele)

| Regel | Wirkung |
|---|---|
| `kappungsgrenze` | begrenzt `vergleichsmiete` (Leipzig 15 %, gültig bis 30.06.2027) |
| `mietpreisbremse` | begrenzt Neuvertragsmiete auf Vergleichsmiete +10 % (Leipzig bis 30.06.2027) |
| `modernisierung_deckel` | begrenzt §559-Umlage (8 % / 3 €/m²) |
| `milieuschutz` | `modernisierung`, `umwidmung` → bedingt/genehmigungspflichtig |
| `umwandlungsverordnung` (§250 BauGB) | `aufteilung_etw` → genehmigungspflichtig in angespannten Gebieten |
| `grz_gfz` / `baurecht` | `dg_ausbau`, `nachverdichtung`, `balkonanbau` → Feasibility gegen B-Plan/Statik |
| `zwevs` | `neuvermietung_sanierung` (Kurzzeit/möbliert) → nur mit Genehmigung |
| `denkmal` | CapEx-Maßnahmen → bedingt, schaltet §7i-AfA frei |

### 7.3 Seed (Leipzig, Stand prüfen)

```json
[
  {"regel_code":"kappungsgrenze","parameter":{"kappung_pct":15},
   "gueltig_von":"2024-07-01","gueltig_bis":"2027-06-30"},
  {"regel_code":"mietpreisbremse","parameter":{"aufschlag_pct":10},
   "gueltig_von":"2026-01-01","gueltig_bis":"2027-06-30"},
  {"regel_code":"modernisierung_deckel",
   "parameter":{"umlage_pct":8,"deckel_eur_qm_6j":3,"deckel_unter_7eur":2}}
]
```

> Grenzwerte und Geltungsdaten vor Produktivnahme gegen die aktuelle Sächsische Verordnungslage validieren; Verordnungen laufen aus bzw. werden verlängert.

---

## 8. Priorisierung (Aufwand-Wirkung)

- Sortierung je Objekt: primär `klasse` (quick_win vor capex), sekundär nach Werthebel/Invest-Verhältnis und Amortisationsdauer.
- Output: Rangliste + Bubble-Matrix (x = Invest, y = Werthebel, Bubble-Größe = 1/Amortisation).
- Quick Wins (Stellplätze, Lager, Werbeflächen, Vertragsumstellungen) werden für die schnelle Realisierung gebündelt vor CapEx-Projekten ausgewiesen.

---

## 9. Portfolio-Ebene

- **Standardpakete** als wiederverwendbare Maßnahmen-Templates mit Rahmenvertragspreisen (Berko Operations); per `standardpaket_rollout` auf mehrere Objekte anwendbar.
- **Rollierender CapEx-Plan** (`capex_plan`) mit Jahres-Budgetierung und Status.
- **Systematische Mietenangleichung** als wiederkehrender Job: prüft portfolioweit, wo eine Erhöhung fällig/zulässig ist (Wartefrist, Kappung, Mietspiegel).
- **Exit-Vergleich:** Paketverkauf (Faktorvorteil durch Größe/Stabilität) vs. Einzelverkauf nach Aufteilung — beide Faktoren gegenübergestellt.
- **ESG/Green Premium:** energetische Maßnahmen + Förderung als Faktor-Modifikator und Vermietbarkeits-Bonus.

---

## 10. AI-Layer (klare Grenze: erfasst, schlägt vor, erklärt — rechnet nie)

| Funktion | Input | Output |
|---|---|---|
| Dokument-Extraktion | Exposé, Grundbuch, Mietverträge, Energieausweis | strukturierte Objekt-/Einheit-/Vertragsfelder |
| RoomPlan-Import | ARKit-Scan | Ist-Flächen → `einheit`, CapEx-Schätzung über Berko-Operations-Preise |
| Maßnahmen-Vorschlag | Objektprofil | Liste relevanter Hebel (z.B. „Denkmal → §7i prüfen", „DG unausgebaut → Ausbau") |
| Erklär-Layer | Constraint-Ergebnis | Klartext-Begründung + Fundstelle aus Rechtsquellen-RAG (pgvector) |

---

## 11. API-Endpunkte (NestJS, Auszug)

```
POST   /objekte                         Objekt anlegen
POST   /objekte/:id/extract             AI-Extraktion aus Dokument
POST   /objekte/:id/scan-import         RoomPlan-Flächen importieren
GET    /objekte/:id/vorschlaege         AI-Maßnahmenvorschläge
POST   /massnahmen                      Maßnahme anlegen
POST   /szenarien                       Szenario anlegen (Maßnahmen stapeln)
POST   /szenarien/:id/berechnen         Engine ausführen → kennzahlen_snapshot
GET    /szenarien/:id/vergleich         Ist vs. Szenario (Waterfall, Rent-Roll)
GET    /objekte/:id/priorisierung       Aufwand-Wirkung-Rangliste
GET    /regelwerk?gemeinde=&datum=      gültiges Regelset
GET    /portfolio/mietenangleichung     fällige/zulässige Erhöhungen
POST   /portfolio/paket-rollout         Standardpaket anwenden
```

---

## 12. Frontend (Next.js)

1. **Objekt-Erfassung** mit Drag-&-Drop-Upload (→ AI-Extraktion) und Scan-Import. Auch auf die bestehenden Dateien/Dokumente zugreifen
2. **Flächenkataster** — Ist-Einheiten + Potenzialflächen pflegen.
3. **Szenario-Editor** — Maßnahmen stapeln, Parameter per Slider, Live-Neuberechnung.
4. **Ergebnis-Ansicht** — Waterfall (Ist → +Maßnahme → Potenzial), Rent-Roll vorher/nachher, Kennzahlen-Panel.
5. **Priorisierungs-Matrix** — Bubble-Chart Quick Win vs. CapEx.
6. **Workflow-Pipeline** (siehe 13) mit Status und Dokumenten.
7. **Portfolio-Dashboard** — Aggregation, CapEx-Plan, Mietenangleichungs-Liste, Exit-Vergleich.

---

## 13. Umsetzungs-Workflow (Pipeline-Status)

```
quick_check → baurecht_pruefung → priorisierung →
wirtschaftlichkeit → finanzierung_foerderung → portfolio_rollout
```

Jeder Schritt mit Status-Tracking und Dokumenten-Anhang (Energieausweis, B-Plan-Auszug, Bankzusage). Anbindung an Akturio-CRM/DMS, sodass aus der Analyse die Maßnahmen-Abwicklung wird.

---

## 14. Teststrategie

- **Engine:** Golden-Master-Tests (fixe Inputs → fixe Outputs) je Maßnahmentyp; Property-Tests für Determinismus.
- **Constraints:** Tabellengetriebene Tests pro Regel × Gemeinde × Stichtag (Grenzfälle vor/nach Geltungsdatum).
- **API:** Supertest gegen Testcontainers-Postgres mit aktiver RLS.
- **Regressionsschutz:** `engine_version` bei jedem Algorithmus-Change inkrementieren; Snapshots der Vorversion müssen erhalten bleiben.

---

## 15. Umsetzungs-Roadmap

**Phase 1 — MVP (Einzelobjekt):** Datenmodell, Maßnahmen-Katalog (Quick Wins + Modernisierung + Aufteilung), Rechen-Engine, Regelwerk Leipzig, Szenario-Editor, Waterfall.

**Phase 2 — Regel-/Baurecht-Tiefe:** Milieuschutz, Umwandlungsverordnung, GRZ/GFZ-Gating, Erklär-Layer, weitere Gemeinden.

**Phase 3 — AI-Erfassung:** Dokument-Extraktion, RoomPlan-Import, Maßnahmen-Vorschläge.

**Phase 4 — Portfolio:** Standardpakete, CapEx-Plan, Mietenangleichungs-Job, Exit-Vergleich, ESG-Modifikator.

---

## 16. Offene Punkte / Annahmen

- Steuerliche Hebel (Denkmal-AfA §7i, 3-Objekt-Grenze, Spekulationsfrist) liefern nur Größenordnungen — Steuerberater-Vorbehalt im UI kennzeichnen.
- Objektfaktor: zunächst manuelle Eingabe, später aus Vergleichsdaten/Marktanreicherung ableiten.
- Mietspiegel-Daten als strukturierte Quelle je Gemeinde beschaffen/pflegen.
- Verordnungs-Geltungsdaten brauchen einen Pflegeprozess (laufen aus / werden verlängert).