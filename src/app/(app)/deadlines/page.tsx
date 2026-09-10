"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  List,
  AlertTriangle,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  Circle,
  User,
  Search,
  SlidersHorizontal,
  MapPin,
} from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface Deadline {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "frist" | "termin";
  az: string;
  completed: boolean;
  assigned_to: string;
  location: string;
}

interface FormState {
  title: string;
  type: "frist" | "termin";
  date: string;
  az: string;
  description: string;
  assigned_to: string;
  location: string;
}

type ViewMode = "calendar" | "list";

// ─── Konstanten ───────────────────────────────────────────────────────────────

const STAFF = [
  "Michael Müller",
  "Frau Lehmann",
  "Herr Becker",
  "Frau Hoffmann",
  "Herr Schneider",
];

const DAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const EMPTY_FORM: FormState = {
  title: "",
  type: "termin",
  date: new Date().toISOString().split("T")[0],
  az: "",
  description: "",
  location: "",
  assigned_to: "",
};

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function getDaysRemaining(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = i - offset + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });
}

// ─── Sub-Komponenten ──────────────────────────────────────────────────────────

function DaysRemainingBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">Verstrichen</span>;
  if (days === 0) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">Heute</span>;
  if (days === 1) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">Morgen</span>;
  if (days <= 3) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">{days}d</span>;
  if (days <= 7) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">{days}d</span>;
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">{days}d</span>;
}

function TypeBadge({ type }: { type: "frist" | "termin" }) {
  return type === "frist" ? (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/20 dark:text-red-300">Frist</span>
  ) : (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/20 dark:text-blue-300">Termin</span>
  );
}

// ─── Formular-Dialog ──────────────────────────────────────────────────────────

function DeadlineDialog({
  editing,
  onSave,
  onClose,
}: {
  editing: Deadline | null;
  onSave: (form: FormState) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          title: editing.title,
          type: editing.type,
          date: editing.date,
          az: editing.az,
          description: editing.description,
          assigned_to: editing.assigned_to,
          location: editing.location,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.az.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 text-sm rounded-lg border transition-colors " +
    "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 " +
    "dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {editing ? "Eintrag bearbeiten" : "Neuer Eintrag"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Typ */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-gray-500 dark:text-gray-400">Typ</label>
            <div className="flex gap-2">
              {(["termin", "frist"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.type === t
                      ? t === "frist"
                        ? "bg-red-500/15 border-red-400/40 text-red-600 dark:text-red-400"
                        : "bg-blue-500/15 border-blue-400/40 text-blue-600 dark:text-blue-400"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {t === "frist" ? "Frist" : "Termin"}
                </button>
              ))}
            </div>
          </div>

          {/* Titel */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
              Titel <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
              placeholder="z.B. Berufungsfrist Fischer ./. Krause"
              className={inputCls}
            />
          </div>

          {/* Datum */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
              Datum <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
              className={inputCls}
            />
          </div>

          {/* Aktenzeichen */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
              Aktenzeichen <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.az}
              onChange={(e) => set("az", e.target.value)}
              required
              placeholder="z.B. 124/26-GW"
              className={inputCls}
            />
          </div>

          {/* Mitarbeiter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
              Zuständig
            </label>
            <select
              value={form.assigned_to}
              onChange={(e) => set("assigned_to", e.target.value)}
              className={inputCls}
            >
              <option value="">— Nicht zugewiesen —</option>
              {STAFF.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Ort — nur bei Termin */}
          {form.type === "termin" && (
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">
                Ort
              </label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="z.B. AG München, Saal 204"
                  className={inputCls.replace("px-3", "pl-8 pr-3")}
                />
              </div>
            </div>
          )}

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Optionale Notizen..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.date || !form.az.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-opacity
                bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {saving ? "Speichert..." : editing ? "Speichern" : "Erstellen"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors
                border-gray-200 text-gray-600 hover:bg-gray-100
                dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function DeadlinesPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [showDialog, setShowDialog] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    type: "alle" as "alle" | "frist" | "termin",
    az: "",
    assignedTo: "",
    dateFrom: "",
    dateTo: "",
    showCompleted: false,
  });

  // ── Daten laden ──────────────────────────────────────────────────────────────

  const loadDeadlines = useCallback(async () => {
    const res = await fetch("/api/deadlines");
    if (!res.ok) return;
    setDeadlines(await res.json());
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadDeadlines();
      setLoading(false);
    }
    init();
  }, [loadDeadlines]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function handleSave(form: FormState) {
    if (editingDeadline) {
      await fetch(`/api/deadlines/${editingDeadline.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowDialog(false);
    setEditingDeadline(null);
    await loadDeadlines();
  }

  async function handleToggleComplete(d: Deadline) {
    setDeadlines((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, completed: !x.completed } : x))
    );
    await fetch(`/api/deadlines/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !d.completed }),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Eintrag endgültig löschen?")) return;
    setDeleting(id);
    await fetch(`/api/deadlines/${id}`, { method: "DELETE" });
    setDeadlines((prev) => prev.filter((d) => d.id !== id));
    setDeleting(null);
  }

  function openNew() {
    setEditingDeadline(null);
    setShowDialog(true);
  }

  function openEdit(d: Deadline) {
    setEditingDeadline(d);
    setShowDialog(true);
  }

  // ── Kalender ──────────────────────────────────────────────────────────────────

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
    setSelectedDay(null);
  }

  const cells = buildCalendarCells(calYear, calMonth);
  const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();

  function deadlinesForDay(day: number) {
    return deadlines.filter((d) => {
      const dt = new Date(d.date);
      return dt.getFullYear() === calYear && dt.getMonth() === calMonth && dt.getDate() === day;
    });
  }

  // ── Offene Einträge (Liste) ───────────────────────────────────────────────────

  const sorted = [...deadlines]
    .filter((d) => !d.completed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── Suchfilter ────────────────────────────────────────────────────────────────

  const hasAdvancedFilters =
    advancedFilters.type !== "alle" ||
    !!advancedFilters.az ||
    !!advancedFilters.assignedTo ||
    !!advancedFilters.dateFrom ||
    !!advancedFilters.dateTo ||
    advancedFilters.showCompleted;

  function matchesFilters(d: Deadline): boolean {
    if (!advancedFilters.showCompleted && d.completed) return false;
    if (advancedFilters.type !== "alle" && d.type !== advancedFilters.type) return false;
    if (advancedFilters.az && !d.az.toLowerCase().includes(advancedFilters.az.toLowerCase())) return false;
    if (advancedFilters.assignedTo && !d.assigned_to.toLowerCase().includes(advancedFilters.assignedTo.toLowerCase())) return false;
    if (advancedFilters.dateFrom && d.date < advancedFilters.dateFrom) return false;
    if (advancedFilters.dateTo && d.date > advancedFilters.dateTo) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !d.title.toLowerCase().includes(q) &&
        !d.description.toLowerCase().includes(q) &&
        !d.az.toLowerCase().includes(q) &&
        !d.assigned_to.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }

  // ── Nur Fristen von heute für den Warnhinweis ─────────────────────────────────

  const todayFristen = deadlines.filter(
    (d) => !d.completed && d.type === "frist" && getDaysRemaining(d.date) === 0
  );

  const selectedDayDeadlines = selectedDay !== null ? deadlinesForDay(selectedDay) : [];

  const filteredSorted = sorted.filter(matchesFilters);
  const filteredCompletedList = deadlines
    .filter((d) => d.completed && matchesFilters(d))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filteredDayDeadlines = selectedDayDeadlines.filter(matchesFilters);

  const isSearchActive = !!searchQuery.trim() || hasAdvancedFilters;

  function resetSearch() {
    setSearchQuery("");
    setAdvancedFilters({ type: "alle", az: "", assignedTo: "", dateFrom: "", dateTo: "", showCompleted: false });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {showDialog && (
        <DeadlineDialog
          editing={editingDeadline}
          onSave={handleSave}
          onClose={() => { setShowDialog(false); setEditingDeadline(null); }}
        />
      )}

      <div className="min-h-screen p-6 bg-slate-50 dark:bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fristen & Termine</h1>
            <p className="text-sm mt-0.5 text-gray-500 dark:text-gray-400">
              {MONTH_NAMES[calMonth]} {calYear}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg p-1 border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "calendar"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Calendar size={15} /> Kalender
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <List size={15} /> Liste
              </button>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity
                bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90"
            >
              <Plus size={15} /> Neu
            </button>
          </div>
        </div>

        {/* Suchleiste */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Fristen & Termine durchsuchen..."
                className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border transition-colors
                  bg-white border-gray-200 text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm
                  dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              title="Erweiterte Suche"
              className={`relative p-2.5 rounded-xl border shadow-sm transition-colors flex-shrink-0 ${
                showAdvanced || hasAdvancedFilters
                  ? "bg-indigo-500/15 border-indigo-400/40 text-indigo-600 dark:text-indigo-400"
                  : "bg-white border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {hasAdvancedFilters && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-50 dark:border-gray-950" />
              )}
            </button>
          </div>

          {/* Erweiterte Suche */}
          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl border space-y-3
              bg-white border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-700">

              {/* Typ + Zuständig */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-500 dark:text-gray-400">Typ</label>
                  <div className="flex gap-1.5">
                    {(["alle", "frist", "termin"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setAdvancedFilters((f) => ({ ...f, type: t }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          advancedFilters.type === t
                            ? t === "frist"
                              ? "bg-red-500/15 border-red-400/40 text-red-600 dark:text-red-400"
                              : t === "termin"
                              ? "bg-blue-500/15 border-blue-400/40 text-blue-600 dark:text-blue-400"
                              : "bg-indigo-500/15 border-indigo-400/40 text-indigo-600 dark:text-indigo-400"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                        }`}
                      >
                        {t === "alle" ? "Alle" : t === "frist" ? "Frist" : "Termin"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-500 dark:text-gray-400">Zuständig</label>
                  <select
                    value={advancedFilters.assignedTo}
                    onChange={(e) => setAdvancedFilters((f) => ({ ...f, assignedTo: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border transition-colors
                      bg-gray-50 border-gray-200 text-gray-900
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                      dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  >
                    <option value="">— Alle —</option>
                    {STAFF.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Az + Datum */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-500 dark:text-gray-400">Aktenzeichen</label>
                  <input
                    type="text"
                    value={advancedFilters.az}
                    onChange={(e) => setAdvancedFilters((f) => ({ ...f, az: e.target.value }))}
                    placeholder="z.B. 124/26"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border transition-colors
                      bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                      dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-500 dark:text-gray-400">Datum von</label>
                  <input
                    type="date"
                    value={advancedFilters.dateFrom}
                    onChange={(e) => setAdvancedFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border transition-colors
                      bg-gray-50 border-gray-200 text-gray-900
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                      dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-500 dark:text-gray-400">Datum bis</label>
                  <input
                    type="date"
                    value={advancedFilters.dateTo}
                    onChange={(e) => setAdvancedFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border transition-colors
                      bg-gray-50 border-gray-200 text-gray-900
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                      dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Erledigte + Reset */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={advancedFilters.showCompleted}
                    onChange={(e) => setAdvancedFilters((f) => ({ ...f, showCompleted: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded accent-indigo-500"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Erledigte anzeigen</span>
                </label>
                {hasAdvancedFilters && (
                  <button
                    onClick={() => setAdvancedFilters({ type: "alle", az: "", assignedTo: "", dateFrom: "", dateTo: "", showCompleted: false })}
                    className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Treffer-Info */}
          {isSearchActive && !loading && (
            <div className="flex items-center justify-between mt-2 px-0.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredSorted.length + filteredCompletedList.length} Ergebnis{filteredSorted.length + filteredCompletedList.length !== 1 ? "se" : ""}
              </span>
              <button onClick={resetSearch} className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400">
                Suche zurücksetzen
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        )}

        {!loading && (
          <>
            {/* Fristen von heute */}
            {todayFristen.length > 0 && (
              <div className="rounded-xl p-4 mb-6 border bg-red-50 border-red-200 dark:bg-red-950/60 dark:border-red-500/40">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                    {todayFristen.length === 1
                      ? "1 Frist läuft heute ab"
                      : `${todayFristen.length} Fristen laufen heute ab`}
                  </span>
                </div>
                <div className="space-y-2">
                  {todayFristen.map((d) => (
                    <div key={d.id} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.title}</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          Az: {d.az}
                          {d.description && ` · ${d.description}`}
                          {d.assigned_to && ` · ${d.assigned_to}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Kalender-Ansicht ──────────────────────────────────── */}
            {viewMode === "calendar" && (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                    <button
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {MONTH_NAMES[calMonth]} {calYear}
                    </span>
                    <button
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
                    {DAY_HEADERS.map((h) => (
                      <div key={h} className="text-center text-xs font-semibold py-2.5 text-gray-400 dark:text-gray-500">
                        {h}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                      const dayDeadlines = day ? deadlinesForDay(day) : [];
                      const isToday = isCurrentMonth && day === today.getDate();
                      const isSelected = day === selectedDay;
                      const isPast = day !== null && new Date(calYear, calMonth, day) < today;
                      const hasFrist = dayDeadlines.some((d) => d.type === "frist");
                      const hasTermin = dayDeadlines.some((d) => d.type === "termin");

                      return (
                        <div
                          key={idx}
                          onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                          className={`relative min-h-[64px] p-1.5 border-b border-r flex flex-col items-center
                            border-gray-100 dark:border-gray-800/60
                            ${day ? "cursor-pointer" : ""}
                            ${isSelected && !isToday ? "bg-indigo-50 dark:bg-indigo-600/10" : ""}
                            ${day && !isToday && !isSelected ? "hover:bg-gray-50 dark:hover:bg-gray-800/60" : ""}
                            ${!day ? "bg-gray-50/50 dark:bg-gray-900/30" : ""}
                          `}
                        >
                          {day && (
                            <>
                              <span
                                className={`text-sm w-7 h-7 flex items-center justify-center rounded-full font-medium transition-colors
                                  ${isToday ? "bg-indigo-600 text-white font-bold" : ""}
                                  ${isSelected && !isToday ? "ring-2 ring-indigo-500 text-indigo-600 dark:text-indigo-300" : ""}
                                  ${isPast && !isToday ? "text-gray-300 dark:text-gray-600" : ""}
                                  ${!isPast && !isToday ? "text-gray-700 dark:text-gray-300" : ""}
                                `}
                              >
                                {day}
                              </span>
                              {dayDeadlines.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {hasFrist && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                                  {hasTermin && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legende */}
                <div className="flex items-center gap-4 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">Frist</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">Termin</span>
                  </div>
                  {isCurrentMonth && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 inline-flex items-center justify-center text-[10px] text-white font-bold">
                        {today.getDate()}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Heute</span>
                    </div>
                  )}
                </div>

                {/* Tagesdetails */}
                {selectedDay !== null && (
                  <div className="rounded-xl overflow-hidden border bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {filteredDayDeadlines.length > 0
                          ? `${filteredDayDeadlines.length} Eintrag${filteredDayDeadlines.length > 1 ? "träge" : ""} am ${selectedDay}. ${MONTH_NAMES[calMonth]} ${calYear}`
                          : `Keine Einträge am ${selectedDay}. ${MONTH_NAMES[calMonth]} ${calYear}`}
                      </h2>
                      <button
                        onClick={() => {
                          setEditingDeadline(null);
                          setShowDialog(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                          border border-indigo-300 text-indigo-600 hover:bg-indigo-50
                          dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                      >
                        <Plus className="w-3 h-3" /> Neu
                      </button>
                    </div>
                    {filteredDayDeadlines.length > 0 ? (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredDayDeadlines.map((d) => (
                          <DeadlineRow
                            key={d.id}
                            deadline={d}

                            deleting={deleting === d.id}
                            onEdit={() => openEdit(d)}
                            onDelete={() => handleDelete(d.id)}
                            onToggle={() => handleToggleComplete(d)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-600">
                        Kein Termin oder keine Frist an diesem Tag.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Listen-Ansicht ────────────────────────────────────── */}
            {viewMode === "list" && (
              <div className="space-y-2">
                {filteredSorted.length === 0 && filteredCompletedList.length === 0 && (
                  <div className="text-center py-16 text-gray-400 dark:text-gray-600">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">
                      {isSearchActive ? "Keine Ergebnisse für diese Suche." : "Noch keine Einträge vorhanden."}
                    </p>
                    {isSearchActive && (
                      <button onClick={resetSearch} className="mt-2 text-xs text-indigo-500 hover:underline">
                        Suche zurücksetzen
                      </button>
                    )}
                  </div>
                )}

                {/* Offene Einträge */}
                {filteredSorted.length > 0 && (
                  <div className="space-y-2">
                    {filteredSorted.map((d) => (
                      <DeadlineCard
                        key={d.id}
                        deadline={d}

                        deleting={deleting === d.id}
                        onEdit={() => openEdit(d)}
                        onDelete={() => handleDelete(d.id)}
                        onToggle={() => handleToggleComplete(d)}
                      />
                    ))}
                  </div>
                )}

                {/* Erledigte */}
                {filteredCompletedList.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-xs font-medium text-gray-400 dark:text-gray-600 cursor-pointer hover:text-gray-600 dark:hover:text-gray-400 select-none py-2">
                      {filteredCompletedList.length} erledigte Einträge
                    </summary>
                    <div className="mt-2 space-y-2 opacity-60">
                      {filteredCompletedList.map((d) => (
                          <DeadlineCard
                            key={d.id}
                            deadline={d}

                            deleting={deleting === d.id}
                            onEdit={() => openEdit(d)}
                            onDelete={() => handleDelete(d.id)}
                            onToggle={() => handleToggleComplete(d)}
                          />
                        ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── DeadlineRow (Kalender-Tagesdetail) ─────────────────────────────────────

function DeadlineRow({
  deadline: d,
  deleting,
  onEdit,
  onDelete,
  onToggle,
}: {
  deadline: Deadline;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${d.completed ? "opacity-50" : ""}`}>
      <button onClick={onToggle} className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-indigo-500 transition-colors">
        {d.completed
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <Circle className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold text-gray-900 dark:text-gray-100 ${d.completed ? "line-through" : ""}`}>
            {d.title}
          </span>
          <TypeBadge type={d.type} />
          {!d.completed && <DaysRemainingBadge days={getDaysRemaining(d.date)} />}
        </div>
        {d.description && (
          <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">{d.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <FileText size={11} className="text-gray-400" />
            <span className="text-xs text-gray-400">Az: {d.az}</span>
          </div>
          {d.location && d.type === "termin" && (
            <div className="flex items-center gap-1">
              <MapPin size={11} className="text-indigo-400 flex-shrink-0" />
              <span className="text-xs text-indigo-500 dark:text-indigo-400">{d.location}</span>
            </div>
          )}
          {d.assigned_to && (
            <div className="flex items-center gap-1">
              <User size={11} className="text-gray-400" />
              <span className="text-xs text-gray-400">{d.assigned_to}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── DeadlineCard (Listenansicht) ────────────────────────────────────────────

function DeadlineCard({
  deadline: d,
  deleting,
  onEdit,
  onDelete,
  onToggle,
}: {
  deadline: Deadline;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const days = getDaysRemaining(d.date);

  return (
    <div className={`flex gap-3 rounded-xl p-4 border transition-colors bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700 ${d.completed ? "opacity-60" : ""}`}>
      {/* Toggle + Farbpunkt */}
      <div className="flex flex-col items-center pt-0.5 gap-1">
        <button onClick={onToggle} className="text-gray-300 hover:text-indigo-500 transition-colors">
          {d.completed
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <Circle className="w-4 h-4" />}
        </button>
        <div className={`w-2 h-2 rounded-full mt-1 ${d.type === "frist" ? "bg-red-500" : "bg-blue-500"}`} />
      </div>

      {/* Inhalt */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Clock size={12} />
            <span>{formatDate(d.date)}</span>
          </div>
          {!d.completed && <DaysRemainingBadge days={days} />}
          <TypeBadge type={d.type} />
        </div>
        <h3 className={`text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 ${d.completed ? "line-through" : ""}`}>
          {d.title}
        </h3>
        {d.description && (
          <p className="text-xs mt-1 leading-relaxed text-gray-500 dark:text-gray-400">{d.description}</p>
        )}
        {d.location && d.type === "termin" && (
          <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg
            bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 w-fit">
            <MapPin size={11} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{d.location}</span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <FileText size={11} className="text-gray-400 dark:text-gray-600" />
            <span className="text-xs text-gray-400 dark:text-gray-600">Az: {d.az}</span>
          </div>
          {d.assigned_to && (
            <div className="flex items-center gap-1">
              <User size={11} className="text-indigo-400" />
              <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">{d.assigned_to}</span>
            </div>
          )}
        </div>
      </div>

      {/* Datum-Badge + Aktionen */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${
          d.completed
            ? "bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500"
            : days <= 1 ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300"
            : days <= 3 ? "bg-red-500/10 border-red-500/20 text-red-500 dark:text-red-400"
            : days <= 7 ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
        }`}>
          {new Date(d.date).getDate()}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
