"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

type EmailEntry = { type: string; value: string };
type PhoneEntry = { type: string; value: string };
type AddressEntry = {
  type: string;
  street: string;
  house_number: string;
  zip_code: string;
  city: string;
  country: string;
};

export default function ContactCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [contactType, setContactType] = useState<"natural_person" | "legal_entity">("natural_person");
  const [salutation, setSalutation] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [language, setLanguage] = useState("de");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [taxId, setTaxId] = useState("");
  const [notes, setNotes] = useState("");

  const [emails, setEmails] = useState<EmailEntry[]>([{ type: "business", value: "" }]);
  const [phones, setPhones] = useState<PhoneEntry[]>([{ type: "mobile", value: "" }]);
  const [addresses, setAddresses] = useState<AddressEntry[]>([
    { type: "residential", street: "", house_number: "", zip_code: "", city: "", country: "DE" },
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body = {
      type: contactType,
      salutation: salutation || null,
      first_name: contactType === "natural_person" ? firstName || null : null,
      last_name: contactType === "natural_person" ? lastName || null : null,
      company_name: contactType === "legal_entity" ? companyName || null : null,
      language,
      date_of_birth: dateOfBirth || null,
      nationality: nationality || null,
      tax_id: taxId || null,
      notes: notes || null,
      emails: emails.filter((e) => e.value.trim()),
      phones: phones.filter((p) => p.value.trim()),
      addresses: addresses.filter((a) => a.street.trim() || a.city.trim()),
    };

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/kontakte/${data.id}`);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setError(err.error);
      setSaving(false);
    }
  }

  const inputCls =
    "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto bg-slate-50 dark:bg-gray-950">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/kontakte" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Kontakte
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">Neuer Kontakt</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Neuer Kontakt</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Type toggle */}
        <div className="flex gap-2">
          {(["natural_person", "legal_entity"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setContactType(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                contactType === t
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
              }`}
            >
              {t === "natural_person" ? "Natürliche Person" : "Juristische Person"}
            </button>
          ))}
        </div>

        {/* Basic fields */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Stammdaten
          </legend>

          {contactType === "natural_person" ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Anrede</label>
                  <select value={salutation} onChange={(e) => setSalutation(e.target.value)} className={inputCls}>
                    <option value="">–</option>
                    <option value="herr">Herr</option>
                    <option value="frau">Frau</option>
                    <option value="eheleute">Eheleute</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Vorname</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nachname *</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Geburtsdatum</label>
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Staatsangehörigkeit</label>
                  <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="DE" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sprache</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                    <option value="de">Deutsch</option>
                    <option value="en">Englisch</option>
                    <option value="ru">Russisch</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Firmenname *</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Sprache</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                  <option value="ru">Russisch</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Steuer-ID</label>
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="11-stellig" className={inputCls} />
          </div>
        </fieldset>

        {/* Emails */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            E-Mail-Adressen
          </legend>
          {emails.map((em, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={em.type}
                onChange={(e) => {
                  const next = [...emails];
                  next[i] = { ...next[i], type: e.target.value };
                  setEmails(next);
                }}
                className={`${inputCls} w-32 flex-shrink-0`}
              >
                <option value="business">Geschäftl.</option>
                <option value="private">Privat</option>
                <option value="other">Sonstige</option>
              </select>
              <input
                type="email"
                value={em.value}
                onChange={(e) => {
                  const next = [...emails];
                  next[i] = { ...next[i], value: e.target.value };
                  setEmails(next);
                }}
                placeholder="mail@example.com"
                className={`${inputCls} flex-1`}
              />
              {emails.length > 1 && (
                <button type="button" onClick={() => setEmails(emails.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEmails([...emails, { type: "business", value: "" }])}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400"
          >
            <Plus className="w-3 h-3" /> Weitere E-Mail
          </button>
        </fieldset>

        {/* Phones */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Telefonnummern
          </legend>
          {phones.map((ph, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={ph.type}
                onChange={(e) => {
                  const next = [...phones];
                  next[i] = { ...next[i], type: e.target.value };
                  setPhones(next);
                }}
                className={`${inputCls} w-32 flex-shrink-0`}
              >
                <option value="mobile">Mobil</option>
                <option value="landline">Festnetz</option>
                <option value="fax">Fax</option>
              </select>
              <input
                type="tel"
                value={ph.value}
                onChange={(e) => {
                  const next = [...phones];
                  next[i] = { ...next[i], value: e.target.value };
                  setPhones(next);
                }}
                placeholder="+49 ..."
                className={`${inputCls} flex-1`}
              />
              {phones.length > 1 && (
                <button type="button" onClick={() => setPhones(phones.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPhones([...phones, { type: "mobile", value: "" }])}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400"
          >
            <Plus className="w-3 h-3" /> Weitere Telefonnummer
          </button>
        </fieldset>

        {/* Address */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Adresse
          </legend>
          {addresses.map((addr, i) => (
            <div key={i} className="space-y-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <select
                value={addr.type}
                onChange={(e) => {
                  const next = [...addresses];
                  next[i] = { ...next[i], type: e.target.value };
                  setAddresses(next);
                }}
                className={`${inputCls} w-40`}
              >
                <option value="residential">Wohnadresse</option>
                <option value="postal">Postanschrift</option>
                <option value="billing">Rechnungsadresse</option>
              </select>
              <div className="grid grid-cols-4 gap-3">
                <input
                  value={addr.street}
                  onChange={(e) => {
                    const next = [...addresses];
                    next[i] = { ...next[i], street: e.target.value };
                    setAddresses(next);
                  }}
                  placeholder="Straße"
                  className={`${inputCls} col-span-3`}
                />
                <input
                  value={addr.house_number}
                  onChange={(e) => {
                    const next = [...addresses];
                    next[i] = { ...next[i], house_number: e.target.value };
                    setAddresses(next);
                  }}
                  placeholder="Nr."
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  value={addr.zip_code}
                  onChange={(e) => {
                    const next = [...addresses];
                    next[i] = { ...next[i], zip_code: e.target.value };
                    setAddresses(next);
                  }}
                  placeholder="PLZ"
                  className={inputCls}
                />
                <input
                  value={addr.city}
                  onChange={(e) => {
                    const next = [...addresses];
                    next[i] = { ...next[i], city: e.target.value };
                    setAddresses(next);
                  }}
                  placeholder="Ort"
                  className={`${inputCls} col-span-2`}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setAddresses([...addresses, { type: "postal", street: "", house_number: "", zip_code: "", city: "", country: "DE" }])
            }
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400"
          >
            <Plus className="w-3 h-3" /> Weitere Adresse
          </button>
        </fieldset>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
              bg-orange-500 text-white hover:bg-orange-600 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Speichern
          </button>
          <Link
            href="/kontakte"
            className="px-6 py-3 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800
              dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
