/**
 * Seed-Script: Neuer Testzugang koehler@berko.ai + Demo-Hausverwaltung Leipzig.
 * Analog zu seed-chemnitz-daniel.sql (Daniel Tauscher), aber eigenes Portfolio
 * in Leipzig und über die Supabase Admin-API statt rohem SQL.
 *
 * Ausführen: npx tsx scripts/seed-leipzig-koehler.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomUUID, randomBytes } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL = "koehler@berko.ai";
const PASSWORD = randomBytes(9).toString("base64url"); // 12-stelliges Einmalpasswort

const id = () => randomUUID();

async function main() {
  console.log("Erstelle Testzugang & Demo-Daten für", EMAIL, "…\n");

  // ════════════════════════════════════════════════════════════════════════
  // AUTH-USER
  // ════════════════════════════════════════════════════════════════════════

  let userId: string;
  const { data: existing } = await admin.auth.admin.listUsers();
  const already = existing?.users.find((u) => u.email === EMAIL);

  if (already) {
    userId = already.id;
    console.log(`Auth-User existiert bereits: ${userId} (Passwort bleibt unverändert)\n`);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(`Auth-User-Erstellung fehlgeschlagen: ${error?.message}`);
    userId = created.user.id;
    console.log(`Auth-User erstellt: ${userId}\n`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // TENANT
  // ════════════════════════════════════════════════════════════════════════

  const tenantId = id();
  {
    const { error } = await admin.from("tenants").insert({
      id: tenantId,
      name: "Pleißental Hausverwaltung GmbH (Köhler)",
      slug: `pleissental-leipzig-koehler-${tenantId.slice(0, 8)}`,
    });
    if (error) throw new Error(`Tenant: ${error.message}`);
  }
  console.log("Tenant angelegt: Pleißental Hausverwaltung GmbH (Köhler)\n");

  // ════════════════════════════════════════════════════════════════════════
  // KONTAKTE
  // ════════════════════════════════════════════════════════════════════════

  const c = {
    kruger: id(), vogel: id(), fischer: id(), reinhardt: id(), marchenko: id(), zimmermann: id(),
    vogelImmo: id(), brandt: id(),
    pleisseufer: id(), wagner: id(), hartmann: id(), baumann: id(), tran: id(), roth: id(), lindner: id(), vogt: id(),
    berg: id(), wbg: id(), lukasVogel: id(), yildiz: id(),
    kaffeehaus: id(), steuerberater: id(),
    wolf: id(), waerme: id(),
  };

  const contacts = [
    // ---- Eigentümer Waldstraße 82 (WEG) ----
    { id: c.kruger, tenant_id: tenantId, type: "natural_person", salutation: "herr", academic_title: "Dr.",
      first_name: "Stefan", last_name: "Krüger", language: "de",
      emails: [{ type: "private", value: "s.krueger@gmx.de" }],
      phones: [{ type: "mobile", value: "+4917112340001" }, { type: "landline", value: "+493419550001" }],
      addresses: [{ type: "residential", street: "Waldstraße", house_number: "82", zip_code: "04105", city: "Leipzig", country: "DE" }],
      date_of_birth: "1961-05-11" },
    { id: c.vogel, tenant_id: tenantId, type: "natural_person", salutation: "frau",
      first_name: "Petra", last_name: "Vogel", language: "de",
      emails: [{ type: "private", value: "p.vogel@web.de" }],
      phones: [{ type: "mobile", value: "+4915234570002" }],
      addresses: [{ type: "residential", street: "Waldstraße", house_number: "82", zip_code: "04105", city: "Leipzig", country: "DE" }],
      date_of_birth: "1974-02-19" },
    { id: c.fischer, tenant_id: tenantId, type: "natural_person", salutation: "eheleute",
      first_name: "Karl und Erika", last_name: "Fischer", language: "de",
      emails: [{ type: "private", value: "fischer.familie@t-online.de" }],
      phones: [{ type: "landline", value: "+493419550003" }],
      addresses: [{ type: "residential", street: "Waldstraße", house_number: "82", zip_code: "04105", city: "Leipzig", country: "DE" }],
      date_of_birth: "1953-08-30" },
    { id: c.reinhardt, tenant_id: tenantId, type: "natural_person", salutation: "herr",
      first_name: "Jonas", last_name: "Reinhardt", language: "de",
      emails: [{ type: "private", value: "j.reinhardt@gmail.com" }, { type: "business", value: "reinhardt@rh-consulting.de" }],
      phones: [{ type: "mobile", value: "+4917345670004" }],
      addresses: [{ type: "residential", street: "Karl-Heine-Straße", house_number: "22", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1980-11-03" },
    { id: c.marchenko, tenant_id: tenantId, type: "natural_person", salutation: "frau",
      first_name: "Ivetta", last_name: "Marchenko", language: "ru",
      emails: [{ type: "private", value: "i.marchenko@mail.ru" }],
      phones: [{ type: "mobile", value: "+4916045670005" }],
      addresses: [{ type: "residential", street: "Waldstraße", house_number: "82", zip_code: "04105", city: "Leipzig", country: "DE" }],
      date_of_birth: "1987-06-21" },
    { id: c.zimmermann, tenant_id: tenantId, type: "natural_person", salutation: "herr",
      first_name: "Frank", last_name: "Zimmermann", language: "de",
      emails: [{ type: "private", value: "frank.zimmermann@gmx.de" }],
      phones: [{ type: "mobile", value: "+4917656670006" }],
      addresses: [{ type: "residential", street: "Waldstraße", house_number: "82", zip_code: "04105", city: "Leipzig", country: "DE" }],
      date_of_birth: "1970-01-14" },
    { id: c.vogelImmo, tenant_id: tenantId, type: "legal_entity", salutation: "firma",
      company_name: "Vogel Immobilien GmbH", language: "de",
      emails: [{ type: "business", value: "info@vogel-immo-leipzig.de" }],
      phones: [{ type: "landline", value: "+493419553300" }],
      addresses: [{ type: "business", street: "Eisenbahnstraße", house_number: "55", zip_code: "04315", city: "Leipzig", country: "DE" }],
      vat_id: "DE271830001", tax_id: "231/141/09876" },

    // ---- Mieter Waldstraße W04 (Reinhardt vermietet) ----
    { id: c.brandt, tenant_id: tenantId, type: "natural_person", salutation: "eheleute",
      first_name: "Paul und Nadine", last_name: "Brandt", language: "de",
      emails: [{ type: "private", value: "brandt.familie@gmx.net" }],
      phones: [{ type: "mobile", value: "+4917789070007" }],
      addresses: [{ type: "residential", street: "Waldstraße", house_number: "82", zip_code: "04105", city: "Leipzig", country: "DE" }],
      date_of_birth: "1991-03-09" },

    // ---- Eigentümerin Zschochersche Straße 15 (Miethaus, Plagwitz) ----
    { id: c.pleisseufer, tenant_id: tenantId, type: "legal_entity", salutation: "firma",
      company_name: "Pleißeufer Vermögensverwaltung KG", language: "de",
      emails: [{ type: "business", value: "verwaltung@pleisseufer-vermoegen.de" }],
      phones: [{ type: "landline", value: "+493419557788" }],
      addresses: [{ type: "business", street: "Erich-Zeigner-Allee", house_number: "4", zip_code: "04229", city: "Leipzig", country: "DE" }],
      vat_id: "DE271830008" },

    // ---- Mieter Zschochersche Straße 15 ----
    { id: c.wagner, tenant_id: tenantId, type: "natural_person", salutation: "eheleute",
      first_name: "Jens und Katrin", last_name: "Wagner", language: "de",
      emails: [{ type: "private", value: "j.k.wagner@gmx.de" }],
      phones: [{ type: "mobile", value: "+4915890070009" }],
      addresses: [{ type: "residential", street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1985-07-27" },
    { id: c.hartmann, tenant_id: tenantId, type: "natural_person", salutation: "frau",
      first_name: "Julia", last_name: "Hartmann", language: "de",
      emails: [{ type: "private", value: "julia.hartmann91@web.de" }],
      phones: [{ type: "mobile", value: "+4916234570010" }],
      addresses: [{ type: "residential", street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1991-10-05" },
    { id: c.baumann, tenant_id: tenantId, type: "natural_person", salutation: "herr",
      first_name: "Dieter", last_name: "Baumann", language: "de",
      emails: [{ type: "private", value: "d.baumann@t-online.de" }],
      phones: [{ type: "landline", value: "+493419552021" }],
      addresses: [{ type: "residential", street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1963-04-12" },
    { id: c.tran, tenant_id: tenantId, type: "natural_person", salutation: "eheleute",
      first_name: "Duc Anh und Mai Linh", last_name: "Tran", language: "de",
      emails: [{ type: "private", value: "tran.familie@gmail.com" }],
      phones: [{ type: "mobile", value: "+4917890070012" }],
      addresses: [{ type: "residential", street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1983-12-30" },
    { id: c.roth, tenant_id: tenantId, type: "natural_person", salutation: "herr",
      first_name: "Fabian", last_name: "Roth", language: "de",
      emails: [{ type: "private", value: "fabian.roth@outlook.de" }],
      phones: [{ type: "mobile", value: "+4915123470013" }],
      addresses: [{ type: "residential", street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1994-08-16" },
    { id: c.lindner, tenant_id: tenantId, type: "natural_person", salutation: "frau",
      first_name: "Sophie", last_name: "Lindner", language: "de",
      emails: [{ type: "private", value: "sophie.lindner@web.de" }],
      phones: [{ type: "mobile", value: "+4915623470014" }],
      addresses: [{ type: "residential", street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1995-01-22" },
    { id: c.vogt, tenant_id: tenantId, type: "natural_person", salutation: "frau",
      first_name: "Erna", last_name: "Vogt", language: "de",
      emails: [],
      phones: [{ type: "landline", value: "+493419559091" }],
      addresses: [{ type: "residential", street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig", country: "DE" }],
      date_of_birth: "1941-09-04" },

    // ---- Prager Straße 34 (Uni-Nähe) ----
    { id: c.berg, tenant_id: tenantId, type: "natural_person", salutation: "frau", academic_title: "Dr.",
      first_name: "Claudia", last_name: "Berg", language: "de",
      emails: [{ type: "private", value: "claudia.berg@web.de" }],
      phones: [{ type: "mobile", value: "+4915234570015" }],
      addresses: [{ type: "residential", street: "Universitätsstraße", house_number: "3", zip_code: "04109", city: "Leipzig", country: "DE" }],
      date_of_birth: "1976-04-02" },
    { id: c.wbg, tenant_id: tenantId, type: "legal_entity", salutation: "firma",
      company_name: "WBG Leipzig Wohnungsbaugenossenschaft eG", language: "de",
      emails: [{ type: "business", value: "verwaltung@wbg-leipzig.de" }],
      phones: [{ type: "landline", value: "+493419557000" }],
      addresses: [{ type: "business", street: "Merseburger Straße", house_number: "20", zip_code: "04177", city: "Leipzig", country: "DE" }],
      vat_id: "DE161805001" },
    { id: c.lukasVogel, tenant_id: tenantId, type: "natural_person", salutation: "herr",
      first_name: "Lukas", last_name: "Vogel", language: "de",
      emails: [{ type: "private", value: "lukas.vogel@uni-leipzig.de" }],
      phones: [{ type: "mobile", value: "+4915611110016" }],
      addresses: [{ type: "residential", street: "Prager Straße", house_number: "34", zip_code: "04103", city: "Leipzig", country: "DE" }],
      date_of_birth: "2001-05-19" },
    { id: c.yildiz, tenant_id: tenantId, type: "natural_person", salutation: "frau",
      first_name: "Ayşe", last_name: "Yildiz", language: "de",
      emails: [{ type: "private", value: "a.yildiz@uni-leipzig.de" }],
      phones: [{ type: "mobile", value: "+4915622220017" }],
      addresses: [{ type: "residential", street: "Prager Straße", house_number: "34", zip_code: "04103", city: "Leipzig", country: "DE" }],
      date_of_birth: "2002-09-27" },

    // ---- Gewerbe Nikolaistraße 12 ----
    { id: c.kaffeehaus, tenant_id: tenantId, type: "legal_entity", salutation: "firma",
      company_name: "Café Klein-Paris e.K. (Inh. Susanne Ebert)", language: "de",
      emails: [{ type: "business", value: "info@cafe-kleinparis-leipzig.de" }],
      phones: [{ type: "landline", value: "+493419554040" }],
      addresses: [{ type: "business", street: "Nikolaistraße", house_number: "12", zip_code: "04109", city: "Leipzig", country: "DE" }] },
    { id: c.steuerberater, tenant_id: tenantId, type: "legal_entity", salutation: "firma",
      company_name: "Bergmann & Kollegen Steuerberatungsgesellschaft mbH", language: "de",
      emails: [{ type: "business", value: "kanzlei@bergmann-stb.de" }],
      phones: [{ type: "landline", value: "+493419556060" }],
      addresses: [{ type: "business", street: "Nikolaistraße", house_number: "12", zip_code: "04109", city: "Leipzig", country: "DE" }],
      vat_id: "DE141425001" },

    // ---- Dienstleister ----
    { id: c.wolf, tenant_id: tenantId, type: "natural_person", salutation: "herr",
      first_name: "Mike", last_name: "Wolf", language: "de",
      emails: [{ type: "business", value: "wolf@hausmeister-leipzig.de" }],
      phones: [{ type: "mobile", value: "+4917744450018" }],
      addresses: [{ type: "business", street: "Georg-Schumann-Straße", house_number: "9", zip_code: "04155", city: "Leipzig", country: "DE" }] },
    { id: c.waerme, tenant_id: tenantId, type: "legal_entity", salutation: "firma",
      company_name: "LeipzigWärme GmbH", language: "de",
      emails: [{ type: "business", value: "service@leipzig-waerme.de" }, { type: "business", value: "notdienst@leipzig-waerme.de" }],
      phones: [{ type: "landline", value: "+493419558000" }, { type: "mobile", value: "+4917799990019" }],
      addresses: [{ type: "business", street: "Könneritzstraße", house_number: "40", zip_code: "04229", city: "Leipzig", country: "DE" }],
      vat_id: "DE271830019" },
  ];

  {
    const { error } = await admin.from("contacts").insert(contacts);
    if (error) throw new Error(`Kontakte: ${error.message}`);
  }
  console.log(`${contacts.length} Kontakte angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // OBJEKTE
  // ════════════════════════════════════════════════════════════════════════

  const p = { waldstr: id(), zschochersche: id(), pragerstr: id(), nikolaistr: id() };

  const properties = [
    { id: p.waldstr, tenant_id: tenantId, name: "WEG Waldstraße 82",
      street: "Waldstraße", house_number: "82", zip_code: "04105", city: "Leipzig",
      type: "weg", year_built: 1897, total_area: 598.00, unit_count: 8,
      gemarkung: "Leipzig", flur: "41", flurstueck: "112/3",
      notes: "Denkmalgeschützte Gründerzeitvilla im Waldstraßenviertel, Kernsanierung 2001. Hofdurchfahrt mit Fahrradkeller. 8 WE, kein Aufzug. Gas-Zentralheizung, Bj. Heizung 2016." },
    { id: p.zschochersche, tenant_id: tenantId, name: "Miethaus Zschochersche Straße 15",
      street: "Zschochersche Straße", house_number: "15", zip_code: "04229", city: "Leipzig",
      type: "miethaus", year_built: 1930, total_area: 465.00, unit_count: 6,
      gemarkung: "Plagwitz", flur: "76", flurstueck: "9/2",
      notes: "6 Mietwohnungen. Eigentümer: Pleißeufer Vermögensverwaltung KG. Modernisierung 2013 (Fenster, Heizung). Fassade sanierungsbedürftig, Beschluss 2027 geplant." },
    { id: p.pragerstr, tenant_id: tenantId, name: "WEG Prager Straße 34",
      street: "Prager Straße", house_number: "34", zip_code: "04103", city: "Leipzig",
      type: "weg", year_built: 1996, total_area: 288.00, unit_count: 4,
      gemarkung: "Leipzig", flur: "88", flurstueck: "5/4",
      notes: "Reihenhaus-WEG in Uni-Nähe. 4 WE, alle vermietet (überwiegend Studierende der Universität Leipzig). Fernwärme-Anschluss Stadtwerke Leipzig." },
    { id: p.nikolaistr, tenant_id: tenantId, name: "Geschäftshaus Nikolaistraße 12",
      street: "Nikolaistraße", house_number: "12", zip_code: "04109", city: "Leipzig",
      type: "gewerbe", year_built: 1912, total_area: 365.00, unit_count: 3,
      gemarkung: "Leipzig-Zentrum", flur: "22", flurstueck: "7/1",
      notes: "Geschäftshaus in der Leipziger Innenstadt, denkmalgeschützt. EG: Gastronomie. 1. OG: Steuerkanzlei. 2. OG: derzeit leer stehende Bürofläche, teilbar." },
  ];

  {
    const { error } = await admin.from("properties").insert(properties);
    if (error) throw new Error(`Objekte: ${error.message}`);
  }
  console.log(`${properties.length} Objekte angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // EINHEITEN
  // ════════════════════════════════════════════════════════════════════════

  const u = {
    b1: id(), b2: id(), b3: id(), b4: id(), b5: id(), b6: id(), b7: id(), b8: id(),
    t1: id(), t2: id(), t3: id(), t4: id(), t5: id(), t6: id(),
    z1: id(), z2: id(), z3: id(), z4: id(),
    k1: id(), k2: id(), k3: id(),
  };

  const units = [
    // Waldstraße 82 (8 WE)
    { id: u.b1, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W01", floor: "EG links", type: "apartment", area: 76.00, room_count: 3, mea: 125.5000, heating_type: "Zentralheizung Gas", location_description: "EG links, mit Gartenzugang" },
    { id: u.b2, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W02", floor: "EG rechts", type: "apartment", area: 63.50, room_count: 2.5, mea: 104.0000, heating_type: "Zentralheizung Gas", location_description: "EG rechts" },
    { id: u.b3, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W03", floor: "1. OG links", type: "apartment", area: 90.00, room_count: 4, mea: 147.0000, heating_type: "Zentralheizung Gas", location_description: "1. OG links, Erker zur Straße" },
    { id: u.b4, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W04", floor: "1. OG rechts", type: "apartment", area: 79.00, room_count: 3, mea: 129.5000, heating_type: "Zentralheizung Gas", location_description: "1. OG rechts" },
    { id: u.b5, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W05", floor: "2. OG links", type: "apartment", area: 76.00, room_count: 3, mea: 125.5000, heating_type: "Zentralheizung Gas", location_description: "2. OG links" },
    { id: u.b6, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W06", floor: "2. OG rechts", type: "apartment", area: 63.50, room_count: 2.5, mea: 104.0000, heating_type: "Zentralheizung Gas", location_description: "2. OG rechts" },
    { id: u.b7, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W07", floor: "DG links", type: "apartment", area: 70.00, room_count: 3, mea: 114.5000, heating_type: "Zentralheizung Gas", location_description: "DG links, mit Schräge" },
    { id: u.b8, tenant_id: tenantId, property_id: p.waldstr, unit_number: "W08", floor: "DG rechts", type: "apartment", area: 79.50, room_count: 3, mea: 130.0000, heating_type: "Zentralheizung Gas", location_description: "DG rechts mit Dachterrasse" },

    // Zschochersche Straße 15 (6 ME)
    { id: u.t1, tenant_id: tenantId, property_id: p.zschochersche, unit_number: "M01", floor: "EG", type: "apartment", area: 73.00, room_count: 3, heating_type: "Zentralheizung Gas" },
    { id: u.t2, tenant_id: tenantId, property_id: p.zschochersche, unit_number: "M02", floor: "1. OG", type: "apartment", area: 66.00, room_count: 2.5, heating_type: "Zentralheizung Gas" },
    { id: u.t3, tenant_id: tenantId, property_id: p.zschochersche, unit_number: "M03", floor: "2. OG", type: "apartment", area: 73.00, room_count: 3, heating_type: "Zentralheizung Gas" },
    { id: u.t4, tenant_id: tenantId, property_id: p.zschochersche, unit_number: "M04", floor: "3. OG", type: "apartment", area: 66.00, room_count: 2.5, heating_type: "Zentralheizung Gas" },
    { id: u.t5, tenant_id: tenantId, property_id: p.zschochersche, unit_number: "M05", floor: "DG", type: "apartment", area: 88.00, room_count: 4, heating_type: "Zentralheizung Gas" },
    { id: u.t6, tenant_id: tenantId, property_id: p.zschochersche, unit_number: "M06", floor: "EG seitlich", type: "apartment", area: 50.00, room_count: 2, heating_type: "Zentralheizung Gas" },

    // Prager Straße 34 (4 WE)
    { id: u.z1, tenant_id: tenantId, property_id: p.pragerstr, unit_number: "W01", floor: "1. OG", type: "apartment", area: 70.50, room_count: 3, mea: 240.0000, heating_type: "Fernwärme" },
    { id: u.z2, tenant_id: tenantId, property_id: p.pragerstr, unit_number: "W02", floor: "1. OG", type: "apartment", area: 70.50, room_count: 3, mea: 240.0000, heating_type: "Fernwärme" },
    { id: u.z3, tenant_id: tenantId, property_id: p.pragerstr, unit_number: "W03", floor: "2. OG", type: "apartment", area: 73.00, room_count: 3, mea: 250.0000, heating_type: "Fernwärme" },
    { id: u.z4, tenant_id: tenantId, property_id: p.pragerstr, unit_number: "W04", floor: "2. OG", type: "apartment", area: 73.00, room_count: 3, mea: 250.0000, heating_type: "Fernwärme" },

    // Nikolaistraße 12 (3 GE)
    { id: u.k1, tenant_id: tenantId, property_id: p.nikolaistr, unit_number: "G01", floor: "EG", type: "commercial", area: 140.00, location_description: "EG, Gastronomie mit Schaufenster zur Nikolaistraße" },
    { id: u.k2, tenant_id: tenantId, property_id: p.nikolaistr, unit_number: "G02", floor: "1. OG", type: "commercial", area: 125.00, location_description: "1. OG komplett, Bürofläche (Steuerkanzlei)" },
    { id: u.k3, tenant_id: tenantId, property_id: p.nikolaistr, unit_number: "G03", floor: "2. OG", type: "commercial", area: 100.00, location_description: "2. OG, Bürofläche, teilbar, derzeit leer" },
  ];

  {
    const { error } = await admin.from("units").insert(units);
    if (error) throw new Error(`Einheiten: ${error.message}`);
  }
  console.log(`${units.length} Einheiten angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // ROLLEN (CONTACT_ROLES)
  // ════════════════════════════════════════════════════════════════════════

  const r = {
    krugerOwner: id(), vogelOwner: id(), fischerOwner: id(), reinhardtOwner: id(), marchenkoOwner: id(), zimmermannOwner: id(),
    vogelImmoOwner7: id(), vogelImmoOwner8: id(),
    krugerBeirat: id(), zimmermannBeirat: id(),
    brandtTenant: id(),
    pleisseuferOwner: id(),
    wagnerTenant: id(), hartmannTenant: id(), baumannTenant: id(), tranTenant: id(), rothTenant: id(), lindnerTenant: id(), vogtTenant: id(),
    bergOwner1: id(), bergOwner2: id(), wbgOwner3: id(), wbgOwner4: id(),
    lukasTenant: id(), yildizTenant: id(),
    wbgOwnerNikolaistr: id(),
    kaffeehausTenant: id(), steuerberaterTenant: id(),
    wolfWaldstr: id(), wolfZschochersche: id(),
    waermeWaldstr: id(), waermeZschochersche: id(),
  };

  const contactRoles = [
    // Waldstraße Eigentümer
    { id: r.krugerOwner, tenant_id: tenantId, contact_id: c.kruger, property_id: p.waldstr, unit_id: u.b1, role: "owner", valid_from: "2009-04-15", is_primary: true, metadata: {} },
    { id: r.vogelOwner, tenant_id: tenantId, contact_id: c.vogel, property_id: p.waldstr, unit_id: u.b2, role: "owner", valid_from: "2014-08-01", is_primary: true, metadata: {} },
    { id: r.fischerOwner, tenant_id: tenantId, contact_id: c.fischer, property_id: p.waldstr, unit_id: u.b3, role: "owner", valid_from: "1998-11-20", is_primary: true, metadata: {} },
    { id: r.reinhardtOwner, tenant_id: tenantId, contact_id: c.reinhardt, property_id: p.waldstr, unit_id: u.b4, role: "owner", valid_from: "2017-03-10", is_primary: true, metadata: {} },
    { id: r.marchenkoOwner, tenant_id: tenantId, contact_id: c.marchenko, property_id: p.waldstr, unit_id: u.b5, role: "owner", valid_from: "2020-06-01", is_primary: true, metadata: {} },
    { id: r.zimmermannOwner, tenant_id: tenantId, contact_id: c.zimmermann, property_id: p.waldstr, unit_id: u.b6, role: "owner", valid_from: "2007-09-15", is_primary: true, metadata: {} },
    { id: r.vogelImmoOwner7, tenant_id: tenantId, contact_id: c.vogelImmo, property_id: p.waldstr, unit_id: u.b7, role: "owner", valid_from: "2016-01-12", is_primary: true, metadata: {} },
    { id: r.vogelImmoOwner8, tenant_id: tenantId, contact_id: c.vogelImmo, property_id: p.waldstr, unit_id: u.b8, role: "owner", valid_from: "2016-01-12", is_primary: true, metadata: {} },

    // Waldstraße Beirat
    { id: r.krugerBeirat, tenant_id: tenantId, contact_id: c.kruger, property_id: p.waldstr, role: "beirat", valid_from: "2023-04-01", is_primary: true, metadata: { position: "Vorsitzender" } },
    { id: r.zimmermannBeirat, tenant_id: tenantId, contact_id: c.zimmermann, property_id: p.waldstr, role: "beirat", valid_from: "2023-04-01", is_primary: true, metadata: { position: "Stellvertreter" } },

    // Waldstraße Mieter (W04)
    { id: r.brandtTenant, tenant_id: tenantId, contact_id: c.brandt, property_id: p.waldstr, unit_id: u.b4, role: "tenant", valid_from: "2021-04-01", is_primary: true, metadata: {} },

    // Zschochersche Straße Eigentümerin
    { id: r.pleisseuferOwner, tenant_id: tenantId, contact_id: c.pleisseufer, property_id: p.zschochersche, role: "owner", valid_from: "2007-05-15", is_primary: true, metadata: {} },

    // Zschochersche Straße Mieter
    { id: r.wagnerTenant, tenant_id: tenantId, contact_id: c.wagner, property_id: p.zschochersche, unit_id: u.t1, role: "tenant", valid_from: "2018-09-01", is_primary: true, metadata: {} },
    { id: r.hartmannTenant, tenant_id: tenantId, contact_id: c.hartmann, property_id: p.zschochersche, unit_id: u.t2, role: "tenant", valid_from: "2020-01-15", is_primary: true, metadata: {} },
    { id: r.baumannTenant, tenant_id: tenantId, contact_id: c.baumann, property_id: p.zschochersche, unit_id: u.t3, role: "tenant", valid_from: "2009-03-01", is_primary: true, metadata: {} },
    { id: r.tranTenant, tenant_id: tenantId, contact_id: c.tran, property_id: p.zschochersche, unit_id: u.t4, role: "tenant", valid_from: "2019-07-01", is_primary: true, metadata: {} },
    { id: r.rothTenant, tenant_id: tenantId, contact_id: c.roth, property_id: p.zschochersche, unit_id: u.t5, role: "tenant", valid_from: "2023-10-01", is_primary: true, metadata: {} },
    { id: r.lindnerTenant, tenant_id: tenantId, contact_id: c.lindner, property_id: p.zschochersche, unit_id: u.t5, role: "tenant", valid_from: "2023-10-01", is_primary: false, metadata: {} },
    { id: r.vogtTenant, tenant_id: tenantId, contact_id: c.vogt, property_id: p.zschochersche, unit_id: u.t6, role: "tenant", valid_from: "1984-04-01", is_primary: true, metadata: {} },

    // Prager Straße Eigentümer
    { id: r.bergOwner1, tenant_id: tenantId, contact_id: c.berg, property_id: p.pragerstr, unit_id: u.z1, role: "owner", valid_from: "2013-08-01", is_primary: true, metadata: {} },
    { id: r.bergOwner2, tenant_id: tenantId, contact_id: c.berg, property_id: p.pragerstr, unit_id: u.z2, role: "owner", valid_from: "2015-06-01", is_primary: true, metadata: {} },
    { id: r.wbgOwner3, tenant_id: tenantId, contact_id: c.wbg, property_id: p.pragerstr, unit_id: u.z3, role: "owner", valid_from: "2009-01-01", is_primary: true, metadata: {} },
    { id: r.wbgOwner4, tenant_id: tenantId, contact_id: c.wbg, property_id: p.pragerstr, unit_id: u.z4, role: "owner", valid_from: "2009-01-01", is_primary: true, metadata: {} },

    // Prager Straße Mieter
    { id: r.lukasTenant, tenant_id: tenantId, contact_id: c.lukasVogel, property_id: p.pragerstr, unit_id: u.z1, role: "tenant", valid_from: "2023-10-01", is_primary: true, metadata: {} },
    { id: r.yildizTenant, tenant_id: tenantId, contact_id: c.yildiz, property_id: p.pragerstr, unit_id: u.z2, role: "tenant", valid_from: "2024-04-01", is_primary: true, metadata: {} },

    // Nikolaistraße Eigentümerin + Gewerbemieter
    { id: r.wbgOwnerNikolaistr, tenant_id: tenantId, contact_id: c.wbg, property_id: p.nikolaistr, role: "owner", valid_from: "2004-12-01", is_primary: true, metadata: {} },
    { id: r.kaffeehausTenant, tenant_id: tenantId, contact_id: c.kaffeehaus, property_id: p.nikolaistr, unit_id: u.k1, role: "tenant", valid_from: "2017-05-01", is_primary: true, metadata: {} },
    { id: r.steuerberaterTenant, tenant_id: tenantId, contact_id: c.steuerberater, property_id: p.nikolaistr, unit_id: u.k2, role: "tenant", valid_from: "2011-09-01", is_primary: true, metadata: {} },

    // Dienstleister
    { id: r.wolfWaldstr, tenant_id: tenantId, contact_id: c.wolf, property_id: p.waldstr, role: "caretaker", valid_from: "2017-01-01", is_primary: true, metadata: { scope: "Hausmeister komplett, 2x/Woche" } },
    { id: r.wolfZschochersche, tenant_id: tenantId, contact_id: c.wolf, property_id: p.zschochersche, role: "caretaker", valid_from: "2019-06-01", is_primary: true, metadata: { scope: "Hausmeister komplett, 1x/Woche" } },
    { id: r.waermeWaldstr, tenant_id: tenantId, contact_id: c.waerme, property_id: p.waldstr, role: "service_provider", valid_from: "2014-03-01", is_primary: true, metadata: { scope: "Heizungswartung & Notdienst 24/7" } },
    { id: r.waermeZschochersche, tenant_id: tenantId, contact_id: c.waerme, property_id: p.zschochersche, role: "service_provider", valid_from: "2016-09-01", is_primary: true, metadata: { scope: "Heizungswartung & Notdienst 24/7" } },
  ];

  {
    const { error } = await admin.from("contact_roles").insert(contactRoles);
    if (error) throw new Error(`Rollen: ${error.message}`);
  }
  console.log(`${contactRoles.length} Kontaktrollen angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // VERTRÄGE
  // ════════════════════════════════════════════════════════════════════════

  const contracts = [
    // WEG-Verwaltung
    { id: id(), tenant_id: tenantId, contact_role_id: r.krugerOwner, type: "management_weg", start_date: "2019-01-01", notice_period_months: 6, hausgeld: 298.00, is_fixed_term: false },
    { id: id(), tenant_id: tenantId, contact_role_id: r.bergOwner1, type: "management_weg", start_date: "2017-04-01", notice_period_months: 6, hausgeld: 189.00, is_fixed_term: false },

    // Mietverwaltungs-Vertrag (Zschochersche Straße)
    { id: id(), tenant_id: tenantId, contact_role_id: r.pleisseuferOwner, type: "management_mv", start_date: "2014-01-01", notice_period_months: 12, is_fixed_term: false },

    // Mietverträge Zschochersche Straße
    { id: id(), tenant_id: tenantId, contact_role_id: r.wagnerTenant, type: "rental_residential", start_date: "2018-09-01", cold_rent: 510.00, operating_costs_prepayment: 92.00, heating_costs_prepayment: 72.00, deposit_amount: 1530.00, deposit_type: "Barkaution", is_fixed_term: false },
    { id: id(), tenant_id: tenantId, contact_role_id: r.hartmannTenant, type: "rental_residential", start_date: "2020-01-15", cold_rent: 465.00, operating_costs_prepayment: 82.00, heating_costs_prepayment: 62.00, deposit_amount: 1395.00, deposit_type: "Barkaution", is_fixed_term: false },
    { id: id(), tenant_id: tenantId, contact_role_id: r.baumannTenant, type: "rental_residential", start_date: "2009-03-01", cold_rent: 445.00, operating_costs_prepayment: 92.00, heating_costs_prepayment: 72.00, deposit_amount: 1335.00, deposit_type: "Barkaution", is_fixed_term: false },
    { id: id(), tenant_id: tenantId, contact_role_id: r.tranTenant, type: "rental_residential", start_date: "2019-07-01", cold_rent: 475.00, operating_costs_prepayment: 82.00, heating_costs_prepayment: 62.00, deposit_amount: 1425.00, deposit_type: "Bürgschaft", is_fixed_term: false },
    { id: id(), tenant_id: tenantId, contact_role_id: r.rothTenant, type: "rental_residential", start_date: "2023-10-01", cold_rent: 690.00, operating_costs_prepayment: 105.00, heating_costs_prepayment: 85.00, deposit_amount: 2070.00, deposit_type: "Barkaution", is_fixed_term: false },
    { id: id(), tenant_id: tenantId, contact_role_id: r.vogtTenant, type: "rental_residential", start_date: "1984-04-01", cold_rent: 275.00, operating_costs_prepayment: 62.00, heating_costs_prepayment: 52.00, deposit_amount: 825.00, deposit_type: "Sparbuch", is_fixed_term: false },

    // Mietverträge Prager Straße
    { id: id(), tenant_id: tenantId, contact_role_id: r.lukasTenant, type: "rental_residential", start_date: "2023-10-01", cold_rent: 495.00, operating_costs_prepayment: 92.00, heating_costs_prepayment: 78.00, deposit_amount: 1485.00, deposit_type: "Barkaution", is_fixed_term: false },
    { id: id(), tenant_id: tenantId, contact_role_id: r.yildizTenant, type: "rental_residential", start_date: "2024-04-01", cold_rent: 510.00, operating_costs_prepayment: 92.00, heating_costs_prepayment: 78.00, deposit_amount: 1530.00, deposit_type: "Barkaution", is_fixed_term: false },

    // Gewerbemietverträge Nikolaistraße
    { id: id(), tenant_id: tenantId, contact_role_id: r.kaffeehausTenant, type: "rental_commercial", start_date: "2017-05-01", end_date: "2027-04-30", is_fixed_term: true, cold_rent: 1780.00, operating_costs_prepayment: 270.00, heating_costs_prepayment: 175.00, deposit_amount: 5340.00, deposit_type: "Bürgschaft" },
    { id: id(), tenant_id: tenantId, contact_role_id: r.steuerberaterTenant, type: "rental_commercial", start_date: "2011-09-01", is_fixed_term: false, cold_rent: 1560.00, operating_costs_prepayment: 240.00, heating_costs_prepayment: 160.00, deposit_amount: 4680.00, deposit_type: "Bürgschaft" },
  ];

  {
    const { error } = await admin.from("contracts").insert(contracts);
    if (error) throw new Error(`Verträge: ${error.message}`);
  }
  console.log(`${contracts.length} Verträge angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // BANKVERBINDUNGEN
  // ════════════════════════════════════════════════════════════════════════

  const bankAccounts = [
    { id: id(), tenant_id: tenantId, contact_id: c.kruger, iban: "DE97860555590012345678", bic: "WELADE8LXXX", account_holder: "Dr. Stefan Krüger", sepa_mandate_reference: "SEPA-KRUEGER-2019", sepa_mandate_date: "2019-01-15", sepa_mandate_status: "active" },
    { id: id(), tenant_id: tenantId, contact_id: c.vogel, iban: "DE64860555590011119999", bic: "WELADE8LXXX", account_holder: "Petra Vogel", sepa_mandate_reference: "SEPA-VOGEL-2019", sepa_mandate_date: "2019-02-01", sepa_mandate_status: "active" },
    { id: id(), tenant_id: tenantId, contact_id: c.wagner, iban: "DE31860956600098765001", bic: "GENODEF1LVB", account_holder: "Jens Wagner", sepa_mandate_reference: "SEPA-WAGNER-2018", sepa_mandate_date: "2018-09-01", sepa_mandate_status: "active" },
    { id: id(), tenant_id: tenantId, contact_id: c.pleisseufer, iban: "DE45860555590000112233", bic: "WELADE8LXXX", account_holder: "Pleißeufer Vermögensverwaltung KG", sepa_mandate_reference: null, sepa_mandate_date: null, sepa_mandate_status: null },
  ];

  {
    const { error } = await admin.from("bank_accounts").insert(bankAccounts);
    if (error) throw new Error(`Bankverbindungen: ${error.message}`);
  }
  console.log(`${bankAccounts.length} Bankverbindungen angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // VORGÄNGE (TICKETS)
  // ════════════════════════════════════════════════════════════════════════

  const t = {
    heizung: id(), wasserschaden: id(), laerm: id(), schimmel: id(), hausgeld: id(),
    etv: id(), treppenlicht: id(), sperrmuell: id(), glasfaser: id(), markise: id(),
  };

  const tickets = [
    { id: t.heizung, tenant_id: tenantId, contact_id: c.brandt, unit_id: u.b4, property_id: p.waldstr,
      title: "Heizungsausfall W04 – komplett kalt",
      description: "Seit 28.08. abend heizt W04 nicht mehr. Heizkörper bleiben kalt, Vorlauf rauscht. Familie mit Kleinkind. LeipzigWärme verständigen.",
      category: "Heizung", status: "in_progress", priority: "urgent", created_at: "2026-08-29T07:42:00+02:00" },
    { id: t.wasserschaden, tenant_id: tenantId, contact_id: c.hartmann, unit_id: u.t2, property_id: p.zschochersche,
      title: "Wasserfleck Decke Bad M02",
      description: "Nasse Stelle an der Badezimmerdecke M02. Vermutlich Leitung von M03 darüber. Frau Hartmann hört nachts Tropfgeräusch. Hausmeister Wolf prüft.",
      category: "Schadensmeldung", status: "in_progress", priority: "high", created_at: "2026-08-25T14:20:00+02:00" },
    { id: t.laerm, tenant_id: tenantId, contact_id: c.zimmermann, unit_id: u.b6, property_id: p.waldstr,
      title: "Wiederholter nächtlicher Lärm aus W04",
      description: "Hr. Zimmermann (W06) beschwert sich über laute Musik aus W04 (Mieter Brandt) zwischen 23:00 und 02:00, mehrfach in der Vorwoche. Bittet um schriftliche Ermahnung.",
      category: "Beschwerde", status: "new", priority: "normal", created_at: "2026-08-27T10:15:00+02:00" },
    { id: t.schimmel, tenant_id: tenantId, contact_id: c.tran, unit_id: u.t4, property_id: p.zschochersche,
      title: "Mietminderung 15% wegen Schimmel im Schlafzimmer",
      description: "Familie Tran meldet Schimmel an der Außenwand des Schlafzimmers (Nordseite). Anwaltsschreiben mit Mietminderung 15% angekündigt. Sachverständigentermin nötig.",
      category: "Mängelanzeige", status: "waiting", priority: "normal", created_at: "2026-08-20T16:00:00+02:00" },
    { id: t.hausgeld, tenant_id: tenantId, contact_id: c.marchenko, unit_id: u.b5, property_id: p.waldstr,
      title: "Hausgeld-Rückstand W05 (3 Monate)",
      description: "Frau Marchenko schuldet Hausgeld Juni-August 2026 (3 × 298 € = 894 €). 1. Mahnung am 15.08. versendet, keine Reaktion. 2. Mahnung vorbereiten.",
      category: "Forderung", status: "in_progress", priority: "normal", created_at: "2026-08-22T09:00:00+02:00" },
    { id: t.etv, tenant_id: tenantId, contact_id: c.kruger, unit_id: null, property_id: p.waldstr,
      title: "ETV 2026 Waldstraße – Beschlussvorlagen erstellen",
      description: "Ordentliche Eigentümerversammlung 14.10.2026 im Vereinshaus. Beschlussvorlagen: (1) Jahresabrechnung 2025, (2) Wirtschaftsplan 2026, (3) Sonderumlage Fassadenanstrich (geschätzt 21.000 €), (4) Beiratsneuwahl.",
      category: "WEG-Versammlung", status: "new", priority: "low", created_at: "2026-08-18T14:30:00+02:00" },
    { id: t.treppenlicht, tenant_id: tenantId, contact_id: c.baumann, unit_id: null, property_id: p.zschochersche,
      title: "Treppenhausbeleuchtung Zschochersche Str. 1.+2. OG defekt",
      description: "Bewegungsmelder reagiert nicht. Hr. Baumann im Dunkeln auf Treppe. Wolf beauftragt.",
      category: "Reparatur", status: "resolved", priority: "low", created_at: "2026-08-14T18:45:00+02:00" },
    { id: t.sperrmuell, tenant_id: tenantId, contact_id: c.vogel, unit_id: null, property_id: p.waldstr,
      title: "Sperrmüll im Hof Waldstraße",
      description: "Frau Vogel meldet, dass jemand alte Möbel im Innenhof abgestellt hat. Verursacher unbekannt. Entsorgung beauftragen, Kosten ggf. umlegen.",
      category: "Hausordnung", status: "new", priority: "normal", created_at: "2026-08-30T11:00:00+02:00" },
    { id: t.glasfaser, tenant_id: tenantId, contact_id: c.berg, unit_id: null, property_id: p.pragerstr,
      title: "envia TEL Glasfaserausbau Prager Straße",
      description: "envia TEL plant Glasfaserausbau im Bereich Prager Straße. Eigentümer-Zustimmung erforderlich. Termin mit Vertrieb 20.09.",
      category: "Modernisierung", status: "waiting", priority: "low", created_at: "2026-08-10T10:00:00+02:00" },
    { id: t.markise, tenant_id: tenantId, contact_id: c.kaffeehaus, unit_id: u.k1, property_id: p.nikolaistr,
      title: "Markisenmotor Café defekt",
      description: "Frau Ebert meldet, dass die Markise vor dem Café Klein-Paris nicht mehr ausfährt. Laut MV § 12 Mietersache. Klärung Kostenträger.",
      category: "Reparatur", status: "closed", priority: "low", created_at: "2026-08-05T15:30:00+02:00" },
  ];

  {
    const { error } = await admin.from("tickets").insert(tickets);
    if (error) throw new Error(`Vorgänge: ${error.message}`);
  }
  console.log(`${tickets.length} Vorgänge angelegt.\n`);

  // resolved_at für erledigte Tickets
  await admin.from("tickets").update({ resolved_at: "2026-08-15T16:00:00+02:00" }).eq("id", t.treppenlicht);
  await admin.from("tickets").update({ resolved_at: "2026-08-07T11:00:00+02:00" }).eq("id", t.markise);

  // ════════════════════════════════════════════════════════════════════════
  // KOMMUNIKATIONEN
  // ════════════════════════════════════════════════════════════════════════

  const communications = [
    // Heizungsausfall
    { id: id(), tenant_id: tenantId, contact_id: c.brandt, ticket_id: t.heizung, channel: "phone", direction: "inbound",
      subject: "Heizung kalt seit gestern Abend",
      body: "Hr. Brandt rief 07:35. Wohnung kalt, Kind 2 Jahre. Bittet dringend um Reparatur. Zugesagt: Rückruf nach Kontakt mit LeipzigWärme.",
      occurred_at: "2026-08-29T07:35:00+02:00" },
    { id: id(), tenant_id: tenantId, contact_id: c.waerme, ticket_id: t.heizung, channel: "phone", direction: "outbound",
      subject: "Notdienst Waldstraße 82",
      body: "Anruf LeipzigWärme Notdienst, Herr Krause nimmt auf. Techniker innerhalb 4 h vor Ort. Auftragsnr.: LW-2026-0829-07.",
      occurred_at: "2026-08-29T07:50:00+02:00" },
    { id: id(), tenant_id: tenantId, contact_id: c.brandt, ticket_id: t.heizung, channel: "email", direction: "outbound",
      subject: "WG: Notdienst beauftragt",
      body: "Sehr geehrte Familie Brandt,\n\nwie telefonisch besprochen kommt heute zwischen 11 und 13 Uhr ein Techniker von LeipzigWärme. Bitte zu Hause sein.\n\nAuftragsnummer: LW-2026-0829-07\n\nMit freundlichen Grüßen\nPleißental Hausverwaltung GmbH",
      occurred_at: "2026-08-29T07:55:00+02:00" },

    // Wasserschaden
    { id: id(), tenant_id: tenantId, contact_id: c.hartmann, ticket_id: t.wasserschaden, channel: "email", direction: "inbound",
      subject: "Wasserfleck im Bad",
      body: "Hallo, an unserer Badezimmerdecke ist seit gestern ein dunkler Fleck. Heute Morgen feucht. Können Sie das prüfen lassen?\n\nGrüße J. Hartmann",
      occurred_at: "2026-08-25T14:18:00+02:00" },
    { id: id(), tenant_id: tenantId, contact_id: c.wolf, ticket_id: t.wasserschaden, channel: "phone", direction: "outbound",
      subject: "Auftrag Wasserschaden M02",
      body: "Telefonat Wolf. Termin Zschochersche Str. 15 morgen 9:00, Erstprüfung. Mit Baumann (M03) Zugang abklären.",
      occurred_at: "2026-08-25T14:35:00+02:00" },

    // Lärmbeschwerde
    { id: id(), tenant_id: tenantId, contact_id: c.zimmermann, ticket_id: t.laerm, channel: "letter", direction: "inbound",
      subject: "Ruhestörung W04",
      body: "Schriftliche Beschwerde von Hr. Zimmermann mit Datum/Uhrzeit-Liste. Auszug aus seinem Kalender mit 5 Vorfällen letzte Woche. Bittet um Ermahnung an Familie Brandt.",
      occurred_at: "2026-08-27T10:15:00+02:00" },

    // Mietminderung Schimmel
    { id: id(), tenant_id: tenantId, contact_id: c.tran, ticket_id: t.schimmel, channel: "letter", direction: "inbound",
      subject: "Schimmelmängelanzeige & Mietminderung",
      body: "Anwaltsschreiben Kanzlei Söllner (vertritt Familie Tran). Mängelanzeige nach § 536 BGB. Mietminderung 15% rückwirkend ab Juli 2026. Frist zur Mangelbeseitigung 14 Tage.",
      occurred_at: "2026-08-20T15:45:00+02:00" },
    { id: id(), tenant_id: tenantId, contact_id: c.pleisseufer, ticket_id: t.schimmel, channel: "email", direction: "outbound",
      subject: "Mängelanzeige Zschochersche Str. M04 – Eigentümerinformation",
      body: "Sehr geehrte Damen und Herren,\n\nwir informieren Sie über eine Mängelanzeige bzgl. Wohnung M04 (Familie Tran). Schimmel an der Außenwand Schlafzimmer. Anwaltsschreiben mit Mietminderung 15% liegt vor.\n\nWir empfehlen einen Sachverständigentermin (~600 € Kosten).\n\nMit freundlichen Grüßen",
      occurred_at: "2026-08-21T09:00:00+02:00" },

    // Hausgeld-Rückstand
    { id: id(), tenant_id: tenantId, contact_id: c.marchenko, ticket_id: t.hausgeld, channel: "letter", direction: "outbound",
      subject: "1. Mahnung Hausgeld Juni-Juli",
      body: "Erste Mahnung per Einschreiben am 15.08.2026. Forderung 596,00 € + 5,00 € Mahngebühr. Frist 14 Tage.",
      occurred_at: "2026-08-15T11:00:00+02:00" },

    // Treppenhauslicht
    { id: id(), tenant_id: tenantId, contact_id: c.baumann, ticket_id: t.treppenlicht, channel: "phone", direction: "inbound",
      subject: "Treppenhauslicht geht nicht",
      body: "Hr. Baumann meldet defekten Bewegungsmelder. Auftrag an Wolf. 24 h später behoben (Sensor + 2 LED-Lampen, 49 €).",
      occurred_at: "2026-08-14T18:45:00+02:00" },

    // Markise
    { id: id(), tenant_id: tenantId, contact_id: c.kaffeehaus, ticket_id: t.markise, channel: "meeting", direction: "inbound",
      subject: "Vor-Ort-Termin Markise Café",
      body: "Persönlicher Termin mit Frau Ebert. Klärung: Markise gehört nach MV § 12 zur Mietsache, Reparatur Mietersache. Frau Ebert beauftragt Markisenfirma Held direkt. Erledigt.",
      occurred_at: "2026-08-06T10:30:00+02:00" },

    // Glasfaser
    { id: id(), tenant_id: tenantId, contact_id: c.berg, ticket_id: t.glasfaser, channel: "email", direction: "inbound",
      subject: "envia TEL Glasfaserausbau – Zustimmung Eigentümer",
      body: "Frau Dr. Berg fragt nach dem Stand des envia TEL-Termins. Würde der Glasfaserverlegung zustimmen, möchte aber wissen, ob WBG Leipzig ebenfalls unterschreibt.",
      occurred_at: "2026-08-11T16:20:00+02:00" },

    // Standalone-Kommunikation (kein Ticket)
    { id: id(), tenant_id: tenantId, contact_id: c.pleisseufer, ticket_id: null, channel: "phone", direction: "inbound",
      subject: "M01 nach Auszug Wagner frei?",
      body: "Pleißeufer KG fragt, ob Familie Wagner wirklich kündigt. Stand: Kündigung zum 30.11.2026 vorgemerkt. Nachmietersuche soll Anfang Oktober starten.",
      occurred_at: "2026-08-31T11:00:00+02:00" },
  ];

  {
    const { error } = await admin.from("communications").insert(communications);
    if (error) throw new Error(`Kommunikationen: ${error.message}`);
  }
  console.log(`${communications.length} Kommunikationen angelegt.\n`);

  // ════════════════════════════════════════════════════════════════════════
  // PROFIL MIT TENANT VERKNÜPFEN
  // ════════════════════════════════════════════════════════════════════════

  {
    const { error } = await admin.from("profiles").upsert(
      { id: userId, tenant_id: tenantId, role: "tenant_admin", name: "Köhler", initials: "K" },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Profil: ${error.message}`);
  }
  console.log("Profil verknüpft: Köhler → tenant_admin\n");

  console.log("════════════════════════════════════════════════");
  console.log("Testzugang & Demo-Daten fertig!");
  console.log(`  Login:      ${EMAIL}`);
  if (!already) console.log(`  Passwort:   ${PASSWORD}`);
  console.log(`  Tenant:     Pleißental Hausverwaltung GmbH (Köhler) [${tenantId}]`);
  console.log(`  Objekte:    ${properties.length}, Einheiten: ${units.length}, Kontakte: ${contacts.length}`);
  console.log(`  Verträge:   ${contracts.length}, Vorgänge: ${tickets.length}, Kommunikationen: ${communications.length}`);
  console.log("════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Unerwarteter Fehler:", err);
  process.exit(1);
});
