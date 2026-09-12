"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  Scale,
  BookOpen,
  FileText,
  Gavel,
  Trash2,
  FileSignature,
  Clock,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { ChatMessage } from "@/types";

const KNOWLEDGE_BADGES = ["BGB", "WEG", "DSGVO", "DIN", "VDI", "VDIV", "Heizkostenverordnung", "Betriebskostenverordnung"];

const QUICK_ACTIONS = [
  { label: "Schreiben & Dokumente", keyword: "Frage die Berko AI KI welches Dokument, Schreiben, Mieterhöhung, Abmahnung, Kündigung, Übergabeprotokoll, NK-Abrechnung, WEG-Einladung Berko AI erstellen soll – professionelles Schreiben in Sekunden, mit Paragraphenangabe und Fristen." },
  { label: "Fristen & Pflichten prüfen", keyword: "Frage die Berko AI KI welches welche Fristen in meinem Fall gelten? Ankündigungsfristen, NK-Abrechnungsfristen, TÜV-Termine, Schornsteinfeger, DSGVO-Auskunftsfristen – sofort strukturiert und vollständig." },
  { label: "Rendite & Kaufpreis", keyword: "Frage die Berko AI KI nach dem Kaufpreisfaktor, Brutto- und Nettomietrendite, Instandhaltungsrücklage nach II. BV, Cashflow-Analyse, AfA-Berechnung – schnelle Entscheidungsgrundlage für Ankauf oder Beratung." },
  { label: "Schadensfall & Technik", keyword: "Frage die Berko AI KI was bei Wasserschaden, Schimmel, Heizungsausfall, Sofortmaßnahmen, Dienstleisterauftrag, Versicherungsmeldung, Mieterrechte (Mietminderung), DIN/VDI-konforme Vorgehensweise zu machen ist." },
];

const SYSTEM_MESSAGE: ChatMessage = {
  role: "system",
  content:
    "Ich bin Berko AI, Ihre Recherche-KI für deutsches Recht. Ich habe Zugriff auf BGB, ZPO, StGB, KSchG und FamFG — stets mit verlinkten Quellenangaben. Wie kann ich Ihnen helfen?",
};

/* ------------------------------------------------------------------ */
/*  Markdown rendering with link support                               */
/* ------------------------------------------------------------------ */

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let keyIndex = 0;

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${keyIndex++}`} className="my-2 space-y-1 pl-4">
          {listBuffer.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-200">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${keyIndex++}`}
          className="mb-1 mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-300"
        >
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${keyIndex++}`}
          className="mb-2 mt-3 text-base font-bold text-indigo-600 dark:text-indigo-300"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else if (line.startsWith("---")) {
      flushList();
      elements.push(
        <hr key={`hr-${keyIndex++}`} className="my-3 border-gray-700" />
      );
    } else if (line.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`bq-${keyIndex++}`}
          className="my-2 border-l-2 border-indigo-400/50 pl-3 text-sm italic text-gray-500 dark:text-gray-400"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else if (line.trim() === "") {
      flushList();
      elements.push(<div key={`br-${keyIndex++}`} className="h-2" />);
    } else {
      flushList();
      elements.push(
        <p key={`p-${keyIndex++}`} className="text-gray-700 dark:text-gray-200">
          {renderInline(line)}
        </p>
      );
    }
  }

  flushList();
  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Match markdown links [text](url) and bold **text**
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    // Markdown link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline decoration-indigo-400/40 underline-offset-2 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {linkMatch[1]}
        </a>
      );
    }
    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-gray-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Italic: *text*
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={i} className="text-gray-400">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LegalAIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([SYSTEM_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setIsStreaming(true);

      // Leere Assistenten-Nachricht für Streaming vorbereiten
      const assistantMessage: ChatMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        abortRef.current = new AbortController();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Serverfehler" }));
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: `Fehler: ${err.error ?? "Unbekannter Fehler"}`,
            };
            return updated;
          });
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          setIsStreaming(false);
          return;
        }

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);

            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: `Fehler: ${parsed.error}`,
                  };
                  return updated;
                });
                break;
              }
              if (parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.text,
                  };
                  return updated;
                });
              }
            } catch {
              // Ignore malformed JSON lines
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — keep partial response
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content:
                "Verbindungsfehler. Bitte versuchen Sie es erneut.",
            };
            return updated;
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming]
  );

  const handleClearChat = useCallback(async () => {
    try {
      await fetch("/api/chat", { method: "DELETE" });
    } catch {
      // Best-effort
    }
    setMessages([SYSTEM_MESSAGE]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  const userMessages = messages.filter((m) => m.role === "user");
  const showQuickActions = userMessages.length === 0;

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                  Berko AI Immo-KI
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Dein digitaler HV-Berater
                </p>
              </div>
            </div>
            {userMessages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors border-gray-200 text-gray-500 hover:border-red-400/50 hover:text-red-500 dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-500/50 dark:hover:text-red-400"
                title="Chat leeren"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Leeren
              </button>
            )}
          </div>

          {/* Knowledge badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Verfügbare Datenbanken:
            </span>
            {KNOWLEDGE_BADGES.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset bg-gray-100 text-indigo-600 ring-indigo-500/30 dark:bg-gray-800 dark:text-indigo-300"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message, index) => {
            if (message.role === "system") {
              return (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {message.content}
                  </div>
                </div>
              );
            }

            if (message.role === "user") {
              return (
                <div key={index} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-sm text-white shadow-sm">
                    {message.content}
                  </div>
                </div>
              );
            }

            if (message.role === "assistant") {
              return (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm bg-white border border-gray-200 dark:bg-gray-800 dark:border-transparent">
                    {message.content ? (
                      renderMarkdown(message.content)
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300 dark:bg-gray-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300 dark:bg-gray-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300 dark:bg-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Quick action buttons */}
          {showQuickActions && !isStreaming && (
            <div className="pt-4">
              <p className="mb-3 text-center text-xs text-gray-400 dark:text-gray-500">
                Häufige Themen — klicken Sie für eine sofortige Recherche:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.keyword)}
                    className="flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center text-xs font-medium transition-colors
                      border-gray-200 bg-white text-gray-500 hover:border-indigo-400/50 hover:bg-gray-50 hover:text-indigo-600
                      dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:border-indigo-500/50 dark:hover:bg-gray-800 dark:hover:text-indigo-300"
                  >
                    <QuickActionIcon label={action.label} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t px-4 py-4 border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 rounded-xl border px-4 py-2 transition-colors
            border-gray-200 bg-white focus-within:border-indigo-400/60 focus-within:ring-1 focus-within:ring-indigo-400/30
            dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-indigo-500/60 dark:focus-within:ring-indigo-500/30">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stellen Sie Ihre Rechtsfrage..."
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm outline-none disabled:opacity-50 text-gray-900 placeholder-gray-400 dark:text-white dark:placeholder-gray-500"
            />
            <button
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim() || isStreaming}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Nachricht senden"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-600">
            Berko AI ersetzt keine individuelle Rechtsberatung durch einen
            Fachanwalt.
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickActionIcon({ label }: { label: string }) {
  if (label.includes("Schreiben")) return <FileSignature className="h-5 w-5 text-indigo-400" />;
  if (label.includes("Fristen")) return <Clock className="h-5 w-5 text-indigo-400" />;
  if (label.includes("Rendite")) return <TrendingUp className="h-5 w-5 text-indigo-400" />;
  if (label.includes("Schadensfall")) return <Wrench className="h-5 w-5 text-indigo-400" />;
  return <BookOpen className="h-5 w-5 text-indigo-400" />;
}
