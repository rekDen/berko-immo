"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { resolveModule } from "@/lib/modules";

// Protokolliert Modul-Aufrufe für die Nutzungshistorie (s. Einstellungen →
// Nutzerverwaltung). Meldet nur bei tatsächlichem Pfadwechsel, nicht bei
// jedem Re-Render — vermeidet Duplikate ohne serverseitige Deduplizierung.
export default function UsageTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastTracked.current) return;
    lastTracked.current = pathname;
    fetch("/api/usage/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: resolveModule(pathname), path: pathname }),
    }).catch(() => {
      // Nutzungstracking ist nicht kritisch — ein fehlgeschlagener Aufruf
      // (z. B. Offline) darf die Navigation nicht stören.
    });
  }, [pathname]);

  return null;
}
