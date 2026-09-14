"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2, LogIn, MonitorSmartphone, ShieldAlert } from "lucide-react";

interface LoginEntry { id: string; ip_address: string | null; user_agent: string | null; logged_in_at: string }
interface UsageEntry { id: string; module: string; path: string; ip_address: string | null; visited_at: string }
interface ActivityResponse { user: { id: string; name: string }; logins: LoginEntry[]; usage: UsageEntry[] }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "medium" });
}

export default function NutzerVerlaufPage() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}/activity`).then(async (res) => {
      if (res.ok) setData(await res.json());
      else { const err = await res.json().catch(() => ({ error: "Fehler beim Laden" })); setError(err.error); }
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-6">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <ShieldAlert className="w-5 h-5" />
          <p className="text-sm">{error || "Nutzer nicht gefunden"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto bg-slate-50 dark:bg-gray-950 space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <Link href="/einstellungen" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Einstellungen</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/einstellungen/nutzer" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Nutzerverwaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">{data.user.name}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{data.user.name}</h1>

      <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4 flex items-center gap-1.5">
          <LogIn className="w-3.5 h-3.5" /> Login-Historie
        </h2>
        {data.logins.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Noch keine erfassten Logins.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-4 font-medium">Zeitpunkt</th>
                  <th className="py-1.5 pr-4 font-medium">IP-Adresse</th>
                  <th className="py-1.5 font-medium">Browser/Gerät</th>
                </tr>
              </thead>
              <tbody>
                {data.logins.map((l) => (
                  <tr key={l.id} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDateTime(l.logged_in_at)}</td>
                    <td className="py-1.5 pr-4 text-gray-500 font-mono text-xs">{l.ip_address ?? "–"}</td>
                    <td className="py-1.5 text-gray-500 text-xs truncate max-w-xs">{l.user_agent ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4 flex items-center gap-1.5">
          <MonitorSmartphone className="w-3.5 h-3.5" /> Nutzungshistorie
        </h2>
        {data.usage.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Noch keine erfasste Nutzung.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-4 font-medium">Zeitpunkt</th>
                  <th className="py-1.5 pr-4 font-medium">Modul</th>
                  <th className="py-1.5 pr-4 font-medium">Pfad</th>
                  <th className="py-1.5 font-medium">IP-Adresse</th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((u) => (
                  <tr key={u.id} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDateTime(u.visited_at)}</td>
                    <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">{u.module}</td>
                    <td className="py-1.5 pr-4 text-gray-500 font-mono text-xs">{u.path}</td>
                    <td className="py-1.5 text-gray-500 font-mono text-xs">{u.ip_address ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
