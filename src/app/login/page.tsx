"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, CheckCircle } from "lucide-react";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();

    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Registrierung
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Supabase gibt bei aktivierter E-Mail-Bestätigung session=null zurück
    if (!data.session) {
      setSuccess(
        "Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse und melde dich danach an."
      );
      setLoading(false);
      setMode("login");
      return;
    }

    // E-Mail-Bestätigung deaktiviert → direkt einloggen
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="h-12 sm:h-14 w-auto max-w-[80%] mx-auto mb-4 text-gray-900 dark:text-white" />
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            KI-Assistent für Hausverwaltungen
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {mode === "login" ? "Anmelden" : "Registrieren"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400">
                E-Mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border transition-colors
                    bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                  placeholder="name@kanzlei.de"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border transition-colors
                    bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 text-sm bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-3 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Anmelden" : "Registrieren"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {mode === "login"
                ? "Noch kein Konto? Registrieren"
                : "Bereits ein Konto? Anmelden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
