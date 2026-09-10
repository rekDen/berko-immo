"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Loader2, CalendarDays, Plus, Search, X, Check, Clock, MapPin,
} from "lucide-react";
import PropertyTabBar from "@/components/dms/PropertyTabBar";

type Property = { id: string; name: string };

type Deadline = {
  id: string;
  az: string;
  date: string;
  title: string;
  description: string;
  type: "frist" | "termin";
  completed: boolean;
  assigned_to: string;
  location: string;
};

const TYPE_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "termin", label: "Termine" },
  { value: "frist", label: "Fristen" },
];

export default function PropertyDeadlinesPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Add form
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [form, setForm] = useState({
    type: "termin" as "frist" | "termin",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    az: "",
    description: "",
    location: "",
    assigned_to: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [propRes, deadlinesRes] = await Promise.all([
      fetch(`/api/properties/${propertyId}`),
      fetch(`/api/deadlines?property_id=${propertyId}`),
    ]);
    if (propRes.ok) setProperty(await propRes.json());
    if (deadlinesRes.ok) setDeadlines(await deadlinesRes.json());
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({
      type: "termin",
      title: "",
      date: new Date().toISOString().slice(0, 10),
      az: "",
      description: "",
      location: "",
      assigned_to: "",
    });
    setAddOpen(true);
  }

  async function saveAdd() {
    if (!form.title.trim() || !form.date || !form.az.trim()) return;
    setAddSaving(true);
    const res = await fetch("/api/deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        property_id: propertyId,
      }),
    });
    if (res.ok) {
      setAddOpen(false);
      await load();
    }
    setAddSaving(false);
  }

  async function toggleComplete(d: Deadline) {
    const res = await fetch(`/api/deadlines/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !d.completed }),
    });
    if (res.ok) await load();
  }

  const q = search.trim().toLowerCase();
  const filtered = deadlines.filter((d) => {
    if (filter !== "all" && d.type !== filter) return false;
    if (q && ![d.title, d.az, d.description, d.location].some((f) => f?.toLowerCase().includes(q))) return false;
    return true;
  });

  // gruppiert nach Vergangenheit/Zukunft
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = filtered.filter((d) => d.date >= today);
  const past = filtered.filter((d) => d.date < today);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <PropertyTabBar
        propertyId={propertyId}
        propertyName={property?.name ?? "Laden…"}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Termine durchsuchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
                dark:bg-gray-900 dark:border-gray-800 dark:text-white
                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap
              bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Termin / Frist
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setFilter(o.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === o.value
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {addOpen && (
          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Typ</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "frist" | "termin" })}
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="termin">Termin</option>
                  <option value="frist">Frist</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Datum *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Aktenzeichen *</label>
                <input
                  value={form.az}
                  onChange={(e) => setForm({ ...form, az: e.target.value })}
                  placeholder="z.B. WEG-2026-001"
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Titel *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={form.type === "termin" ? "z.B. ETV 2026" : "z.B. Frist Beschluss-Anfechtung"}
                className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Ort</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Zugewiesen an</label>
                <input
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAddOpen(false)}
                disabled={addSaving}
                className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={saveAdd}
                disabled={addSaving || !form.title.trim() || !form.date || !form.az.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg
                  bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Speichern
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <CalendarDays className="w-12 h-12 mb-3" />
            <p className="text-sm">{q || filter !== "all" ? "Keine Treffer" : "Keine Termine"}</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <DeadlineTable
                title="Anstehend"
                items={upcoming}
                onToggle={toggleComplete}
              />
            )}
            {past.length > 0 && (
              <DeadlineTable
                title="Vergangen"
                items={past}
                onToggle={toggleComplete}
                muted
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DeadlineTable({
  title, items, onToggle, muted,
}: {
  title: string;
  items: Deadline[];
  onToggle: (d: Deadline) => void;
  muted?: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title} ({items.length})
      </h3>
      <div className={`rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden ${muted ? "opacity-70" : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 w-28">Datum</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Titel</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden md:table-cell">Aktenz.</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Ort</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400 hidden lg:table-cell">Zuständig</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-gray-400">Typ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => onToggle(d)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      d.completed
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-gray-300 hover:border-emerald-400 dark:border-gray-600"
                    }`}
                  >
                    {d.completed && <Check className="w-3 h-3 text-white" />}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {new Date(d.date).toLocaleDateString("de-DE")}
                </td>
                <td className="px-4 py-2.5">
                  <p className={`font-medium text-gray-800 dark:text-gray-200 ${d.completed ? "line-through opacity-60" : ""}`}>
                    {d.title}
                  </p>
                  {d.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.description}</p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden md:table-cell font-mono text-xs">
                  {d.az}
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                  {d.location ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {d.location}
                    </span>
                  ) : "–"}
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                  {d.assigned_to || "–"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      d.type === "frist"
                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {d.type === "frist" ? <Clock className="w-3 h-3 inline mr-1" /> : null}
                    {d.type === "frist" ? "Frist" : "Termin"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
