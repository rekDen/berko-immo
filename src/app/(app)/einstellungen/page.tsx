"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Check, Code2, Type, Users, ChevronRight } from "lucide-react";
import { MessageTemplatesSection } from "@/components/mietermatching/MessageTemplatesSection";

type Profile = {
  first_name: string | null;
  last_name: string | null;
  firm_name: string | null;
  signature_html: string | null;
  signature_text: string | null;
  email: string;
};

const inputCls =
  "w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";
const cardCls =
  "bg-white border border-gray-200 rounded-2xl p-6 dark:bg-gray-900 dark:border-gray-800";
const sectionTitleCls = "text-base font-semibold text-gray-900 dark:text-white mb-1";
const sectionHintCls = "text-xs text-gray-500 dark:text-gray-400 mb-5";

export default function EinstellungenPage() {
  const [loading, setLoading] = useState(true);

  // Persönliche Daten + Signatur
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [signatureTab, setSignatureTab] = useState<"text" | "html">("text");
  const [signatureText, setSignatureText] = useState("");
  const [signatureHtml, setSignatureHtml] = useState("");
  const [email, setEmail] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // Passwort
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  // WEG-Jahresabrechnung: Anschreiben/Beschlussvorlage-Vorlagen
  const [anschreibenSubject, setAnschreibenSubject] = useState("");
  const [anschreibenBody, setAnschreibenBody] = useState("");
  const [beschlussvorlageBody, setBeschlussvorlageBody] = useState("");
  const [savingAnschreiben, setSavingAnschreiben] = useState(false);
  const [savingBeschlussvorlage, setSavingBeschlussvorlage] = useState(false);
  const [anschreibenSaved, setAnschreibenSaved] = useState(false);
  const [beschlussvorlageSaved, setBeschlussvorlageSaved] = useState(false);
  const [templateError, setTemplateError] = useState("");

  useEffect(() => {
    async function load() {
      const [profileRes, templatesRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/weg-settlement/templates"),
      ]);
      if (profileRes.ok) {
        const data: Profile = await profileRes.json();
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setFirmName(data.firm_name ?? "");
        setSignatureText(data.signature_text ?? "");
        setSignatureHtml(data.signature_html ?? "");
        setEmail(data.email ?? "");
      }
      if (templatesRes.ok) {
        const templates: { kind: string; subject: string | null; body: string }[] = await templatesRes.json();
        const anschreiben = templates.find((t) => t.kind === "anschreiben");
        const beschlussvorlage = templates.find((t) => t.kind === "beschlussvorlage");
        setAnschreibenSubject(anschreiben?.subject ?? "");
        setAnschreibenBody(anschreiben?.body ?? "");
        setBeschlussvorlageBody(beschlussvorlage?.body ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function saveTemplate(kind: "anschreiben" | "beschlussvorlage", subject: string | null, body: string) {
    setTemplateError("");
    const setSaving = kind === "anschreiben" ? setSavingAnschreiben : setSavingBeschlussvorlage;
    const setSaved = kind === "anschreiben" ? setAnschreibenSaved : setBeschlussvorlageSaved;
    setSaving(true);
    const res = await fetch("/api/weg-settlement/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, subject, body }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setTemplateError(err.error);
    }
    setSaving(false);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    setSavingProfile(true);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName || null,
        last_name: lastName || null,
        firm_name: firmName || null,
        signature_text: signatureText || null,
        signature_html: signatureHtml || null,
      }),
    });

    if (res.ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Speichern" }));
      setProfileError(err.error);
    }
    setSavingProfile(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Die neuen Passwörter stimmen nicht überein");
      return;
    }

    setSavingPassword(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Ändern des Passworts" }));
      setPasswordError(err.error);
    }
    setSavingPassword(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto bg-slate-50 dark:bg-gray-950">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Einstellungen</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Dein Profil, Firmenname und deine E-Mail-Signatur.</p>

      <div className="space-y-6">
        {/* Persönliche Daten + Signatur */}
        <form onSubmit={handleProfileSubmit} className={cardCls}>
          <h2 className={sectionTitleCls}>Persönliche Daten</h2>
          <p className={sectionHintCls}>{email}</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>Vorname</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nachname</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mb-2">
            <label className={labelCls}>Firmenname</label>
            <input value={firmName} onChange={(e) => setFirmName(e.target.value)} className={inputCls} />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 my-6" />

          <h2 className={sectionTitleCls}>E-Mail-Signatur</h2>
          <p className={sectionHintCls}>Wird für ausgehende E-Mails verwendet. Text- und HTML-Version können unabhängig voneinander gepflegt werden.</p>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSignatureTab("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                signatureTab === "text"
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Text
            </button>
            <button
              type="button"
              onClick={() => setSignatureTab("html")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                signatureTab === "html"
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              HTML
            </button>
          </div>

          {signatureTab === "text" ? (
            <textarea
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              rows={6}
              placeholder={"Mit freundlichen Grüßen\nMax Mustermann"}
              className={`${inputCls} font-mono`}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                value={signatureHtml}
                onChange={(e) => setSignatureHtml(e.target.value)}
                rows={8}
                placeholder={"<p>Mit freundlichen Grüßen<br/><strong>Max Mustermann</strong></p>"}
                className={`${inputCls} font-mono text-xs`}
              />
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Vorschau</p>
                <div
                  className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm text-gray-900 dark:text-white min-h-[8rem]"
                  dangerouslySetInnerHTML={{ __html: signatureHtml }}
                />
              </div>
            </div>
          )}

          {profileError && <p className="text-sm text-red-500 mt-4">{profileError}</p>}

          <div className="flex items-center gap-3 pt-6 mt-2 border-t border-gray-200 dark:border-gray-800">
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
                bg-orange-500 text-white hover:bg-orange-600 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                Gespeichert
              </span>
            )}
          </div>
        </form>

        {/* Nutzerverwaltung */}
        <Link
          href="/einstellungen/nutzer"
          className={`${cardCls} flex items-center justify-between hover:border-orange-300 dark:hover:border-orange-700 transition-colors`}
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-400" />
            <div>
              <h2 className={sectionTitleCls}>Nutzerverwaltung</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Login- und Nutzungshistorie je Nutzer (nur für Administratoren).
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>

        {/* Passwort ändern */}
        <form onSubmit={handlePasswordSubmit} className={cardCls}>
          <h2 className={sectionTitleCls}>Passwort ändern</h2>
          <p className={sectionHintCls}>Mindestens 8 Zeichen.</p>

          <div className="space-y-4 mb-2">
            <div>
              <label className={labelCls}>Aktuelles Passwort</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputCls}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Neues Passwort</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Neues Passwort bestätigen</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>
          </div>

          {passwordError && <p className="text-sm text-red-500 mt-4">{passwordError}</p>}

          <div className="flex items-center gap-3 pt-6 mt-2 border-t border-gray-200 dark:border-gray-800">
            <button
              type="submit"
              disabled={savingPassword}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
                bg-orange-500 text-white hover:bg-orange-600 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              Passwort ändern
            </button>
            {passwordSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                Passwort geändert
              </span>
            )}
          </div>
        </form>

        {/* WEG-Jahresabrechnung: Anschreiben/Beschlussvorlage-Vorlagen */}
        <div className={cardCls}>
          <h2 className={sectionTitleCls}>Vorlagen · WEG-Jahresabrechnung</h2>
          <p className={sectionHintCls}>
            Anschreiben und Beschlussvorlage werden bei der Dokumenterzeugung aus diesen Vorlagen befüllt.
            Platzhalter in doppelten geschweiften Klammern werden automatisch ersetzt.
          </p>

          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Anschreiben</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Platzhalter: {"{{objekt_name}}"}, {"{{jahr}}"}, {"{{einheit}}"}, {"{{spitze_betrag}}"}, {"{{spitze_art}}"}
          </p>
          <div className="mb-2">
            <label className={labelCls}>Betreff</label>
            <input value={anschreibenSubject} onChange={(e) => setAnschreibenSubject(e.target.value)} className={inputCls} />
          </div>
          <div className="mb-3">
            <label className={labelCls}>Text</label>
            <textarea
              value={anschreibenBody}
              onChange={(e) => setAnschreibenBody(e.target.value)}
              rows={8}
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => saveTemplate("anschreiben", anschreibenSubject || null, anschreibenBody)}
              disabled={savingAnschreiben}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {savingAnschreiben && <Loader2 className="w-4 h-4 animate-spin" />}
              Anschreiben speichern
            </button>
            {anschreibenSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" /> Gespeichert
              </span>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 my-6" />

          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Beschlussvorlage</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Platzhalter: {"{{objekt_name}}"}, {"{{jahr}}"}, {"{{gesamtkosten}}"}, {"{{gesamteinnahmen}}"}
          </p>
          <div className="mb-3">
            <label className={labelCls}>Text</label>
            <textarea
              value={beschlussvorlageBody}
              onChange={(e) => setBeschlussvorlageBody(e.target.value)}
              rows={8}
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => saveTemplate("beschlussvorlage", null, beschlussvorlageBody)}
              disabled={savingBeschlussvorlage}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {savingBeschlussvorlage && <Loader2 className="w-4 h-4 animate-spin" />}
              Beschlussvorlage speichern
            </button>
            {beschlussvorlageSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" /> Gespeichert
              </span>
            )}
          </div>

          {templateError && <p className="text-sm text-red-500 mt-4">{templateError}</p>}
        </div>

        {/* Mietermatching: Einladen/Ablehnen-Vorlagen */}
        <div className={cardCls}>
          <h2 className={sectionTitleCls}>Vorlagen · Mietermatching</h2>
          <p className={sectionHintCls}>
            Werden beim Einladen bzw. Ablehnen von Mietinteressenten vorgeschlagen. Ohne eigene Vorlage wird ein
            interner Standardtext verwendet.
          </p>
          <MessageTemplatesSection />
        </div>
      </div>
    </div>
  );
}
