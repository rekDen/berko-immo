"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Plus, Trash2, Calculator,
  LayoutGrid, ListChecks, BarChart3, Layers, Sparkles, Check,
  Target, Euro, Percent, ListOrdered, Users, Wallet, Ruler, Hash,
  Zap, Home, Landmark, Package, Building2, Tag,
  MessageSquare, X, Send, ClipboardCheck, Pencil, TrendingUp,
  Save, FolderOpen, ChevronDown, UploadCloud, FileText, Link2,
  File, FileImage, FileSpreadsheet,
} from "lucide-react";

// ─── Typen ──────────────────────────────────────────────────────────────────
type Unit = { id: string; unit_number: string; type: string; area: number | null };
type Property = {
  id: string; name: string; city: string | null; objektfaktor: number | null;
  is_monument: boolean | null; erhaltungssatzung: boolean | null; living_area: number | null;
  kaufpreis_eur: number | null; erwerbsnebenkosten_eur: number | null;
  eingesetztes_ek_eur: number | null; fremdkapital_eur: number | null; fk_zins_pct: number | null;
  units: Unit[];
};
type MassnahmeTyp = {
  code: string; kategorie: string; klasse: string; label: string;
  param_schema: Record<string, string> | null; constraint_codes: string[] | null;
};
type Massnahme = {
  id: string; typ_code: string; params: Record<string, number>;
  invest_eur: number | null; ertragswirkung_pa_eur: number | null;
  werthebel_eur: number | null; amortisation_jahre: number | null;
  zulaessigkeit: string | null;
  massnahme_typ: { label: string; kategorie: string; klasse: string; param_schema?: Record<string, string> | null } | null;
};
type Potenzialflaeche = { id: string; art: string; flaeche_qm: number | null; menge: number | null; beschreibung: string | null };
type Mietvertrag = { id: string; unit_id: string; kaltmiete_eur: number; mietart: string; leerstand: boolean };
type MassErgebnis = {
  massnahme_id: string; typ_code: string; label?: string; klasse: string;
  invest_eur: number; ertragswirkung_pa_eur: number; werthebel_eur: number;
  amortisation_jahre: number | null; zulaessigkeit: string; begruendung: string; auflagen: string[]; hinweise: string[];
};
type Snapshot = {
  ist_noi_eur: number; delta_noi_eur: number; noi_eur: number; faktor: number;
  verkehrswert_eur: number; bruttorendite: number | null; nettorendite: number | null;
  ek_rendite: number | null; aufteilungsgewinn_eur: number; massnahmen: MassErgebnis[];
};
type WaterfallStep = { label: string; wert: number; typ: "basis" | "delta" | "summe" };
type Vergleich = { ist: Snapshot; potenzial: Snapshot; waterfall: WaterfallStep[] };
type BubblePunkt = { massnahme_id: string; label?: string; klasse: string; x_invest: number; y_werthebel: number; groesse: number; zulaessigkeit: string };
type Priorisierung = { rangliste: MassErgebnis[]; matrix: BubblePunkt[] };

const eur = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number | null | undefined) => (n == null ? "—" : `${(n * 100).toFixed(2)} %`);

type Dokument = {
  id: string; title: string; file_name: string; mime_type: string | null;
  file_size: number | null; uploaded_at?: string; created_at?: string;
  document_categories?: { name_de: string; group_code?: string } | null;
};
type ExtraktObjekt = {
  bezeichnung?: string; stadt?: string; baujahr?: number; wohnflaeche_qm?: number;
  grundstuecksflaeche_qm?: number; energieklasse?: string; denkmalschutz?: boolean;
  bodenrichtwert?: number; objektfaktor?: number;
};
type Extrakt = {
  objekt?: ExtraktObjekt;
  einheiten?: { bezeichnung?: string; typ?: string; flaeche_qm?: number; etage?: string }[];
  mietvertraege?: { einheit?: string; kaltmiete_eur_monat?: number; mietart?: string; leerstand?: boolean }[];
  potenzialflaechen?: { art?: string; flaeche_qm?: number; beschreibung?: string }[];
  hinweise?: string[];
};
type Vorschlag = { typ_code: string; begruendung: string; prioritaet?: string };
type SzenarioSnapshot = {
  noi_eur: number | null; verkehrswert_eur: number | null;
  nettorendite: number | null; bruttorendite: number | null;
  ek_rendite: number | null; aufteilungsgewinn_eur: number | null;
  engine_version: string | null; berechnet_am: string | null;
};
type Szenario = {
  id: string; name: string; created_at: string;
  szenario_massnahme: { massnahme_id: string; massnahme: { invest_eur: number | null } | null }[];
  kennzahlen_snapshot: SzenarioSnapshot[];
};

const TABS = [
  { key: "flaeche", label: "Flächenkataster", icon: LayoutGrid },
  { key: "ki", label: "KI-Datenerfassung", icon: Sparkles },
  { key: "editor", label: "Szenario-Editor", icon: Layers },
  { key: "ergebnis", label: "Ergebnis", icon: BarChart3 },
  { key: "prio", label: "Priorisierung", icon: ListChecks },
  { key: "vergleich", label: "Szenarienvergleich", icon: TrendingUp },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// ─── Seite ──────────────────────────────────────────────────────────────────
export default function ObjektOptimierungPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<TabKey>("editor");
  const [property, setProperty] = useState<Property | null>(null);
  const [typen, setTypen] = useState<MassnahmeTyp[]>([]);
  const [massnahmen, setMassnahmen] = useState<Massnahme[]>([]);
  const [flaechen, setFlaechen] = useState<Potenzialflaeche[]>([]);
  const [mietvertraege, setMietvertraege] = useState<Mietvertrag[]>([]);
  const [vergleich, setVergleich] = useState<Vergleich | null>(null);
  const [prio, setPrio] = useState<Priorisierung | null>(null);
  const [documents, setDocuments] = useState<Dokument[]>([]);
  const [szenarien, setSzenarien] = useState<Szenario[]>([]);
  const [aktivSzenario, setAktivSzenario] = useState<Szenario | null>(null);
  const [szenarioName, setSzenarioName] = useState("Neues Szenario");
  const [saving, setSaving] = useState(false);
  const [showSzenarien, setShowSzenarien] = useState(false);
  const szenarioDropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const reloadMassnahmen = useCallback(async () => {
    const res = await fetch(`/api/optimization/massnahmen?property_id=${id}`);
    if (res.ok) setMassnahmen(await res.json());
  }, [id]);
  const reloadProperty = useCallback(async () => {
    const res = await fetch(`/api/properties/${id}`);
    if (res.ok) setProperty(await res.json());
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [p, t, f, mv, d] = await Promise.all([
        fetch(`/api/properties/${id}`),
        fetch(`/api/optimization/massnahme-typen`),
        fetch(`/api/optimization/potenzialflaechen?property_id=${id}`),
        fetch(`/api/optimization/mietvertraege?property_id=${id}`),
        fetch(`/api/documents?property_id=${id}&limit=50`),
      ]);
      if (p.ok) setProperty(await p.json());
      if (t.ok) setTypen(await t.json());
      if (f.ok) setFlaechen(await f.json());
      if (mv.ok) setMietvertraege(await mv.json());
      if (d.ok) setDocuments(await d.json());
      // Gespeicherte Szenarien laden und letztes automatisch aktivieren
      const sr = await fetch(`/api/optimization/szenarien?property_id=${id}`);
      if (sr.ok) {
        const szListe: Szenario[] = await sr.json();
        setSzenarien(szListe);
        if (szListe.length > 0) {
          // Letztes Szenario (neuestes zuerst) automatisch setzen
          const letztes = szListe[0];
          setAktivSzenario(letztes);
          setSzenarioName(letztes.name);
          // Maßnahmen + Ergebnis + Prio des letzten Szenarios laden
          const [mRes, vg, pr] = await Promise.all([
            fetch(`/api/optimization/massnahmen?szenario_id=${letztes.id}`),
            fetch(`/api/optimization/szenarien/${letztes.id}/vergleich`),
            fetch(`/api/optimization/priorisierung?property_id=${id}&szenario_id=${letztes.id}`),
          ]);
          if (mRes.ok) setMassnahmen(await mRes.json());
          if (vg.ok) { const vgData = await vg.json(); if (vgData?.potenzial?.massnahmen?.length) { setVergleich(vgData); setTab("ergebnis"); } }
          if (pr.ok) { const prData = await pr.json(); if (prData?.rangliste?.length) setPrio(prData); }
        } else {
          await reloadMassnahmen();
        }
      } else {
        await reloadMassnahmen();
      }
      setLoading(false);
    })();
  }, [id, reloadMassnahmen]);

  // Szenario-Dropdown bei Klick außerhalb schließen (ref-basiert, wie SimpleCombobox)
  useEffect(() => {
    if (!showSzenarien) return;
    const close = (e: MouseEvent) => {
      if (szenarioDropdownRef.current && !szenarioDropdownRef.current.contains(e.target as Node)) {
        setShowSzenarien(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showSzenarien]);

  const reloadSzenarien = useCallback(async () => {
    const res = await fetch(`/api/optimization/szenarien?property_id=${id}`);
    if (res.ok) setSzenarien(await res.json());
  }, [id]);

  async function szenarioSpeichern() {
    if (!massnahmen.length) return;
    setSaving(true);
    try {
      // 1. Szenario anlegen / aktualisieren
      let szId: string;
      if (aktivSzenario) {
        const r = await fetch(`/api/optimization/szenarien?id=${aktivSzenario.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: szenarioName, massnahme_ids: massnahmen.map((m) => m.id) }),
        });
        if (!r.ok) return;
        szId = aktivSzenario.id;
      } else {
        const r = await fetch(`/api/optimization/szenarien`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property_id: id, name: szenarioName, massnahme_ids: massnahmen.map((m) => m.id) }),
        });
        if (!r.ok) return;
        const sz: Szenario = await r.json();
        szId = sz.id;
        setAktivSzenario(sz);
      }
      // 2. Engine ausführen → kennzahlen_snapshot persistieren
      await fetch(`/api/optimization/szenarien/${szId}/berechnen`, { method: "POST" });
      // 3. Ergebnis & Priorisierung laden und im State halten
      const [vg, pr] = await Promise.all([
        fetch(`/api/optimization/szenarien/${szId}/vergleich`),
        fetch(`/api/optimization/priorisierung?property_id=${id}&szenario_id=${szId}`),
      ]);
      if (vg.ok) setVergleich(await vg.json());
      if (pr.ok) setPrio(await pr.json());
      await Promise.all([reloadMassnahmen(), reloadSzenarien()]);
    } finally {
      setSaving(false);
    }
  }

  async function szenarioBerechnen() {
    if (!massnahmen.length) return;
    setComputing(true);
    try {
      // Szenario speichern (oder aktualisieren) und dann berechnen
      let szId = aktivSzenario?.id;
      if (!szId) {
        const r = await fetch(`/api/optimization/szenarien`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property_id: id, name: szenarioName, massnahme_ids: massnahmen.map((m) => m.id) }),
        });
        if (!r.ok) return;
        const sz: Szenario = await r.json();
        szId = sz.id;
        setAktivSzenario(sz);
        await reloadSzenarien();
      } else {
        await fetch(`/api/optimization/szenarien?id=${szId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: szenarioName, massnahme_ids: massnahmen.map((m) => m.id) }),
        });
      }
      await fetch(`/api/optimization/szenarien/${szId}/berechnen`, { method: "POST" });
      const vg = await fetch(`/api/optimization/szenarien/${szId}/vergleich`);
      if (vg.ok) { setVergleich(await vg.json()); setTab("ergebnis"); }
      const pr = await fetch(`/api/optimization/priorisierung?property_id=${id}&szenario_id=${szId}`);
      if (pr.ok) setPrio(await pr.json());
      await reloadMassnahmen();
    } finally {
      setComputing(false);
    }
  }

  async function szenarioLaden(sz: Szenario) {
    // Sofort State setzen — Name + aktives Szenario sichtbar machen
    setAktivSzenario(sz);
    setSzenarioName(sz.name);
    setShowSzenarien(false);
    setVergleich(null);
    setPrio(null);
    setTab("editor");

    // Daten parallel laden
    const [mRes, vg, pr] = await Promise.all([
      fetch(`/api/optimization/massnahmen?szenario_id=${sz.id}`),
      fetch(`/api/optimization/szenarien/${sz.id}/vergleich`),
      fetch(`/api/optimization/priorisierung?property_id=${id}&szenario_id=${sz.id}`),
    ]);

    if (mRes.ok) setMassnahmen(await mRes.json());

    if (vg.ok) {
      const vgData = await vg.json();
      // Nur setzen wenn echte Ergebnisdaten vorhanden (nicht nur leere Snapshots)
      if (vgData?.potenzial?.massnahmen?.length) {
        setVergleich(vgData);
        setTab("ergebnis");
      }
    }

    if (pr.ok) {
      const prData = await pr.json();
      if (prData?.rangliste?.length) setPrio(prData);
    }
  }

  function neuesSzenario() {
    setAktivSzenario(null);
    setSzenarioName("");
    setMassnahmen([]);
    setVergleich(null);
    setPrio(null);
    setTab("editor");
  }

  async function szenarioLoeschen(szId: string) {
    await fetch(`/api/optimization/szenarien?id=${szId}`, { method: "DELETE" });
    if (aktivSzenario?.id === szId) { setAktivSzenario(null); setSzenarioName("Neues Szenario"); }
    await reloadSzenarien();
  }

  if (loading)
    return <div className="flex items-center justify-center min-h-screen text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!property)
    return <div className="p-8 text-gray-500">Objekt nicht gefunden.</div>;

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto bg-slate-50 dark:bg-gray-950">
      <Link href="/immobilienoptimierung" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-4">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{property.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {property.city ?? "—"} · Objektfaktor {property.objektfaktor ?? 20}×
            {property.is_monument ? " · Denkmalschutz" : ""}
            {property.erhaltungssatzung ? " · Milieuschutz" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {/* Szenario-Name */}
          <input
            value={szenarioName}
            onChange={(e) => setSzenarioName(e.target.value)}
            placeholder="Szenario benennen…"
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-48"
          />

          {/* Gespeicherte Szenarien */}
          <div className="relative" ref={szenarioDropdownRef}>
            <button
              onClick={() => setShowSzenarien((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-indigo-400 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              {szenarien.length > 0 ? `${szenarien.length} gespeichert` : "Szenarien"}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showSzenarien && szenarien.length > 0 && (
              <div className="absolute right-0 top-full mt-1 z-30 w-80 rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 shadow-lg py-1">
                {szenarien.map((sz) => (
                  <div key={sz.id} className={`flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 ${aktivSzenario?.id === sz.id ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                    <button onClick={() => szenarioLaden(sz)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{sz.name}</p>
                      <p className="text-xs text-gray-400">{sz.szenario_massnahme.length} Maßnahmen · {new Date(sz.created_at).toLocaleDateString("de-DE")}</p>
                    </button>
                    <button onClick={() => szenarioLoeschen(sz.id)} className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0 ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Neues Szenario */}
          <button
            onClick={neuesSzenario}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-4 h-4" /> Neues Szenario
          </button>
          {/* Speichern & Berechnen */}
          <button
            onClick={szenarioSpeichern}
            disabled={saving || massnahmen.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Wird gespeichert…" : "Berechnen & Speichern"}
          </button>
        </div>
      </header>

      {/* Finanzierungsparameter */}
      <FinanzierungsPanel property={property} onSaved={reloadProperty} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "flaeche" && (
        <Flaechenkataster
          property={property} flaechen={flaechen} setFlaechen={setFlaechen}
          mietvertraege={mietvertraege} setMietvertraege={setMietvertraege} propertyId={id}
          onUnitsChanged={reloadProperty}
        />
      )}
      {tab === "ki" && (
        <KiErfassung
          propertyId={id} documents={documents}
          onApplied={reloadProperty}
          onAddFlaeche={(f) => setFlaechen([f, ...flaechen])}
          onDocumentsChanged={async () => {
            const res = await fetch(`/api/documents?property_id=${id}&limit=50`);
            if (res.ok) setDocuments(await res.json());
          }}
        />
      )}
      {tab === "editor" && (
        <Editor typen={typen} massnahmen={massnahmen} propertyId={id} propertyName={property.name} onChange={reloadMassnahmen} />
      )}
      {tab === "ergebnis" && <Ergebnis vergleich={vergleich} />}
      {tab === "prio" && <Prio prio={prio} />}
      {tab === "vergleich" && <SzenarienVergleich szenarien={szenarien} aktivId={aktivSzenario?.id} onLaden={szenarioLaden} />}
    </div>
  );
}

// ─── Finanzierungsparameter ───────────────────────────────────────────────────
function FinanzierungsPanel({ property, onSaved }: { property: Property; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({
    kaufpreis_eur:          property.kaufpreis_eur          != null ? String(property.kaufpreis_eur)          : "",
    erwerbsnebenkosten_eur: property.erwerbsnebenkosten_eur != null ? String(property.erwerbsnebenkosten_eur) : "",
    eingesetztes_ek_eur:    property.eingesetztes_ek_eur    != null ? String(property.eingesetztes_ek_eur)    : "",
    fremdkapital_eur:       property.fremdkapital_eur       != null ? String(property.fremdkapital_eur)       : "",
    fk_zins_pct:            property.fk_zins_pct            != null ? String(property.fk_zins_pct)            : "",
  });
  const [saving, setSaving] = useState(false);

  const fields: { key: keyof typeof vals; label: string; suffix: string; icon: React.ElementType }[] = [
    { key: "kaufpreis_eur",          label: "Kaufpreis",              suffix: "€",  icon: Landmark },
    { key: "erwerbsnebenkosten_eur", label: "Erwerbsnebenkosten",     suffix: "€",  icon: Wallet },
    { key: "eingesetztes_ek_eur",    label: "Eigenkapital",           suffix: "€",  icon: Wallet },
    { key: "fremdkapital_eur",       label: "Fremdkapital",           suffix: "€",  icon: Landmark },
    { key: "fk_zins_pct",            label: "FK-Zinssatz",            suffix: "%",  icon: Percent },
  ];

  const hasValues = fields.some((f) => vals[f.key] !== "");

  async function save() {
    setSaving(true);
    const body: Record<string, number | null> = {};
    for (const f of fields) body[f.key] = vals[f.key] ? Number(vals[f.key]) : null;
    await fetch(`/api/properties/${property.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    setOpen(false);
    onSaved();
  }

  return (
    <div className="mb-5 rounded-2xl bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-medium">
          <Landmark className="w-4 h-4 text-indigo-500" />
          Finanzierungsparameter
          {hasValues && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">gepflegt</span>}
        </span>
        <span className="text-xs text-gray-400">{open ? "Schließen" : "Kaufpreis, EK, FK-Zins …"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 mt-3 mb-4">
            Diese Werte fließen in Nettorendite, Bruttorendite und EK-Rendite ein. Sie werden pro Objekt gespeichert.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {fields.map(({ key, label, suffix, icon: Icon }) => (
              <div key={key}>
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Icon className="w-3 h-3" />{label}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={vals[key]}
                    onChange={(e) => setVals({ ...vals, [key]: e.target.value })}
                    placeholder="—"
                    className={`${inputCls} w-full pr-6`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saving} className={`${addBtnCls} mt-4`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Speichern
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Zulässigkeits-Badge ─────────────────────────────────────────────────────
function ZulBadge({ z }: { z: string }) {
  const map: Record<string, string> = {
    zulaessig: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    bedingt: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    gesperrt: "bg-red-500/15 text-red-600 dark:text-red-400",
  };
  const label: Record<string, string> = { zulaessig: "Zulässig", bedingt: "Bedingt", gesperrt: "Gesperrt" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[z] ?? ""}`}>{label[z] ?? z}</span>;
}

// ─── Generische Combobox (kleine Listen) ─────────────────────────────────────
function SimpleCombobox({ options, value, onChange, placeholder, className }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(v: string) { onChange(v); setOpen(false); setQuery(""); }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <input
        className={`${inputCls} w-full`}
        placeholder={placeholder ?? "Auswählen…"}
        value={open ? query : selected?.label ?? ""}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); const o = filtered[hi]; if (o) pick(o.value); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 shadow-lg py-1">
          {filtered.map((o, i) => (
            <li
              key={o.value}
              onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
              onMouseEnter={() => setHi(i)}
              className={`px-3 py-2 text-sm cursor-pointer truncate ${i === hi ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Tab: Flächenkataster ────────────────────────────────────────────────────
const FLAECHE_ARTEN: { value: string; label: string }[] = [
  { value: "dg_unausgebaut",      label: "DG unausgebaut" },
  { value: "souterrain",          label: "Souterrain" },
  { value: "giebel_werbung",      label: "Giebel-Werbefläche" },
  { value: "dachflaeche_pv",      label: "Dachfläche PV" },
  { value: "dachflaeche_antenne", label: "Dachfläche Antenne / Mobilfunk" },
  { value: "stellplatz",          label: "Stellplatz" },
  { value: "kellerlager",         label: "Kellerlager" },
  { value: "fahrradbox",          label: "Fahrradbox" },
  { value: "garten",              label: "Gartenparzelle" },
];

// Einheiten-Typen (units.type: apartment|commercial|parking|storage|other)
const UNIT_TYPES: { value: string; label: string }[] = [
  { value: "apartment", label: "Wohnen" },
  { value: "commercial", label: "Gewerbe" },
  { value: "parking", label: "Stellplätze / Mobilität" },
  { value: "storage", label: "Lager- / Abstellflächen" },
];
const UNIT_TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(UNIT_TYPES.map((t) => [t.value, t.label])),
  other: "Sonstige",
};

function Flaechenkataster({ property, flaechen, setFlaechen, mietvertraege, setMietvertraege, propertyId, onUnitsChanged }: {
  property: Property; flaechen: Potenzialflaeche[]; setFlaechen: (f: Potenzialflaeche[]) => void;
  mietvertraege: Mietvertrag[]; setMietvertraege: (m: Mietvertrag[]) => void; propertyId: string;
  onUnitsChanged: () => void;
}) {
  const [art, setArt] = useState(FLAECHE_ARTEN[0].value);
  const [flaeche, setFlaeche] = useState("");
  const [menge, setMenge] = useState("");
  const [unitId, setUnitId] = useState("");
  const [miete, setMiete] = useState("");
  const [newUnitNr, setNewUnitNr] = useState("");
  const [newUnitArea, setNewUnitArea] = useState("");
  const [newUnitType, setNewUnitType] = useState(UNIT_TYPES[0].value);
  const [savingUnit, setSavingUnit] = useState(false);

  // Dropdown-Auswahl gültig halten, wenn Einheiten (nach-)geladen werden.
  useEffect(() => {
    if (!unitId && property.units.length) setUnitId(property.units[0].id);
    if (unitId && !property.units.some((u) => u.id === unitId)) setUnitId(property.units[0]?.id ?? "");
  }, [property.units, unitId]);

  async function addFlaeche() {
    const res = await fetch(`/api/optimization/potenzialflaechen`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, art, flaeche_qm: flaeche ? Number(flaeche) : null, menge: menge ? Number(menge) : null }),
    });
    if (res.ok) { setFlaechen([await res.json(), ...flaechen]); setFlaeche(""); setMenge(""); }
  }
  async function delFlaeche(fid: string) {
    await fetch(`/api/optimization/potenzialflaechen?id=${fid}`, { method: "DELETE" });
    setFlaechen(flaechen.filter((f) => f.id !== fid));
  }
  async function addUnit() {
    if (!newUnitNr.trim()) return;
    setSavingUnit(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/units`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_number: newUnitNr.trim(), type: newUnitType, area: newUnitArea ? Number(newUnitArea) : null }),
      });
      if (res.ok) { setNewUnitNr(""); setNewUnitArea(""); setNewUnitType(UNIT_TYPES[0].value); onUnitsChanged(); }
    } finally { setSavingUnit(false); }
  }
  async function addMiete() {
    if (!unitId || !miete) return;
    const res = await fetch(`/api/optimization/mietvertraege`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit_id: unitId, kaltmiete_eur: Number(miete) }),
    });
    if (res.ok) { setMietvertraege([await res.json(), ...mietvertraege]); setMiete(""); }
  }

  const hatEinheiten = property.units.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ist-Einheiten */}
      <Card title="Ist-Einheiten">
        {/* Rent-Roll: alle Einheiten mit Miete + Jahressumme */}
        {!hatEinheiten ? (
          <p className="text-sm text-gray-400 dark:text-gray-600 mb-3">
            Für dieses Objekt sind noch keine Einheiten hinterlegt. Lege unten eine an, um Kaltmieten zu erfassen.
          </p>
        ) : (() => {
          const jahresmiete = property.units.reduce((s, u) => {
            const mv = mietvertraege.find((m) => m.unit_id === u.id);
            return s + (mv && !mv.leerstand ? mv.kaltmiete_eur * 12 : 0);
          }, 0);
          return (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {property.units.map((u) => {
                  const mv = mietvertraege.find((m) => m.unit_id === u.id);
                  return (
                    <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{u.unit_number}</span>
                        <span className="text-gray-400 dark:text-gray-500 ml-1.5">{UNIT_TYPE_LABEL[u.type] ?? u.type}</span>
                      </div>
                      <span className={mv ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-600"}>
                        {mv ? eur(mv.kaltmiete_eur) + " /Mo." : "0 € /Mo."}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 text-sm font-medium">
                <span className="text-gray-500 dark:text-gray-400">Jahres-Kaltmiete</span>
                <span className="text-gray-900 dark:text-white">{eur(jahresmiete)}</span>
              </div>
            </>
          );
        })()}

        {/* Einheit anlegen */}
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-white-800">
          <p className="text-xs font-medium text-gray-500 mb-2">Einheit anlegen</p>
          <SimpleCombobox options={UNIT_TYPES} value={newUnitType} onChange={setNewUnitType} placeholder="Einheitentyp wählen…" className="mb-2" />
          <div className="flex gap-2">
            <input placeholder="Nr. (z.B. W01)" value={newUnitNr} onChange={(e) => setNewUnitNr(e.target.value)} className={`${inputCls} flex-1`} />
            <input type="number" placeholder="m²" value={newUnitArea} onChange={(e) => setNewUnitArea(e.target.value)} className={`${inputCls} w-24`} />
            <button onClick={addUnit} disabled={savingUnit || !newUnitNr.trim()} className={addBtnCls}>
              {savingUnit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Kaltmiete erfassen */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-medium text-gray-500 mb-2">Kaltmiete erfassen</p>
          {!hatEinheiten ? (
            <p className="text-xs text-gray-400">Erst eine Einheit anlegen.</p>
          ) : (
            <div className="flex gap-2">
              <SimpleCombobox
                options={property.units.map((u) => ({ value: u.id, label: `${u.unit_number} · ${UNIT_TYPE_LABEL[u.type] ?? u.type}` }))}
                value={unitId} onChange={setUnitId} placeholder="Einheit wählen…" className="flex-1"
              />
              <input type="number" placeholder="€/Monat" value={miete} onChange={(e) => setMiete(e.target.value)} className={inputCls} />
              <button onClick={addMiete} disabled={!unitId || !miete} className={addBtnCls}><Plus className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </Card>

      {/* Sonstige Flächen */}
      <Card title="Sonstige Flächen">
        <div className="flex gap-2 mb-3">
          <SimpleCombobox options={FLAECHE_ARTEN} value={art} onChange={setArt} placeholder="Flächenart wählen…" className="flex-1" />
          <input type="number" placeholder="m²" value={flaeche} onChange={(e) => setFlaeche(e.target.value)} className={`${inputCls} w-20`} />
          <input type="number" placeholder="Menge" value={menge} onChange={(e) => setMenge(e.target.value)} className={`${inputCls} w-20`} />
          <button onClick={addFlaeche} className={addBtnCls}><Plus className="w-4 h-4" /></button>
        </div>
        {flaechen.length === 0 ? <Empty>Noch keine Sonstige Flächen.</Empty> : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {flaechen.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-800 dark:text-gray-200">{f.art}{f.flaeche_qm ? ` · ${f.flaeche_qm} m²` : ""}{f.menge ? ` · ${f.menge}×` : ""}</span>
                <button onClick={() => delFlaeche(f.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─── Durchsuchbare Combobox für Maßnahmentypen ───────────────────────────────
function MassnahmeCombobox({ typen, value, onChange }: {
  typen: MassnahmeTyp[]; value: string; onChange: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = typen.find((t) => t.code === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return typen;
    return typen.filter((t) => `${t.label} ${t.code} ${t.kategorie} ${t.klasse}`.toLowerCase().includes(q));
  }, [typen, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(code: string) { onChange(code); setOpen(false); setQuery(""); }

  return (
    <div ref={ref} className="relative mb-3">
      <input
        className={`${inputCls} w-full`}
        placeholder="Maßnahmentyp suchen…"
        value={open ? query : selected ? `${selected.label} · ${selected.kategorie}` : ""}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); const t = filtered[highlight]; if (t) pick(t.code); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 shadow-lg py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Kein Treffer</li>
          ) : filtered.map((t, i) => (
            <li
              key={t.code}
              onMouseDown={(e) => { e.preventDefault(); pick(t.code); }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 ${
                i === highlight ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"
              }`}
            >
              <span className="truncate">{t.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex-shrink-0">{t.kategorie}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Parameter-Beschriftung & Icons ──────────────────────────────────────────
const PARAM_META: Record<string, { label: string; icon: React.ElementType }> = {
  zielmiete_eur_qm: { label: "Zielmiete €/m²", icon: Target },
  ist_miete_pa_eur: { label: "Ist-Miete €/Jahr", icon: Euro },
  index_pct: { label: "Indexierung %", icon: Percent },
  steigerung_pa_eur: { label: "Steigerung €/Jahr", icon: Euro },
  staffeln: { label: "Staffeln", icon: ListOrdered },
  zielklientel: { label: "Zielklientel", icon: Users },
  capex_eur: { label: "CapEx €", icon: Wallet },
  umlage_pct: { label: "Umlage %", icon: Percent },
  wohnflaeche_qm: { label: "Wohnfläche m²", icon: Ruler },
  ausgangsmiete_eur_qm: { label: "Ausgangsmiete €/m²", icon: Euro },
  vergleichsmiete_eur_qm: { label: "Vergleichsmiete €/m²", icon: Euro },
  ist_miete_eur_qm: { label: "Ist-Miete €/m²", icon: Euro },
  menge: { label: "Menge", icon: Hash },
  miete_pm_eur: { label: "Miete €/Monat", icon: Euro },
  invest_eur: { label: "Investition €", icon: Wallet },
  miete_pa_eur: { label: "Miete €/Jahr", icon: Euro },
  pacht_pa_eur: { label: "Pacht €/Jahr", icon: Euro },
  kwp: { label: "Leistung kWp", icon: Zap },
  ertrag_pa_eur: { label: "Ertrag €/Jahr", icon: Euro },
  neue_flaeche_qm: { label: "Neue Fläche m²", icon: Ruler },
  baukosten_qm_eur: { label: "Baukosten €/m²", icon: Wallet },
  aus_einheit: { label: "Aus Einheit", icon: Home },
  neue_einheiten: { label: "Neue Einheiten", icon: Hash },
  zusatzmiete_pa_eur: { label: "Zusatzmiete €/Jahr", icon: Euro },
  kosten_eur: { label: "Kosten €", icon: Wallet },
  flaeche_qm: { label: "Fläche m²", icon: Ruler },
  neues_baufeld_qm: { label: "Neues Baufeld m²", icon: Ruler },
  global_faktor: { label: "Globalfaktor", icon: Calculator },
  einzel_faktor: { label: "Einzelfaktor", icon: Calculator },
  paket_faktor: { label: "Paketfaktor", icon: Calculator },
  splitkosten_eur: { label: "Splitkosten €", icon: Wallet },
  einsparung_pa_eur: { label: "Einsparung €/Jahr", icon: Euro },
  darlehen_eur: { label: "Darlehen €", icon: Landmark },
  alt_zins_pct: { label: "Alter Zins %", icon: Percent },
  neu_zins_pct: { label: "Neuer Zins %", icon: Percent },
  paket_id: { label: "Paket-ID", icon: Package },
  objekte: { label: "Objekte", icon: Building2 },
};

function prettify(k: string): string {
  const s = k
    .replace(/_eur_qm$/, " €/m²")
    .replace(/_pa_eur$/, " €/Jahr")
    .replace(/_pm_eur$/, " €/Monat")
    .replace(/_qm$/, " m²")
    .replace(/_pct$/, " %")
    .replace(/_eur$/, " €")
    .replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function paramMeta(k: string): { label: string; Icon: React.ElementType } {
  const m = PARAM_META[k];
  return m ? { label: m.label, Icon: m.icon } : { label: prettify(k), Icon: Tag };
}

// ─── Planungs-Modal ──────────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "assistant"; content: string };
type Kennzahlen = {
  invest_eur?: number; ertragswirkung_pa_eur?: number;
  mietausfall_pa_eur?: number; dauer_monate?: number; notizen?: string;
};

function PlanungsModal({ vorschlag, propertyId, propertyName, typen, onClose, onSaved }: {
  vorschlag: Vorschlag; propertyId: string; propertyName: string;
  typen: MassnahmeTyp[]; onClose: () => void; onSaved: () => void;
}) {
  const label = typen.find((t) => t.code === vorschlag.typ_code)?.label ?? vorschlag.typ_code;
  const kontext = { label, begruendung: vorschlag.begruendung, property_name: propertyName };

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: `Ich helfe dir, die Maßnahme **${label}** wirtschaftlich durchzuplanen.\n\nLass uns die vier Kerngrössen klären:\n1. **Investitionskosten** (einmalig, €)\n2. **Laufender Mehrertrag p.a.** nach Umsetzung (€)\n3. **Mietausfall/Ertragsausfall** während der Bauphase (€)\n4. **Umsetzungsdauer** (Monate)\n\nWomit möchtest du anfangen? Hast du bereits erste Kostenschätzungen?` },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [kennzahlen, setKennzahlen] = useState<Kennzahlen | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    let buf = "";
    try {
      const res = await fetch("/api/optimization/planung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, kontext }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data:")) continue;
          const d = line.slice(5).trim();
          if (d === "[DONE]") break;
          try { buf += JSON.parse(d).text ?? ""; } catch { /* skip */ }
        }
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: buf };
          return copy;
        });
      }
    } finally { setStreaming(false); }
  }

  async function extrahieren() {
    setExtracting(true);
    try {
      const res = await fetch("/api/optimization/planung", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, kontext }),
      });
      if (res.ok) setKennzahlen(await res.json());
    } finally { setExtracting(false); }
  }

  async function speichern() {
    setSaving(true);
    try {
      // Maßnahme anlegen (mit params aus Kennzahlen)
      const params: Record<string, number> = {};
      if (kennzahlen?.invest_eur) params.invest_eur = kennzahlen.invest_eur;
      if (kennzahlen?.ertragswirkung_pa_eur) params.ertragswirkung_pa_eur = kennzahlen.ertragswirkung_pa_eur;
      if (kennzahlen?.mietausfall_pa_eur) params.mietausfall_pa_eur = kennzahlen.mietausfall_pa_eur;
      if (kennzahlen?.dauer_monate) params.dauer_monate = kennzahlen.dauer_monate;

      const r1 = await fetch("/api/optimization/massnahmen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, typ_code: vorschlag.typ_code, params }),
      });
      if (!r1.ok) return;
      const m = await r1.json();

      // Kennzahlen direkt in die berechneten Felder schreiben
      await fetch(`/api/optimization/massnahmen?id=${m.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invest_eur: kennzahlen?.invest_eur ?? null,
          ertragswirkung_pa_eur: kennzahlen?.ertragswirkung_pa_eur ?? null,
          params: { ...params, notizen: kennzahlen?.notizen ?? "" },
        }),
      });

      setSaved(true);
      onSaved();
      setTimeout(onClose, 800);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl h-full flex flex-col bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{label} — Im Detail planen</h2>
            <p className="text-xs text-gray-500 mt-0.5">{propertyName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                m.role === "user" ? "bg-indigo-500 text-white" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              }`}>
                {m.role === "user" ? "Du" : "KI"}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-indigo-500 text-white rounded-tr-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm"
              }`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {m.content || (streaming && i === messages.length - 1 ? <span className="animate-pulse">…</span> : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Kennzahlen-Ergebnis */}
        {kennzahlen && (
          <div className="mx-5 mb-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-3 flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5" /> Besprochene Kennzahlen
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
              {kennzahlen.invest_eur != null && (
                <div><span className="text-xs text-gray-500">Investition</span><p className="font-medium text-gray-900 dark:text-white">{eur(kennzahlen.invest_eur)}</p></div>
              )}
              {kennzahlen.ertragswirkung_pa_eur != null && (
                <div><span className="text-xs text-gray-500">Mehrertrag p.a.</span><p className="font-medium text-gray-900 dark:text-white">{eur(kennzahlen.ertragswirkung_pa_eur)}</p></div>
              )}
              {kennzahlen.mietausfall_pa_eur != null && (
                <div><span className="text-xs text-gray-500">Mietausfall Bauphase p.a.</span><p className="font-medium text-gray-900 dark:text-white">{eur(kennzahlen.mietausfall_pa_eur)}</p></div>
              )}
              {kennzahlen.dauer_monate != null && (
                <div><span className="text-xs text-gray-500">Dauer</span><p className="font-medium text-gray-900 dark:text-white">{kennzahlen.dauer_monate} Monate</p></div>
              )}
            </div>
            {kennzahlen.notizen && <p className="text-xs text-gray-500 italic border-t border-indigo-200 dark:border-indigo-800 pt-2">{kennzahlen.notizen}</p>}
            <button onClick={speichern} disabled={saving || saved} className={addBtnCls + " w-full justify-center mt-3"}>
              {saved ? <><Check className="w-4 h-4" /> Gespeichert & hinzugefügt</>
                : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gespeichert…</>
                : <><Plus className="w-4 h-4" /> Zum Szenario hinzufügen & speichern</>}
            </button>
          </div>
        )}

        {/* Input */}
        <div className="px-5 pb-5 border-t border-gray-200 dark:border-gray-800 pt-3">
          {!kennzahlen && (
            <button onClick={extrahieren} disabled={extracting || messages.length < 3} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mb-2 inline-flex items-center gap-1 disabled:opacity-40">
              {extracting ? <><Loader2 className="w-3 h-3 animate-spin" /> Kennzahlen werden extrahiert…</> : <><ClipboardCheck className="w-3 h-3" /> Kennzahlen aus Gespräch festhalten</>}
            </button>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Nachricht eingeben… (Enter zum Senden)"
              className={inputCls + " flex-1"}
              disabled={streaming}
            />
            <button onClick={send} disabled={streaming || !input.trim()} className={addBtnCls}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Maßnahmen-Edit-Modal ────────────────────────────────────────────────────
function MassnahmeEditModal({ m, typen, onClose, onSaved }: {
  m: Massnahme; typen: MassnahmeTyp[]; onClose: () => void; onSaved: () => void;
}) {
  const typ = typen.find((t) => t.code === m.typ_code);
  const schema = typ?.param_schema ?? {};
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(m.params ?? {}).map(([k, v]) => [k, String(v)]))
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const numericParams: Record<string, number> = {};
    for (const k of Object.keys(schema)) if (params[k]) numericParams[k] = Number(params[k]);
    await fetch(`/api/optimization/massnahmen?id=${m.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: numericParams }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {typ?.label ?? m.typ_code} bearbeiten
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Typ-spezifische Parameter */}
          {Object.keys(schema).length > 0 && (
            <div className="space-y-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500">Maßnahmen-Parameter</p>
              {Object.keys(schema).map((k) => {
                const { label, Icon } = paramMeta(k);
                return (
                  <div key={k} className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-44 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{label}</span>
                    </label>
                    <input type="number" value={params[k] ?? ""} onChange={(e) => setParams({ ...params, [k]: e.target.value })} className={`${inputCls} flex-1`} />
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(schema).length === 0 && (
            <p className="text-xs text-gray-400 py-2">
              Keine Parameter für diesen Maßnahmentyp. Die Kennzahlen werden beim nächsten „Szenario berechnen" aus dem Objekt abgeleitet.
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Abbrechen
          </button>
          <button onClick={save} disabled={saving} className={addBtnCls + " flex-1 justify-center"}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI-Zelle: Label oben, Icon+Wert unten ──────────────────────────────────
const kpiColors: Record<string, string> = {
  amber:   "text-amber-700 dark:text-amber-400",
  emerald: "text-emerald-700 dark:text-emerald-400",
  indigo:  "text-indigo-600 dark:text-indigo-400",
  default: "text-gray-600 dark:text-gray-400",
};
function KpiCell({ icon, label, value, color = "default" }: {
  icon: React.ReactNode; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[70px]">
      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-none">{label}</span>
      <span className={`inline-flex items-center gap-1 font-medium leading-none ${kpiColors[color] ?? kpiColors.default}`}>
        {icon}{value}
      </span>
    </div>
  );
}

// ─── KPI-Extraktoren aus Maßnahmen-Params ────────────────────────────────────
// Liest aus den bereits eingetragenen Parametern die drei Kern-KPIs heraus.
// Fallback-Kaskade: mehrere mögliche Schlüssel je Maßnahmentyp.
function kpiMenge(m: Massnahme): number | null {
  const p = m.params ?? {};
  return p.menge ?? null;
}
function kpiInvest(m: Massnahme): number | null {
  const p = m.params ?? {};
  // direkt eingetragenes invest_eur oder capex_eur aus den Maßnahmen-Params
  return p.invest_eur ?? p.capex_eur ?? m.invest_eur ?? null;
}
function kpiMiete(m: Massnahme): number | null {
  const p = m.params ?? {};
  // miete_pm_eur ist bereits monatlich; miete_pa_eur und pacht_pa_eur auf Monat umrechnen
  if (p.miete_pm_eur != null) return p.miete_pm_eur;
  if (p.miete_pa_eur != null) return Math.round(p.miete_pa_eur / 12);
  if (p.pacht_pa_eur != null) return Math.round(p.pacht_pa_eur / 12);
  if (p.ertrag_pa_eur != null) return Math.round(p.ertrag_pa_eur / 12);
  // nach Szenario-Berechnung: ertragswirkung_pa_eur als Fallback
  if (m.ertragswirkung_pa_eur != null) return Math.round(m.ertragswirkung_pa_eur / 12);
  return null;
}

// ─── Tab: Szenario-Editor ────────────────────────────────────────────────────
function Editor({ typen, massnahmen, propertyId, propertyName, onChange }: {
  typen: MassnahmeTyp[]; massnahmen: Massnahme[]; propertyId: string; propertyName: string; onChange: () => void;
}) {
  const [code, setCode] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[] | null>(null);
  const [loadingV, setLoadingV] = useState(false);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [planungFor, setPlanungFor] = useState<Vorschlag | null>(null);
  const [editFor, setEditFor] = useState<Massnahme | null>(null);
  const typ = typen.find((t) => t.code === code);
  const schema = typ?.param_schema ?? {};

  async function add() {
    if (!code) return;
    setSaving(true);
    const numericParams: Record<string, number> = {};
    for (const k of Object.keys(schema)) if (params[k]) numericParams[k] = Number(params[k]);
    const res = await fetch(`/api/optimization/massnahmen`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, typ_code: code, params: numericParams }),
    });
    setSaving(false);
    if (res.ok) { setParams({}); setCode(""); onChange(); }
  }
  async function del(mid: string) {
    await fetch(`/api/optimization/massnahmen?id=${mid}`, { method: "DELETE" });
    onChange();
  }
  async function vorschlaegeLaden() {
    setLoadingV(true);
    try {
      const res = await fetch(`/api/optimization/vorschlaege?property_id=${propertyId}`);
      if (res.ok) setVorschlaege((await res.json()).vorschlaege ?? []);
    } finally { setLoadingV(false); }
  }
  async function vorschlagHinzufuegen(v: Vorschlag) {
    setAddingCode(v.typ_code);
    try {
      const res = await fetch(`/api/optimization/massnahmen`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, typ_code: v.typ_code, params: {} }),
      });
      if (res.ok) { setAddedCodes((prev) => new Set(prev).add(v.typ_code)); onChange(); }
    } finally { setAddingCode(null); }
  }
  const labelOf = (code: string) => typen.find((t) => t.code === code)?.label ?? code;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manuelle Maßnahme */}
        <Card title="Maßnahme hinzufügen">
          <MassnahmeCombobox typen={typen} value={code} onChange={(c) => { setCode(c); setParams({}); }} />
          {typ && (
            <>
              <div className="space-y-2 mb-3">
                {Object.keys(schema).length === 0 ? (
                  <p className="text-xs text-gray-400">Keine Parameter.</p>
                ) : Object.keys(schema).map((k) => {
                  const { label, Icon } = paramMeta(k);
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-44 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </label>
                      <input type="number" value={params[k] ?? ""} onChange={(e) => setParams({ ...params, [k]: e.target.value })} className={`${inputCls} flex-1`} />
                    </div>
                  );
                })}
              </div>
              {typ.constraint_codes && typ.constraint_codes.length > 0 && (
                <p className="text-[11px] text-gray-400 mb-3">Regeln: {typ.constraint_codes.join(", ")}</p>
              )}
              <button onClick={add} disabled={saving} className={addBtnCls + " w-full justify-center"}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Hinzufügen
              </button>
            </>
          )}
        </Card>

        {/* Gestapelte Maßnahmen */}
        <Card title={`Gestapelte Maßnahmen (${massnahmen.length})`}>
          {massnahmen.length === 0 ? <Empty>Noch keine Maßnahmen. „Szenario berechnen" nach dem Hinzufügen.</Empty> : (() => {
            // Summenwerte für die Fußzeile
            const totalInvest = massnahmen.reduce((s, m) => s + (kpiInvest(m) ?? 0), 0);
            const totalMiete  = massnahmen.reduce((s, m) => s + (kpiMiete(m) ?? 0), 0);
            return (
              <>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {massnahmen.map((m) => {
                    const amortMonate = m.amortisation_jahre != null ? Math.round(m.amortisation_jahre * 12) : null;
                    const menge  = kpiMenge(m);
                    const invest = kpiInvest(m);
                    const miete  = kpiMiete(m);
                    const hatInputs    = menge != null || invest != null || miete != null;
                    const hatOutputs   = m.werthebel_eur != null || m.ertragswirkung_pa_eur != null || amortMonate != null;
                    return (
                      <li key={m.id} className="py-3 space-y-2">
                        {/* Zeile 1: Name + Zulässigkeit + Aktionen */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.massnahme_typ?.label ?? m.typ_code}</p>
                            <p className="text-[11px] text-gray-400">{m.massnahme_typ?.klasse === "quick_win" ? "Quick Win" : m.massnahme_typ?.klasse}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {m.zulaessigkeit && <ZulBadge z={m.zulaessigkeit} />}
                            <button onClick={() => setEditFor(m)} title="Bearbeiten" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => del(m.id)} title="Entfernen" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Zeile 2: KPI-Raster — Inputs | Outputs */}
                        {(hatInputs || hatOutputs) && (
                          <div className="flex gap-3 text-[11px]">
                            {/* Input-KPIs */}
                            {hatInputs && (
                              <div className="flex gap-3 items-stretch">
                                {menge != null && <KpiCell icon={<Hash className="w-3 h-3" />} label="Menge" value={String(menge)} />}
                                {invest != null && <KpiCell icon={<Wallet className="w-3 h-3" />} label="Investition" value={eur(invest)} color="amber" />}
                                {miete  != null && <KpiCell icon={<Euro  className="w-3 h-3" />} label="Miete/Mo."  value={eur(miete)}  color="emerald" />}
                              </div>
                            )}
                            {/* Divider */}
                            {hatInputs && hatOutputs && <div className="w-px self-stretch bg-gray-200 dark:bg-gray-700 mx-1" />}
                            {/* Output-KPIs */}
                            {hatOutputs && (
                              <div className="flex gap-3 items-stretch">
                                {m.werthebel_eur       != null && <KpiCell icon={<TrendingUp className="w-3 h-3" />} label="Werterhöhung" value={eur(m.werthebel_eur)}           color="indigo" />}
                                {m.ertragswirkung_pa_eur != null && <KpiCell icon={<Euro className="w-3 h-3" />}       label="Ertrag p.a."  value={`+${eur(m.ertragswirkung_pa_eur)}`} color="emerald" />}
                                {amortMonate           != null && <KpiCell icon={<Calculator className="w-3 h-3" />}  label="Amortisation" value={`${amortMonate} Mo.`}             color="amber" />}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* Summenzeile */}
                {(totalInvest > 0 || totalMiete > 0) && (
                  <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 gap-4">
                    {totalInvest > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                        <Wallet className="w-3.5 h-3.5" /> Gesamt-Invest {eur(totalInvest)}
                      </span>
                    )}
                    {totalMiete > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        <Euro className="w-3.5 h-3.5" /> Miete gesamt {eur(totalMiete)} /Mo.
                      </span>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </Card>
      </div>

      {/* KI-Maßnahmenvorschläge */}
      <Card title="KI-Beratung">
        <button onClick={vorschlaegeLaden} disabled={loadingV} className={addBtnCls + " mb-4"}>
          {loadingV ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Vorschläge laden
        </button>
        {vorschlaege == null ? (
          <Empty>KI analysiert das Objektprofil und schlägt passende Hebel aus dem Katalog vor.</Empty>
        ) : vorschlaege.length === 0 ? (
          <Empty>Keine Vorschläge gefunden.</Empty>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vorschlaege.map((v) => {
              const isAdding = addingCode === v.typ_code;
              const isAdded  = addedCodes.has(v.typ_code);
              return (
                <li key={v.typ_code} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{labelOf(v.typ_code)}</p>
                    {v.prioritaet && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        v.prioritaet === "hoch" ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : v.prioritaet === "mittel" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}>{v.prioritaet}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">{v.begruendung}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      onClick={() => setPlanungFor(v)}
                      className="text-xs inline-flex items-center gap-1 font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Im Detail planen
                    </button>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <button
                      onClick={() => !isAdded && !isAdding && vorschlagHinzufuegen(v)}
                      disabled={isAdding || isAdded}
                      className={`text-xs inline-flex items-center gap-1 font-medium transition-colors ${
                        isAdded ? "text-emerald-600 dark:text-emerald-400 cursor-default"
                        : "text-indigo-600 dark:text-indigo-400 hover:underline"
                      }`}
                    >
                      {isAdding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Wird hinzugefügt…</>
                        : isAdded ? <><Check className="w-3.5 h-3.5" /> Hinzugefügt</>
                        : <><Plus className="w-3.5 h-3.5" /> Zum Szenario hinzufügen</>}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editFor && (
        <MassnahmeEditModal
          m={editFor} typen={typen}
          onClose={() => setEditFor(null)}
          onSaved={() => { setEditFor(null); onChange(); }}
        />
      )}

      {planungFor && (
        <PlanungsModal
          vorschlag={planungFor}
          propertyId={propertyId}
          propertyName={propertyName}
          typen={typen}
          onClose={() => setPlanungFor(null)}
          onSaved={() => { setAddedCodes((prev) => new Set(prev).add(planungFor.typ_code)); onChange(); }}
        />
      )}
    </div>
  );
}

// ─── Tab: Ergebnis ───────────────────────────────────────────────────────────
function Ergebnis({ vergleich }: { vergleich: Vergleich | null }) {
  if (!vergleich) return <Empty>Noch kein Ergebnis. Maßnahmen hinzufügen und „Szenario berechnen".</Empty>;
  const { ist, potenzial, waterfall } = vergleich;
  const kpis = [
    { label: "Nettobetriebsertrag p.a.", ist: eur(ist.noi_eur), neu: eur(potenzial.noi_eur), hint: null },
    { label: "Verkehrswert",    ist: eur(ist.verkehrswert_eur),  neu: eur(potenzial.verkehrswert_eur),  hint: null },
    { label: "Nettorendite",    ist: pct(ist.nettorendite),      neu: pct(potenzial.nettorendite),      hint: potenzial.nettorendite == null ? "Kaufpreis am Objekt erforderlich" : null },
    { label: "Bruttorendite",   ist: pct(ist.bruttorendite),     neu: pct(potenzial.bruttorendite),     hint: potenzial.bruttorendite == null ? "Kaufpreis am Objekt erforderlich" : null },
    { label: "EK-Rendite",      ist: pct(ist.ek_rendite),        neu: pct(potenzial.ek_rendite),        hint: potenzial.ek_rendite == null ? "Kaufpreis & Eigenkapital erforderlich" : null },
    { label: "Aufteilungsgewinn", ist: eur(0),                   neu: eur(potenzial.aufteilungsgewinn_eur), hint: null },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl p-4 bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-lg font-bold ${k.neu === "—" ? "text-gray-400" : "text-gray-900 dark:text-white"}`}>{k.neu}</p>
            <p className="text-xs text-gray-400">Ist: {k.ist}</p>
            {k.hint && k.neu === "—" && <p className="text-[10px] text-amber-500 mt-1">{k.hint}</p>}
          </div>
        ))}
      </div>

      <Card title="Werthebel (Ist → Potenzial)">
        <Waterfall steps={waterfall} />
      </Card>

      <Card title="Maßnahmen-Details">
        <div className="space-y-3">
          {potenzial.massnahmen.map((m) => (
            <div key={m.massnahme_id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.label ?? m.typ_code}</p>
                <ZulBadge z={m.zulaessigkeit} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                <span>Invest: {eur(m.invest_eur)}</span>
                <span>ΔErtrag p.a.: {eur(m.ertragswirkung_pa_eur)}</span>
                <span>Werthebel: {eur(m.werthebel_eur)}</span>
                <span>Amortisation: {m.amortisation_jahre != null ? `${m.amortisation_jahre.toFixed(1)} J` : "—"}</span>
              </div>
              {m.auflagen.length > 0 && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">⚠ {m.auflagen.join(" ")}</p>}
              {m.hinweise.length > 0 && <p className="text-[11px] text-gray-400 mt-0.5">{m.hinweise.join(" ")}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Waterfall({ steps }: { steps: WaterfallStep[] }) {
  if (!steps.length) return <Empty>Keine Daten.</Empty>;

  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.wert)), 1);

  // Laufende Summe für Offset der Delta-Balken vorberechnen.
  const rows: { step: WaterfallStep; offsetPct: number; widthPct: number; color: string; negative: boolean }[] = [];
  let cum = 0;
  for (const step of steps) {
    const pct = (Math.abs(step.wert) / maxAbs) * 100;
    if (step.typ === "basis") {
      cum = step.wert;
      rows.push({ step, offsetPct: 0, widthPct: pct, color: "bg-gray-400", negative: false });
    } else if (step.typ === "summe") {
      rows.push({ step, offsetPct: 0, widthPct: pct, color: "bg-indigo-500", negative: false });
    } else {
      const offset = (Math.min(cum, cum + step.wert) / maxAbs) * 100;
      cum += step.wert;
      const neg = step.wert < 0;
      rows.push({ step, offsetPct: Math.max(0, offset), widthPct: pct, color: neg ? "bg-red-400" : "bg-emerald-500", negative: neg });
    }
  }

  return (
    <div className="space-y-2">
      {rows.map(({ step, offsetPct, widthPct, color }, i) => (
        <div key={i} className="flex items-center gap-3 min-w-0">
          {/* Label */}
          <span className="text-xs text-gray-600 dark:text-gray-400 w-36 flex-shrink-0 text-right truncate" title={step.label}>
            {step.label}
          </span>
          {/* Balken-Track */}
          <div className="flex-1 relative h-7 flex items-center">
            <div
              className={`absolute h-5 rounded ${color} opacity-90`}
              style={{ left: `${offsetPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
            />
          </div>
          {/* Wert */}
          <span className={`text-xs font-medium w-28 flex-shrink-0 ${
            step.typ === "summe" ? "text-indigo-600 dark:text-indigo-400" :
            step.typ === "delta" && step.wert >= 0 ? "text-emerald-600 dark:text-emerald-400" :
            step.typ === "delta" ? "text-red-500" : "text-gray-500 dark:text-gray-400"
          }`}>
            {step.typ === "delta" && step.wert > 0 ? "+" : ""}{eur(step.wert)}
          </span>
        </div>
      ))}
      {/* Legende */}
      <div className="flex gap-4 pt-2 border-t border-gray-100 dark:border-gray-800 mt-1">
        {[
          { color: "bg-gray-400", label: "Ist" },
          { color: "bg-emerald-500", label: "Werterhöhung" },
          { color: "bg-red-400", label: "Wertminderung" },
          { color: "bg-indigo-500", label: "Potenzial" },
        ].map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className={`inline-block w-3 h-3 rounded-sm ${l.color} opacity-90`} />{l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Priorisierung ──────────────────────────────────────────────────────
function Prio({ prio }: { prio: Priorisierung | null }) {
  if (!prio) return <Empty>Noch keine Priorisierung. „Szenario berechnen" ausführen.</Empty>;
  // Nummer je massnahme_id aus der Rangliste
  const nummerMap = new Map(prio.rangliste.map((m, i) => [m.massnahme_id, i + 1]));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Rangliste (Quick Wins zuerst)">
          <ol className="space-y-2">
            {prio.rangliste.map((m, i) => (
              <li key={m.massnahme_id} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <span className="flex-1 truncate text-gray-800 dark:text-gray-200">{m.label ?? m.typ_code}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">{m.klasse === "quick_win" ? "QW" : m.klasse}</span>
                <span className="text-xs text-gray-500 w-24 text-right">{eur(m.werthebel_eur)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Aufwand-Wirkung-Matrix">
          <BubbleChart punkte={prio.matrix} nummerMap={nummerMap} />
        </Card>
      </div>
      {/* Legende */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400 px-1">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full bg-emerald-500/40 border border-emerald-500" /> Quick Win
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full bg-indigo-400/40 border border-indigo-400" /> CapEx
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-red-400" /> Gesperrt
        </span>
        <span className="text-gray-400">Kreisgröße = schnellere Amortisation · X-Achse = Investition · Y-Achse = Werthebel</span>
      </div>
    </div>
  );
}

function BubbleChart({ punkte, nummerMap }: { punkte: BubblePunkt[]; nummerMap: Map<string, number> }) {
  if (!punkte.length) return <Empty>Keine Daten.</Empty>;
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const W = 520, H = 340, padL = 48, padB = 40, padT = 20, padR = 20;
  const plotW = W - padL - padR;
  const plotH = H - padB - padT;

  const maxX = Math.max(...punkte.map((p) => p.x_invest), 1);
  const maxY = Math.max(...punkte.map((p) => p.y_werthebel), 1);
  const maxR = Math.max(...punkte.map((p) => p.groesse), 0.0001);

  const sx = (v: number) => padL + (v / maxX) * plotW;
  const sy = (v: number) => padT + plotH - (v / maxY) * plotH;
  const sr = (v: number) => 10 + (v / maxR) * 16;

  // Achsbeschriftungen
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: maxX * f, x: sx(maxX * f) }));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: maxY * f, y: sy(maxY * f) }));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Gitternetz */}
        {xTicks.map((t, i) => (
          <line key={i} x1={t.x} y1={padT} x2={t.x} y2={padT + plotH} stroke="#e5e7eb" strokeDasharray={i === 0 ? "0" : "3 3"} className="dark:stroke-gray-700" />
        ))}
        {yTicks.map((t, i) => (
          <line key={i} x1={padL} y1={t.y} x2={padL + plotW} y2={t.y} stroke="#e5e7eb" strokeDasharray={i === 0 ? "0" : "3 3"} className="dark:stroke-gray-700" />
        ))}
        {/* Achsbeschriftungen */}
        {xTicks.filter((_, i) => i > 0).map((t, i) => (
          <text key={i} x={t.x} y={padT + plotH + 16} textAnchor="middle" fontSize="9" className="fill-gray-400">{eur(t.v)}</text>
        ))}
        {yTicks.filter((_, i) => i > 0).map((t, i) => (
          <text key={i} x={padL - 6} y={t.y + 3} textAnchor="end" fontSize="9" className="fill-gray-400">{eur(t.v)}</text>
        ))}
        {/* Achstitel */}
        <text x={padL + plotW / 2} y={H - 4} textAnchor="middle" fontSize="10" className="fill-gray-400">Investition →</text>
        <text x={10} y={padT + plotH / 2} textAnchor="middle" fontSize="10" className="fill-gray-400" transform={`rotate(-90,10,${padT + plotH / 2})`}>Werthebel ↑</text>

        {/* Punkte */}
        {punkte.map((p) => {
          const cx = sx(p.x_invest);
          const cy = sy(p.y_werthebel);
          const r  = sr(p.groesse);
          const nr = nummerMap.get(p.massnahme_id) ?? "?";
          const qw = p.klasse === "quick_win";
          const gesperrt = p.zulaessigkeit === "gesperrt";
          return (
            <g
              key={p.massnahme_id}
              onMouseEnter={(e) => {
                const svg = (e.currentTarget.closest("svg") as SVGSVGElement).getBoundingClientRect();
                setTooltip({ x: cx / W * 100, y: cy / H * 100, text: `${nr}. ${p.label ?? p.massnahme_id}` });
              }}
              style={{ cursor: "default" }}
            >
              <circle
                cx={cx} cy={cy} r={r}
                fill={gesperrt ? "rgba(239,68,68,0.15)" : qw ? "rgba(16,185,129,0.35)" : "rgba(99,102,241,0.25)"}
                stroke={gesperrt ? "#ef4444" : qw ? "#10b981" : "#6366f1"}
                strokeWidth="1.5"
              />
              <text
                x={cx} y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={r > 16 ? "11" : "9"}
                fontWeight="700"
                className={gesperrt ? "fill-red-500" : qw ? "fill-emerald-700 dark:fill-emerald-400" : "fill-indigo-700 dark:fill-indigo-300"}
              >
                {nr}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs shadow-lg whitespace-nowrap"
          style={{ left: `${tooltip.x}%`, top: `${tooltip.y}%`, transform: "translate(-50%, -140%)" }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ─── Tab: KI-Erfassung ───────────────────────────────────────────────────────
function fileIcon(mime: string | null) {
  if (!mime) return <File className="w-4 h-4 text-gray-400" />;
  if (mime.startsWith("image/"))       return <FileImage className="w-4 h-4 text-indigo-400" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv"))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  if (mime === "application/pdf")      return <FileText className="w-4 h-4 text-red-400" />;
  return <FileText className="w-4 h-4 text-gray-400" />;
}
function fmtBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function KiErfassung({ propertyId, documents, onApplied, onAddFlaeche, onDocumentsChanged }: {
  propertyId: string; documents: Dokument[];
  onApplied: () => void; onAddFlaeche: (f: Potenzialflaeche) => void;
  onDocumentsChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [docId, setDocId] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extrakt, setExtrakt] = useState<Extrakt | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  async function extrahieren() {
    setExtracting(true); setError(""); setExtrakt(null); setApplied(false);
    try {
      const payload = docId ? { document_id: docId } : { text };
      const res = await fetch("/api/optimization/extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (res.ok) setExtrakt(j.daten); else setError(j.error ?? "Extraktion fehlgeschlagen");
    } finally { setExtracting(false); }
  }

  async function objektUebernehmen() {
    const o = extrakt?.objekt; if (!o) return;
    const u: Record<string, unknown> = {};
    if (o.objektfaktor != null) u.objektfaktor = o.objektfaktor;
    if (o.bodenrichtwert != null) u.bodenrichtwert = o.bodenrichtwert;
    if (o.denkmalschutz != null) u.is_monument = o.denkmalschutz;
    if (o.energieklasse) u.energy_class = o.energieklasse;
    if (o.wohnflaeche_qm != null) u.living_area = o.wohnflaeche_qm;
    if (o.grundstuecksflaeche_qm != null) u.plot_area = o.grundstuecksflaeche_qm;
    if (o.baujahr != null) u.year_built = o.baujahr;
    if (o.stadt) u.city = o.stadt;
    await fetch(`/api/properties/${propertyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u) });
    setApplied(true); onApplied();
  }

  async function flaecheUebernehmen(f: NonNullable<Extrakt["potenzialflaechen"]>[number]) {
    const res = await fetch("/api/optimization/potenzialflaechen", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, art: f.art ?? "sonstige", flaeche_qm: f.flaeche_qm ?? null, beschreibung: f.beschreibung ?? null }),
    });
    if (res.ok) onAddFlaeche(await res.json());
  }

  // Datei-Upload: Supabase Storage → documents-Tabelle
  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true); setUploadError("");
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Standard-Kategorie für Objekt-Dokumente holen
      const catRes = await fetch("/api/document-categories");
      const cats = catRes.ok ? await catRes.json() : [];
      const defaultCat = cats.find((c: { level: string; code: string }) => c.level === "property") ?? cats[0];
      if (!defaultCat) { setUploadError("Keine Dokumentkategorie gefunden."); return; }

      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "bin";
        const storagePath = `${propertyId}/property/${defaultCat.id}/${crypto.randomUUID()}.${ext}`;
        const { error: storageErr } = await supabase.storage.from("documents").upload(storagePath, file, { contentType: file.type });
        if (storageErr) { setUploadError(storageErr.message); continue; }
        await fetch("/api/documents", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category_id: defaultCat.id, level: "property", property_id: propertyId,
            title: file.name.replace(/\.[^.]+$/, ""),
            storage_path: storagePath, file_name: file.name,
            file_size: file.size, mime_type: file.type || null,
          }),
        });
      }
      onDocumentsChanged();
    } finally { setUploading(false); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }

  // Gruppe Dokumente nach Kategorie
  const grouped = useMemo(() => {
    const map = new Map<string, Dokument[]>();
    for (const d of documents) {
      const grp = d.document_categories?.name_de ?? "Sonstige";
      map.set(grp, [...(map.get(grp) ?? []), d]);
    }
    return map;
  }, [documents]);

  return (
    <div className="space-y-6">
      {/* ── Datenraum ── */}
      <Card title="Datenraum">
        {/* Drag & Drop + Cloud-Verbindung */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Drop-Zone */}
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 transition-colors cursor-pointer ${
              dragOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-gray-200 dark:border-gray-800 hover:border-indigo-400"
            }`}
            onClick={() => document.getElementById("ki-file-input")?.click()}
          >
            {uploading
              ? <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              : <UploadCloud className={`w-6 h-6 ${dragOver ? "text-indigo-500" : "text-gray-400"}`} />}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {uploading ? "Wird hochgeladen…" : "Dateien hierher ziehen oder klicken"}
            </p>
            <input id="ki-file-input" type="file" multiple className="hidden"
              onChange={(e) => { if (e.target.files) uploadFiles(Array.from(e.target.files)); e.target.value = ""; }}
            />
          </div>

          {/* Cloud-Verbindungen */}
          <div className="flex flex-col gap-2 min-w-[180px]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Datenraum verbinden</p>
            <button
              onClick={() => alert("Dropbox-OAuth noch nicht konfiguriert. DROPBOX_CLIENT_ID in .env.local setzen.")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 hover:border-indigo-400 transition-colors"
            >
              <Link2 className="w-4 h-4 text-[#0061FF]" />
              Dropbox verbinden
            </button>
            <button
              onClick={() => alert("Google Drive-OAuth noch nicht konfiguriert. GOOGLE_CLIENT_ID ist bereits gesetzt — Drive-Scope ergänzen.")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 hover:border-indigo-400 transition-colors"
            >
              <Link2 className="w-4 h-4 text-[#4285F4]" />
              Google Drive verbinden
            </button>
          </div>
        </div>
        {uploadError && <p className="text-xs text-red-500 mb-3">{uploadError}</p>}

        {/* Datei-Browser */}
        {documents.length === 0 ? (
          <Empty>Noch keine Dokumente. Dateien hochladen oder Datenraum verbinden.</Empty>
        ) : (
          <div className="space-y-3">
            {[...grouped.entries()].map(([grp, docs]) => (
              <div key={grp}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{grp}</p>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {docs.map((d) => (
                    <li key={d.id}
                      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${docId === d.id ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}
                      onClick={() => setDocId(docId === d.id ? "" : d.id)}
                    >
                      {fileIcon(d.mime_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{d.title || d.file_name}</p>
                        <p className="text-[10px] text-gray-400">{d.file_name}{d.file_size ? ` · ${fmtBytes(d.file_size)}` : ""}</p>
                      </div>
                      {docId === d.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex-shrink-0">ausgewählt</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── KI-Extraktion ── */}
      <Card title="KI-Extraktion">
        <p className="text-xs text-gray-400 mb-3">
          Dokument oben auswählen oder Text einfügen. Die KI extrahiert nur belegte Felder — rechnet nichts.
        </p>
        {!docId && (
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder="Text aus Exposé / Grundbuch / Energieausweis einfügen…"
            className={`${inputCls} w-full mb-3 resize-y`}
          />
        )}
        {docId && (
          <div className="flex items-center gap-2 mb-3 text-sm text-indigo-600 dark:text-indigo-400">
            <FileText className="w-4 h-4" />
            {documents.find((d) => d.id === docId)?.title ?? "Dokument ausgewählt"}
            <button onClick={() => setDocId("")} className="ml-auto text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <button onClick={extrahieren} disabled={extracting || (!text.trim() && !docId)} className={addBtnCls + " w-full justify-center"}>
          {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Extrahieren
        </button>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        {extrakt && (
          <div className="mt-4 space-y-3 text-sm">
            {extrakt.objekt && Object.keys(extrakt.objekt).length > 0 && (
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-800 dark:text-gray-200">Objektfelder</p>
                  <button onClick={objektUebernehmen} className="text-xs inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline">
                    {applied ? <><Check className="w-3.5 h-3.5" /> Übernommen</> : "Übernehmen"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                  {Object.entries(extrakt.objekt).map(([k, v]) => <span key={k}>{k}: <span className="text-gray-700 dark:text-gray-300">{String(v)}</span></span>)}
                </div>
              </div>
            )}
            {extrakt.einheiten && extrakt.einheiten.length > 0 && (
              <p className="text-xs text-gray-500">{extrakt.einheiten.length} Einheiten erkannt: {extrakt.einheiten.map((e) => e.bezeichnung).filter(Boolean).join(", ")}</p>
            )}
            {extrakt.mietvertraege && extrakt.mietvertraege.length > 0 && (
              <p className="text-xs text-gray-500">{extrakt.mietvertraege.length} Mietverträge erkannt (Zuordnung im Flächenkataster).</p>
            )}
            {extrakt.potenzialflaechen && extrakt.potenzialflaechen.length > 0 && (
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                <p className="font-medium text-gray-800 dark:text-gray-200 mb-2 text-sm">Erkannte Flächen</p>
                <ul className="space-y-1">
                  {extrakt.potenzialflaechen.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{f.art}{f.flaeche_qm ? ` · ${f.flaeche_qm} m²` : ""}</span>
                      <button onClick={() => flaecheUebernehmen(f)} className="text-indigo-600 dark:text-indigo-400 hover:underline">+ übernehmen</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extrakt.hinweise && extrakt.hinweise.length > 0 && (
              <ul className="list-disc pl-4 text-xs text-gray-500 space-y-0.5">{extrakt.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Tab: Szenarienvergleich ─────────────────────────────────────────────────
const VERGLEICH_KPIS: { key: keyof SzenarioSnapshot; label: string; fmt: (v: number | null) => string }[] = [
  { key: "noi_eur",             label: "Nettobetriebsertrag p.a.", fmt: eur },
  { key: "verkehrswert_eur",    label: "Verkehrswert",             fmt: eur },
  { key: "nettorendite",        label: "Nettorendite",             fmt: pct },
  { key: "bruttorendite",       label: "Bruttorendite",            fmt: pct },
  { key: "ek_rendite",          label: "EK-Rendite",               fmt: pct },
  { key: "aufteilungsgewinn_eur", label: "Aufteilungsgewinn",      fmt: eur },
];

// Feste Farben je Szenario-Index (konsistent zu Bubble-Vergleich)
const SZ_COLORS = [
  { fill: "rgba(99,102,241,0.25)",  stroke: "#6366f1", text: "#4338ca" },  // indigo
  { fill: "rgba(16,185,129,0.25)",  stroke: "#10b981", text: "#047857" },  // emerald
  { fill: "rgba(245,158,11,0.25)",  stroke: "#f59e0b", text: "#b45309" },  // amber
  { fill: "rgba(239,68,68,0.25)",   stroke: "#ef4444", text: "#b91c1c" },  // red
  { fill: "rgba(139,92,246,0.25)",  stroke: "#8b5cf6", text: "#6d28d9" },  // violet
];

function SzenarienMatrix({ punkte, aktivId, onLaden }: {
  punkte: { sz: Szenario; invest: number; noi: number | null }[];
  aktivId: string | undefined;
  onLaden: (sz: Szenario) => void;
}) {
  const W = 600, H = 300, padL = 70, padR = 20, padT = 20, padB = 50;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxX = Math.max(...punkte.map((p) => p.invest), 1);
  const maxY = Math.max(...punkte.map((p) => p.noi ?? 0), 1);
  // Achsenbeschriftungen
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxX * f);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);

  const sx = (v: number) => padL + (v / maxX) * plotW;
  const sy = (v: number) => padT + plotH - (v / maxY) * plotH;

  // Kurzform für €-Achsenbeschriftungen
  const fmtAx = (v: number) =>
    v === 0 ? "0" : v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : String(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Gitternetz */}
      {xTicks.map((v, i) => (
        <g key={i}>
          <line x1={sx(v)} y1={padT} x2={sx(v)} y2={padT + plotH}
            stroke="#e5e7eb" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={sx(v)} y={padT + plotH + 16} textAnchor="middle" fontSize="9" className="fill-gray-400">{fmtAx(v)}</text>
        </g>
      ))}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={sy(v)} x2={padL + plotW} y2={sy(v)}
            stroke="#e5e7eb" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={padL - 6} y={sy(v) + 3} textAnchor="end" fontSize="9" className="fill-gray-400">{fmtAx(v)}</text>
        </g>
      ))}

      {/* Achstitel */}
      <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-gray-400">
        Investitionskosten →
      </text>
      <text x={12} y={padT + plotH / 2} textAnchor="middle" fontSize="10" className="fill-gray-400"
        transform={`rotate(-90,12,${padT + plotH / 2})`}>
        NOI p.a. ↑
      </text>

      {/* Quadranten-Label: ideale Ecke */}
      <text x={padL + 6} y={padT + 14} fontSize="9" className="fill-emerald-500" opacity="0.6">
        Ideal (hoher NOI, geringer Invest)
      </text>

      {/* Punkte */}
      {punkte.map(({ sz, invest, noi }, i) => {
        if (noi == null) return null;
        const cx = sx(invest);
        const cy = sy(noi);
        const col = SZ_COLORS[i % SZ_COLORS.length];
        const isAktiv = sz.id === aktivId;
        // Kurzname (erster Teil vor " –")
        const shortName = sz.name.split("–")[0].trim();

        return (
          <g key={sz.id} onClick={() => onLaden(sz)} style={{ cursor: "pointer" }}>
            <circle cx={cx} cy={cy} r={isAktiv ? 20 : 16}
              fill={col.fill} stroke={col.stroke} strokeWidth={isAktiv ? 2.5 : 1.5} />
            {/* Szenario-Kurzname im Kreis */}
            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontWeight="700" fill={col.text}>
              {shortName}
            </text>
            {/* NOI-Wert als Tooltip-ähnliches Label oben */}
            <text x={cx} y={cy - 24} textAnchor="middle" fontSize="8" className="fill-gray-500">
              {fmtAx(noi)} €
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SzenarienVergleich({ szenarien, aktivId, onLaden }: {
  szenarien: Szenario[];
  aktivId: string | undefined;
  onLaden: (sz: Szenario) => void;
}) {
  if (szenarien.length === 0)
    return <Empty>Noch keine gespeicherten Szenarien. Maßnahmen stapeln und „Speichern & Berechnen" klicken.</Empty>;

  // Bestes Szenario je KPI ermitteln (für Hervorhebung)
  const bestOf = (key: keyof SzenarioSnapshot) => {
    let best: number | null = null;
    for (const sz of szenarien) {
      const snap = sz.kennzahlen_snapshot?.[0];
      const v = snap?.[key] as number | null | undefined;
      if (v != null && (best === null || v > best)) best = v;
    }
    return best;
  };
  const besten: Partial<Record<keyof SzenarioSnapshot, number | null>> = {};
  for (const kpi of VERGLEICH_KPIS) besten[kpi.key] = bestOf(kpi.key);

  // Punkte für die Matrix berechnen
  const matrixPunkte = szenarien.map((sz) => {
    const snap = sz.kennzahlen_snapshot?.[0];
    const invest = sz.szenario_massnahme.reduce((s, sm) => s + (sm.massnahme?.invest_eur ?? 0), 0);
    const noi    = snap?.noi_eur ?? null;
    return { sz, invest, noi };
  }).filter((p) => p.noi != null);

  return (
    <div className="space-y-6">
      {/* Aufwand-Wirkung-Matrix */}
      {matrixPunkte.length >= 2 && (
        <div className="rounded-2xl bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Aufwand-Wirkung-Matrix</h3>
          <p className="text-xs text-gray-400 mb-4">X-Achse: Investitionskosten · Y-Achse: Nettobetriebsertrag p.a.</p>
          <SzenarienMatrix punkte={matrixPunkte} aktivId={aktivId} onLaden={onLaden} />
        </div>
      )}

      {/* Tabelle */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-5 py-3 w-44">Kennzahl</th>
                {szenarien.map((sz) => {
                  const snap = sz.kennzahlen_snapshot?.[0];
                  const isAktiv = sz.id === aktivId;
                  return (
                    <th key={sz.id} className={`text-left px-4 py-3 min-w-[160px] ${isAktiv ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                      <button onClick={() => onLaden(sz)} className="text-left w-full group">
                        <p className={`text-xs font-semibold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${isAktiv ? "text-indigo-600 dark:text-indigo-400" : "text-gray-800 dark:text-gray-200"}`}>
                          {sz.name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-normal">
                          {sz.szenario_massnahme.length} Maßnahmen
                          {snap?.berechnet_am ? ` · ${new Date(snap.berechnet_am).toLocaleDateString("de-DE")}` : ""}
                        </p>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Investitionskosten (aus Maßnahmen summiert) — 0 gilt als kleinstes / bestes */}
              {(() => {
                const investSummen = szenarien.map((sz) =>
                  sz.szenario_massnahme.reduce((s, sm) => s + (sm.massnahme?.invest_eur ?? 0), 0)
                );
                const minInvest = Math.min(...investSummen); // 0 ist jetzt eingeschlossen
                return (
                  <tr className="border-b border-gray-50 dark:border-gray-800/60 bg-amber-50/40 dark:bg-amber-500/5">
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                      Investitionskosten gesamt
                    </td>
                    {szenarien.map((sz, i) => {
                      const v = investSummen[i];
                      const isMin = v === minInvest;
                      const isAktiv = sz.id === aktivId;
                      return (
                        <td key={sz.id} className={`px-4 py-3 ${isAktiv ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                          <span className={`font-medium ${
                            isMin ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                          }`}>
                            {v === 0 ? "0 €" : eur(v)}
                          </span>
                          {isMin && (
                            <span className="ml-1.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">MIN</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })()}
              {VERGLEICH_KPIS.map((kpi, ri) => (
                <tr key={kpi.key} className={`border-b border-gray-50 dark:border-gray-800/60 last:border-0 ${ri % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/20"}`}>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{kpi.label}</td>
                  {szenarien.map((sz) => {
                    const snap = sz.kennzahlen_snapshot?.[0];
                    const rawV = snap?.[kpi.key] as number | null | undefined;
                    const v = rawV ?? null;
                    const isBest = v != null && besten[kpi.key] != null && v === besten[kpi.key];
                    const isAktiv = sz.id === aktivId;
                    return (
                      <td key={sz.id} className={`px-4 py-3 ${isAktiv ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}>
                        <span className={`font-medium ${
                          v == null ? "text-gray-300 dark:text-gray-600" :
                          isBest ? "text-emerald-600 dark:text-emerald-400" :
                          "text-gray-800 dark:text-gray-200"
                        }`}>
                          {v == null ? "—" : kpi.fmt(v)}
                        </span>
                        {isBest && v != null && (
                          <span className="ml-1.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">BEST</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nicht-berechnete Szenarien */}
      {szenarien.some((sz) => !sz.kennzahlen_snapshot?.length) && (
        <p className="text-xs text-amber-600 dark:text-amber-400 px-1">
          Szenarien ohne Ergebnis wurden noch nicht berechnet. „Speichern & Berechnen" ausführen um sie in den Vergleich aufzunehmen.
        </p>
      )}
    </div>
  );
}

// ─── UI-Helfer ───────────────────────────────────────────────────────────────
const inputCls = "px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30";
const addBtnCls = "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-600">{children}</p>;
}
