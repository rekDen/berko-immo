"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEmailNotifications } from "@/components/EmailNotifications";
import MarkdownContent from "@/components/MarkdownContent";
import {
  Mail, AlertTriangle, Briefcase, Mic, Calendar, Clock,
  Sparkles, ChevronRight, Loader2, RefreshCw,
} from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface DbEmail {
  id: string;
  from_name: string;
  from_address: string;
  subject: string;
  date: string;
  category:
    | "objektbezogen"
    | "mieterkommunikation"
    | "finanzen"
    | "schaeden"
    | "vertraege"
    | "weg"
    | "behoerden"
    | "dienstleister"
    | "termine"
    | "intern"
    | "newsletter";
  read: boolean;
}

interface DbDeadline {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "frist" | "termin";
  az: string;
  assigned_to: string;
  completed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "gerade eben";
  if (diff < 60) return `vor ${diff} Min.`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d !== 1 ? "en" : ""}`;
}

function startOfWeek(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// ─── Kategorie-Konfig ─────────────────────────────────────────────────────────

const catConfig: Record<DbEmail["category"], { label: string; classes: string }> = {
  objektbezogen:        { label: "Objekt",        classes: "bg-orange-500/15 text-orange-600 border border-orange-500/20 dark:text-orange-400" },
  mieterkommunikation:  { label: "Mieter",        classes: "bg-blue-500/15 text-blue-600 border border-blue-500/20 dark:text-blue-400" },
  finanzen:             { label: "Finanzen",      classes: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400" },
  schaeden:             { label: "Schäden",       classes: "bg-red-500/15 text-red-600 border border-red-500/20 dark:text-red-400" },
  vertraege:            { label: "Verträge",      classes: "bg-purple-500/15 text-purple-600 border border-purple-500/20 dark:text-purple-400" },
  weg:                  { label: "WEG",           classes: "bg-amber-500/15 text-amber-600 border border-amber-500/20 dark:text-amber-400" },
  behoerden:            { label: "Behörden",      classes: "bg-rose-500/15 text-rose-600 border border-rose-500/20 dark:text-rose-400" },
  dienstleister:        { label: "Dienstleister", classes: "bg-cyan-500/15 text-cyan-600 border border-cyan-500/20 dark:text-cyan-400" },
  termine:              { label: "Termine",       classes: "bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 dark:text-indigo-400" },
  intern:               { label: "Intern",        classes: "bg-green-500/15 text-green-600 border border-green-500/20 dark:text-green-400" },
  newsletter:           { label: "Newsletter",    classes: "bg-gray-500/15 text-gray-500 border border-gray-400/20 dark:text-gray-400" },
};

// ─── Karten ───────────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, trend, trendPositive, accentClass, loading }: {
  icon: React.ElementType; label: string; value: number | string;
  trend?: string; trendPositive?: boolean; accentClass: string; loading?: boolean;
}) {
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden group transition-colors duration-200 bg-white border border-gray-200 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${accentClass} blur-3xl`} />
      <div className="relative flex items-start justify-between">
        <div className="flex flex-col gap-3">
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${accentClass} bg-opacity-20`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm mb-0.5 text-gray-500 dark:text-gray-500">{label}</p>
            {loading ? (
              <div className="h-8 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse mt-1" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
            )}
          </div>
        </div>
        {trend && !loading && (
          <span className={`mt-1 text-xs font-medium px-2 py-1 rounded-full ${trendPositive ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function DeadlineBadge({ days }: { days: number }) {
  if (days < 0)  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/20 dark:text-red-400">Überfällig</span>;
  if (days === 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/20 dark:text-red-400">Heute</span>;
  if (days <= 3)  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/20 dark:text-red-400">{days}d</span>;
  if (days <= 7)  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/20 dark:text-amber-400">{days}d</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">{days}d</span>;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { liveConnected } = useEmailNotifications();
  const today = new Date();

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState<DbEmail[]>([]);
  const [deadlines, setDeadlines] = useState<DbDeadline[]>([]);
  const [dictationsThisWeek, setDictationsThisWeek] = useState(0);
  const [userName, setUserName] = useState("");
  const [firmName, setFirmName] = useState("");

  const [briefing, setBriefing] = useState("");
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingGenerated, setBriefingGenerated] = useState(false);

  // ── Daten laden ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const [emailRes, deadlineRes, dictRes, profileRes] = await Promise.all([
      fetch("/api/emails?folder=inbox"),
      fetch("/api/deadlines"),
      fetch("/api/dictations"),
      fetch("/api/profile"),
    ]);

    const [emailData, deadlineData, dictData] = await Promise.all([
      emailRes.ok ? emailRes.json() : [],
      deadlineRes.ok ? deadlineRes.json() : [],
      dictRes.ok ? dictRes.json() : [],
    ]);

    setEmails(emailData);
    setDeadlines(deadlineData);

    if (profileRes.ok) {
      const profile: { name?: string; firm_name?: string | null } = await profileRes.json();
      setUserName(profile.name ?? "");
      setFirmName(profile.firm_name ?? "");
    }

    const weekStart = startOfWeek();
    setDictationsThisWeek(dictData.filter((d: { created_at: string }) => new Date(d.created_at) >= weekStart).length);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: neue E-Mails nachladen wenn liveConnected eine neue liefert
  useEffect(() => {
    if (!liveConnected) return;
    const interval = setInterval(async () => {
      const res = await fetch("/api/emails?folder=inbox");
      if (res.ok) setEmails(await res.json());
    }, 30000);
    return () => clearInterval(interval);
  }, [liveConnected]);

  // ── KI-Briefing generieren ────────────────────────────────────────────────
  async function generateBriefing() {
    setBriefingLoading(true);
    setBriefing("");
    try {
      const urgentDeadlines = deadlines
        .filter((d) => !d.completed && daysUntil(d.date) <= 14)
        .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
        .slice(0, 8)
        .map((d) => ({ ...d, daysUntil: daysUntil(d.date) }));

      const unreadEmails = emails
        .filter((e) => !e.read)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6)
        .map((e) => ({ fromName: e.from_name, subject: e.subject, category: e.category, date: e.date }));

      const res = await fetch("/api/dashboard/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadlines: urgentDeadlines,
          emails: unreadEmails,
          dictationsThisWeek,
        }),
      });
      if (res.ok) {
        const { briefing: text } = await res.json();
        setBriefing(text);
        setBriefingGenerated(true);
      }
    } finally {
      setBriefingLoading(false);
    }
  }

  // Briefing automatisch laden sobald Daten da sind
  useEffect(() => {
    if (!loading && !briefingGenerated && !briefingLoading) {
      generateBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Abgeleitete Werte ─────────────────────────────────────────────────────
  const unreadCount = emails.filter((e) => !e.read).length;
  const urgentDeadlines = deadlines
    .filter((d) => !d.completed && daysUntil(d.date) <= 14)
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  const recentEmails = [...emails]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto space-y-8 bg-slate-50 dark:bg-gray-950">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()},{" "}
            <span className="text-indigo-600 dark:text-indigo-400">{userName || "…"}</span>
          </h1>
          <p className="text-sm mt-1 text-gray-500 dark:text-gray-500">{formatDate(today)}</p>
        </div>
        <div className="flex items-center gap-3">
          {liveConnected && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          )}
          <button onClick={loadData} disabled={loading} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
          <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-2 bg-white border border-gray-200 text-gray-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-500">
            <Briefcase className="w-4 h-4 text-gray-400 dark:text-gray-600" />
            <span>Hausverwaltung {firmName || userName}</span>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={Mail} label="Ungelesene E-Mails" value={unreadCount}
          trend={unreadCount > 5 ? "Dringend" : undefined} trendPositive={false}
          accentClass="text-indigo-500 bg-indigo-500/10" loading={loading}
        />
        <MetricCard
          icon={AlertTriangle} label="Dringende Fristen" value={urgentDeadlines.length}
          trend={urgentDeadlines.some(d => daysUntil(d.date) <= 0) ? "Überfällig!" : urgentDeadlines.length > 3 ? "Kritisch" : undefined}
          trendPositive={false} accentClass="text-red-500 bg-red-500/10" loading={loading}
        />
        <MetricCard
          icon={Mic} label="Diktate diese Woche" value={dictationsThisWeek}
          trend={dictationsThisWeek > 0 ? "Diese Woche" : undefined} trendPositive={true}
          accentClass="text-violet-500 bg-violet-500/10" loading={loading}
        />
      </section>

      {/* Fristen + E-Mails */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dringende Fristen */}
        <div className="rounded-2xl overflow-hidden bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-500 dark:text-red-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Dringende Fristen</h2>
              {!loading && (
                <span className="text-xs font-medium bg-red-500/15 text-red-600 border border-red-500/20 px-1.5 py-0.5 rounded-full dark:text-red-400">
                  {urgentDeadlines.length}
                </span>
              )}
            </div>
            <button onClick={() => router.push("/deadlines")} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Alle <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-5">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
              </div>
            ) : urgentDeadlines.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-600">Keine dringenden Fristen 🎉</p>
            ) : (
              urgentDeadlines.slice(0, 5).map((d) => {
                const days = daysUntil(d.date);
                const isUrgent = days <= 3;
                const isWarning = days > 3 && days <= 7;
                return (
                  <div key={d.id} className="flex items-start gap-3 py-3.5 border-b border-gray-100 last:border-0 dark:border-gray-800/60">
                    <div className={`mt-1 w-0.5 self-stretch rounded-full flex-shrink-0 ${isUrgent ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">{d.az}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${d.type === "frist" ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"}`}>
                          {d.type === "frist" ? "Frist" : "Termin"}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">{d.title}</p>
                      {d.description && <p className="text-xs mt-0.5 line-clamp-1 text-gray-500 dark:text-gray-500">{d.description}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                      <DeadlineBadge days={days} />
                      <span className="text-[10px] text-gray-400 dark:text-gray-600">
                        {new Date(d.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Neue E-Mails */}
        <div className="rounded-2xl overflow-hidden bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Neue E-Mails</h2>
              {!loading && unreadCount > 0 && (
                <span className="text-xs font-medium bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 px-1.5 py-0.5 rounded-full dark:text-indigo-400">
                  {unreadCount} ungelesen
                </span>
              )}
              {liveConnected && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              )}
            </div>
            <button onClick={() => router.push("/emails")} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Alle <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-5">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
              </div>
            ) : recentEmails.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-600">Keine E-Mails im Posteingang</p>
            ) : (
              recentEmails.map((e) => {
                const cat = catConfig[e.category];
                return (
                  <div key={e.id} className="flex items-start gap-3 py-3.5 border-b border-gray-100 last:border-0 dark:border-gray-800/60 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 -mx-5 px-5 transition-colors rounded-lg"
                    onClick={() => { sessionStorage.setItem("openEmailId", e.id); sessionStorage.setItem("openEmailFolder", "inbox"); router.push("/emails"); }}>
                    <div className="mt-1.5 flex-shrink-0">
                      {!e.read
                        ? <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_2px_rgba(99,102,241,0.4)]" />
                        : <div className="w-2 h-2" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold truncate ${!e.read ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>{e.from_name}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${cat.classes}`}>{cat.label}</span>
                      </div>
                      <p className={`text-xs truncate ${!e.read ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>{e.subject}</p>
                    </div>
                    <span className="text-[10px] flex-shrink-0 pt-0.5 text-gray-400 dark:text-gray-600">{timeAgo(e.date)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Berko AI KI-Briefing */}
      <section>
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600/40 via-cyan-500/20 to-violet-600/30 p-px">
            <div className="absolute inset-[1px] rounded-2xl bg-white dark:bg-gray-900" />
          </div>
          <div className="relative rounded-2xl p-6 bg-white/95 dark:bg-gray-900/95">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30">
                <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Berko AI KI-Briefing</h2>
                <p className="text-xs text-gray-500 dark:text-gray-500">Tägliche KI-Zusammenfassung · {formatDate(today)}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {briefingLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Berko AI analysiert…
                  </span>
                )}
                {briefingGenerated && !briefingLoading && (
                  <>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aktuell
                    </span>
                    <button onClick={generateBriefing} title="Neu generieren" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {briefingLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className={`h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse ${i === 3 ? "w-2/3" : "w-full"}`} />)}
                </div>
              ) : briefing ? (
                <div className="space-y-1">
                  <MarkdownContent content={briefing} />
                  {urgentDeadlines.length > 0 && (
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                        <Calendar className="w-3.5 h-3.5 text-violet-500" />
                        <span>Nächste Frist: <span className="text-gray-700 dark:text-gray-300">{urgentDeadlines[0].title}</span></span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">Briefing wird geladen…</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
