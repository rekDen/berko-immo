"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, ShieldAlert, Users } from "lucide-react";

interface TenantUser {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  email: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Administrator",
  tenant_user: "Mitarbeiter",
  external: "Extern",
};

// Nutzerverwaltung → Liste aller Nutzer des Mandanten, mit Zugriff auf die
// Login-/Nutzungshistorie je Nutzer. Nur für Tenant-Admins (die API liefert
// sonst 403, s. /api/admin/users).
export default function NutzerverwaltungPage() {
  const [users, setUsers] = useState<TenantUser[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users").then(async (res) => {
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      if (res.ok) setUsers(await res.json());
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-6">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <ShieldAlert className="w-5 h-5" />
          <p className="text-sm">Diese Seite ist nur für Administratoren zugänglich.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto bg-slate-50 dark:bg-gray-950">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Einstellungen</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-600 dark:text-gray-300">Nutzerverwaltung</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
        <Users className="w-5 h-5 text-gray-400" /> Nutzerverwaltung
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Login- und Nutzungshistorie je Nutzer — wer sich wann von welcher IP-Adresse angemeldet und welche Module besucht hat.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">E-Mail</th>
              <th className="px-4 py-2 font-medium">Rolle</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-t border-gray-50 dark:border-gray-800/50">
                <td className="px-4 py-2 text-gray-800 dark:text-gray-200 font-medium">{u.name}</td>
                <td className="px-4 py-2 text-gray-500">{u.email ?? "–"}</td>
                <td className="px-4 py-2 text-gray-500">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/einstellungen/nutzer/${u.id}`} className="text-xs text-orange-600 dark:text-orange-400 hover:underline">
                    Verlauf anzeigen
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
