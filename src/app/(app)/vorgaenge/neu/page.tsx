"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { contactDisplayName } from "@/types/crm";

type ContactOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  type: "natural_person" | "legal_entity";
};

type PropertyOption = {
  id: string;
  name: string;
};

type UnitOption = {
  id: string;
  unit_number: string;
};

export default function TicketCreatePageWrapper() {
  return (
    <Suspense fallback={null}>
      <TicketCreatePage />
    </Suspense>
  );
}

function TicketCreatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialContactId = params.get("contact_id") ?? "";
  const initialPropertyId = params.get("property_id") ?? "";
  const initialUnitId = params.get("unit_id") ?? "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("normal");
  const [contactId, setContactId] = useState(initialContactId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [unitId, setUnitId] = useState(initialUnitId);

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/properties").then((r) => (r.ok ? r.json() : [])),
    ]).then(([c, p]) => {
      setContacts(c);
      setProperties(p);
    });
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setUnitId("");
      return;
    }
    fetch(`/api/properties/${propertyId}/units`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UnitOption[]) => {
        setUnits(data);
        // Behalte unitId, falls die Einheit zur neuen Liste passt (z.B. URL-Prefill)
        setUnitId((current) => (data.some((u) => u.id === current) ? current : ""));
      });
  }, [propertyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        category: category || null,
        priority,
        contact_id: contactId || null,
        property_id: propertyId || null,
        unit_id: unitId || null,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/vorgaenge/${data.id}`);
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
        <Link href="/vorgaenge" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Vorgänge
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">Neuer Vorgang</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Neuer Vorgang</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className={labelCls}>Titel *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="z.B. Wasserschaden Einheit W03"
            required
          />
        </div>

        <div>
          <label className={labelCls}>Beschreibung</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputCls}
            placeholder="Details zum Vorgang…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Kategorie</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
              placeholder="z.B. Schadensmeldung"
            />
          </div>
          <div>
            <label className={labelCls}>Priorität</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              <option value="low">Niedrig</option>
              <option value="normal">Normal</option>
              <option value="high">Hoch</option>
              <option value="urgent">Dringend</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Kontakt</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
            <option value="">– Keiner –</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactDisplayName(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Objekt</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={inputCls}>
              <option value="">– Keines –</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Einheit</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className={inputCls}
              disabled={!propertyId}
            >
              <option value="">– Keine –</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_number}
                </option>
              ))}
            </select>
          </div>
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
            href="/vorgaenge"
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
