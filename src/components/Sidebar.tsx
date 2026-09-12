"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Mail,
  CalendarClock,
  Bot,
  Mic,
  Building2,
  Users,
  FileSignature,
  ClipboardList,
  TrendingUp,
  DatabaseZap,
  FolderTree,
  PhoneCall,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "./ThemeToggle";
import Logo, { LogoMark } from "./Logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/objekte", label: "Objekte", icon: Building2 },
  { href: "/kontakte", label: "Kontakte", icon: Users },
  { href: "/vertraege", label: "Verträge", icon: FileSignature },
  { href: "/vorgaenge", label: "Vorgänge", icon: ClipboardList },
  { href: "/dokumente", label: "Dokumente", icon: FolderTree },
  { href: "/emails", label: "E-Mails", icon: Mail },
  { href: "/deadlines", label: "Fristen & Termine", icon: CalendarClock },
  { href: "/immobilienoptimierung", label: "Bestandsentwicklung", icon: TrendingUp },
  { href: "/daten-einlesen", label: "Daten einlesen", icon: DatabaseZap },
  { href: "/legal-ai", label: "Immo-KI", icon: Bot },
  { href: "/dictation", label: "Diktat", icon: Mic },
  { href: "/telefonassistent", label: "Telefonassistent", icon: PhoneCall },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState<{ name: string; firm_name: string | null; initials: string | null }>({
    name: "",
    firm_name: null,
    initials: null,
  });

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const data = await res.json();
      setProfile({
        name: data.name ?? data.email ?? "",
        firm_name: data.firm_name ?? null,
        initials: data.initials ?? null,
      });
    }
    fetchProfile();
  }, []);

  useEffect(() => {
    async function fetchUnread() {
      const res = await fetch("/api/emails?folder=inbox");
      if (!res.ok) return;
      const data: { read: boolean }[] = await res.json();
      setUnreadCount(data.filter((e) => !e.read).length);
    }
    fetchUnread();

    // Realtime: zähler bei neuen E-Mails aktualisieren
    const supabase = createClient();
    const channel = supabase
      .channel("sidebar-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails" }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } h-screen flex flex-col transition-all duration-200
        bg-white border-r border-gray-200
        dark:bg-gray-900 dark:border-gray-800`}
    >
      {/* Logo */}
      <div className="p-4 flex items-center">
        {collapsed ? (
          <LogoMark className="w-9 h-9 mx-auto" />
        ) : (
          <Logo className="h-12 w-auto max-w-full text-gray-900 dark:text-white" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const badge = item.href === "/emails" && unreadCount > 0 ? unreadCount : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {badge ? (
                    <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-1">
        <ThemeToggle collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-3 mb-2 p-2 rounded-lg transition-colors
          text-gray-400 dark:text-gray-500
          hover:text-gray-900 dark:hover:text-white
          hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* User section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Link
            href="/einstellungen"
            className="flex items-center gap-3 flex-1 min-w-0 group"
            title="Einstellungen"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm font-bold flex-shrink-0 text-white">
              {profile.initials || "?"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:underline">
                  {profile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                  {profile.firm_name}
                </p>
              </div>
            )}
          </Link>
          {!collapsed && (
            <Link
              href="/einstellungen"
              className="p-1.5 transition-colors flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white"
              title="Einstellungen"
            >
              <Settings className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 transition-colors flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
            title="Abmelden"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
