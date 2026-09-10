"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

export default function PropertyCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("weg");
  const [yearBuilt, setYearBuilt] = useState("");
  const [totalArea, setTotalArea] = useState("");
  const [unitCount, setUnitCount] = useState("");
  const [gemarkung, setGemarkung] = useState("");
  const [flur, setFlur] = useState("");
  const [flurstueck, setFlurstueck] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        street: street || null,
        house_number: houseNumber || null,
        zip_code: zipCode || null,
        city: city || null,
        type,
        year_built: yearBuilt ? parseInt(yearBuilt) : null,
        total_area: totalArea ? parseFloat(totalArea) : null,
        unit_count: unitCount ? parseInt(unitCount) : null,
        gemarkung: gemarkung || null,
        flur: flur || null,
        flurstueck: flurstueck || null,
        notes: notes || null,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/objekte/${data.id}`);
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
    <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto bg-slate-50 dark:bg-gray-950">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/objekte" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Objekte
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">Neues Objekt</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Neues Objekt</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Grunddaten */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Grunddaten
          </legend>
          <div>
            <label className={labelCls}>Bezeichnung *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="z.B. WEG Berliner Str. 12"
              required
            />
          </div>
          <div>
            <label className={labelCls}>Objekttyp</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="weg">WEG</option>
              <option value="miethaus">Miethaus</option>
              <option value="sondereigentum">Sondereigentum</option>
              <option value="gewerbe">Gewerbe</option>
              <option value="mixed">Gemischt</option>
            </select>
          </div>
        </fieldset>

        {/* Adresse */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Adresse
          </legend>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className={labelCls}>Straße</label>
              <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hausnr.</label>
              <input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>PLZ</label>
              <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Ort</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* Details */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Details
          </legend>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Baujahr</label>
              <input
                type="number"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                placeholder="z.B. 1985"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Gesamtfläche (m²)</label>
              <input
                type="number"
                step="0.01"
                value={totalArea}
                onChange={(e) => setTotalArea(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Anzahl Einheiten</label>
              <input
                type="number"
                value={unitCount}
                onChange={(e) => setUnitCount(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </fieldset>

        {/* Grundbuch */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Grundbuch
          </legend>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Gemarkung</label>
              <input value={gemarkung} onChange={(e) => setGemarkung(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Flur</label>
              <input value={flur} onChange={(e) => setFlur(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Flurstück</label>
              <input value={flurstueck} onChange={(e) => setFlurstueck(e.target.value)} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* Notizen */}
        <div>
          <label className={labelCls}>Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
              bg-orange-500 text-white hover:bg-orange-600 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Erstellen
          </button>
          <Link
            href="/objekte"
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
