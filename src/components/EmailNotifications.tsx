"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, X } from "lucide-react";

// ─── Typen ──────────────────────────────────────────────────────────────────

interface EmailNotification {
  id: string;
  fromName: string;
  subject: string;
  emailId: string;
}

interface EmailNotificationsContextType {
  liveConnected: boolean;
  emailUpdateCount: number;
}

const EmailNotificationsContext = createContext<EmailNotificationsContextType>({
  liveConnected: false,
  emailUpdateCount: 0,
});

export function useEmailNotifications() {
  return useContext(EmailNotificationsContext);
}

// ─── Provider ───────────────────────────────────────────────────────────────

export default function EmailNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<EmailNotification[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);
  const [emailUpdateCount, setEmailUpdateCount] = useState(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const router = useRouter();

  // ── Toast anzeigen ──────────────────────────────────────────────────────

  const showToast = useCallback((emails: { id: string; fromName: string; subject: string }[]) => {
    const entries: EmailNotification[] = emails.slice(0, 3).map((e) => ({
      id: `${e.id}-${Date.now()}`,
      fromName: e.fromName,
      subject: e.subject,
      emailId: e.id,
    }));
    setToasts((prev) => [...prev, ...entries]);
    entries.forEach((t) =>
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 6000)
    );
    // Browser-Benachrichtigung
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      emails.slice(0, 3).forEach((e) =>
        new Notification(`Neue E-Mail von ${e.fromName}`, {
          body: e.subject,
          icon: "/favicon.ico",
          tag: e.id,
        })
      );
    }
  }, []);

  // ── Neue Emails aus DB holen und Toasts anzeigen ────────────────────────

  const fetchAndNotify = useCallback(async () => {
    try {
      const res = await fetch("/api/emails");
      if (!res.ok) return;
      const rows: { id: string; from_name: string; subject: string }[] = await res.json();
      const ids = rows.map((r) => r.id);

      if (initializedRef.current && knownIdsRef.current.size > 0) {
        const newRows = rows.filter((r) => !knownIdsRef.current.has(r.id));
        if (newRows.length > 0) {
          showToast(newRows.map((r) => ({ id: r.id, fromName: r.from_name, subject: r.subject })));
          setEmailUpdateCount((n) => n + 1);
        }
      }

      knownIdsRef.current = new Set(ids);
      initializedRef.current = true;
    } catch { /* ignore */ }
  }, [showToast]);

  // ── Debounce — max 1 fetch pro 500ms ────────────────────────────────────

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef = useRef(fetchAndNotify);
  fetchRef.current = fetchAndNotify;

  const debouncedFetch = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fetchRef.current();
    }, 500);
  }, []);

  // ── Initiale IDs laden (ohne Toast) ─────────────────────────────────────

  useEffect(() => {
    fetch("/api/emails")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { id: string }[]) => {
        knownIdsRef.current = new Set(rows.map((r) => r.id));
        initializedRef.current = true;
      })
      .catch(() => {});

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── SSE — IMAP IDLE Verbindung ──────────────────────────────────────────

  useEffect(() => {
    const es = new EventSource("/api/emails/live");
    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "connected") setLiveConnected(true);
      if (data.type === "error") setLiveConnected(false);
      if (data.type === "new_mail") {
        console.log("[SSE] Neue E-Mail erkannt");
        debouncedFetch();
      }
    };
    return () => es.close();
  }, [debouncedFetch]);

  // ── Supabase Realtime ───────────────────────────────────────────────────

  const debouncedFetchRef = useRef(debouncedFetch);
  debouncedFetchRef.current = debouncedFetch;

  useEffect(() => {
    const supabase = createClient();
    const channelName = `emails-global-${Date.now()}`;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { access_token: string; user: { id: string } } | null } }) => {
      if (cancelled || !session) return;

      supabase.realtime.setAuth(session.access_token);

      supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "emails",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            console.log("[Realtime] INSERT empfangen:", payload.new);
            debouncedFetchRef.current();
          }
        )
        .subscribe((status: string, err?: Error) => {
          console.log("[Realtime] Status:", status, err ?? "");
        });
    });

    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = supabase.getChannels().find((c: any) => c.topic === `realtime:${channelName}`);
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <EmailNotificationsContext.Provider value={{ liveConnected, emailUpdateCount }}>
      {children}

      {/* Toast-Benachrichtigungen — global sichtbar auf allen Seiten */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto w-80 rounded-2xl shadow-xl border cursor-pointer
              bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700"
            onClick={() => {
              router.push("/emails");
              setToasts((prev) => prev.filter((x) => x.id !== t.id));
            }}
          >
            <div className="flex items-start gap-3 px-4 py-3.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-0.5">
                  Neue E-Mail
                </p>
                <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">
                  {t.fromName}
                </p>
                <p className="text-xs truncate mt-0.5 text-gray-500 dark:text-gray-400">
                  {t.subject}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
                className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-0.5 bg-gray-100 dark:bg-gray-800 rounded-b-2xl overflow-hidden">
              <div
                className="h-full bg-indigo-500 origin-left"
                style={{ animation: "shrink 6s linear forwards" }}
              />
            </div>
          </div>
        ))}
      </div>
    </EmailNotificationsContext.Provider>
  );
}
