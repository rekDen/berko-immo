"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2, MessageSquare, Send } from "lucide-react";
import {
  type SettlementDetailResponse, formatCents, StatusBadge, SeverityBadge,
  inputCls, cardCls,
} from "./shared";
import { DocumentsPanel } from "./DocumentsPanel";
import { HeatingImportPanel } from "./HeatingImportPanel";

export function SettlementDetail({
  propertyId, settlementId, onChange, onError,
}: {
  propertyId: string; settlementId: string; onChange: () => void; onError: (msg: string) => void;
}) {
  const [data, setData] = useState<SettlementDetailResponse | null>(null);
  const [costTypeNames, setCostTypeNames] = useState<Record<string, string>>({});
  const [bankAccountLabels, setBankAccountLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [resolutionDate, setResolutionDate] = useState(new Date().toISOString().slice(0, 10));
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [detailRes, costTypesRes, bankAccountsRes] = await Promise.all([
      fetch(`/api/weg-settlement/settlements/${settlementId}`),
      fetch(`/api/weg-buchhaltung/cost-types?property_id=${propertyId}`),
      fetch(`/api/weg-buchhaltung/bank-accounts?property_id=${propertyId}`),
    ]);
    if (detailRes.ok) setData(await detailRes.json());
    if (costTypesRes.ok) {
      const costTypes: { id: string; name: string }[] = await costTypesRes.json();
      setCostTypeNames(Object.fromEntries(costTypes.map((c) => [c.id, c.name])));
    }
    if (bankAccountsRes.ok) {
      const bankAccounts: { id: string; label: string }[] = await bankAccountsRes.json();
      setBankAccountLabels(Object.fromEntries(bankAccounts.map((b) => [b.id, b.label])));
    }
    setLoading(false);
  }, [settlementId, propertyId]);

  useEffect(() => { load(); }, [load]);

  const costTypeName = (id: string) => costTypeNames[id] ?? `${id.slice(0, 8)}…`;
  const bankAccountLabel = (id: string) => bankAccountLabels[id] ?? `${id.slice(0, 8)}…`;

  async function transition(status: string, extra?: Record<string, unknown>) {
    setTransitioning(true);
    const res = await fetch(`/api/weg-settlement/settlements/${settlementId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    });
    if (res.ok) { await load(); onChange(); } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Statuswechsel" }));
      onError(err.error);
    }
    setTransitioning(false);
  }

  async function acknowledge(checkId: string) {
    const res = await fetch(`/api/weg-settlement/settlements/${settlementId}/acknowledge`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ check_id: checkId }),
    });
    if (res.ok) load(); else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Quittieren" }));
      onError(err.error);
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPostingComment(true);
    const res = await fetch(`/api/weg-settlement/settlements/${settlementId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: commentText }),
    });
    if (res.ok) { setCommentText(""); load(); } else {
      const err = await res.json().catch(() => ({ error: "Fehler beim Kommentieren" }));
      onError(err.error);
    }
    setPostingComment(false);
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  const { settlement, units, comments, acknowledgements, checks } = data;
  const result = settlement.result_snapshot;
  const blocking = checks.filter((c) => c.severity === "blocking");
  const warnings = checks.filter((c) => c.severity === "warning");
  const infos = checks.filter((c) => c.severity === "info");
  const acknowledgedIds = new Set(acknowledgements.map((a) => a.check_id));
  const unacknowledgedWarnings = warnings.filter((w) => !acknowledgedIds.has(w.id));

  const canReview = settlement.status === "draft";
  const canFinal = settlement.status === "review";
  const finalBlocked = blocking.length > 0 || unacknowledgedWarnings.length > 0;
  const canResolve = settlement.status === "final";
  const canSupersede = settlement.status !== "resolved" && settlement.status !== "superseded";

  return (
    <div className={`${cardCls} p-4 space-y-5`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Abrechnung {settlement.year} · v{settlement.version}
          </h3>
          <StatusBadge status={settlement.status} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canReview && (
            <button onClick={() => transition("review")} disabled={transitioning}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
              Zur Prüfung freigeben
            </button>
          )}
          {canFinal && (
            <button onClick={() => transition("final")} disabled={transitioning || finalBlocked}
              title={finalBlocked ? "Blockierende Prüfungen offen oder Warnungen nicht quittiert" : undefined}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
              Finalisieren
            </button>
          )}
          {canResolve && (
            <>
              <input type="date" value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} className={inputCls} />
              <button onClick={() => transition("resolved", { resolution_date: resolutionDate })} disabled={transitioning}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                Beschluss erfassen
              </button>
            </>
          )}
          {canSupersede && (
            <button onClick={() => transition("superseded")} disabled={transitioning}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700">
              Als überholt markieren
            </button>
          )}
        </div>
      </div>

      {settlement.resolution_date && (
        <p className="text-xs text-gray-400">Beschlossen zum {settlement.resolution_date}</p>
      )}

      {/* Heizkostenimport (M3) */}
      <HeatingImportPanel propertyId={settlement.property_id} year={settlement.year} onError={onError} />

      {/* Prüfungen */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Prüfungen ({blocking.length} blockierend, {unacknowledgedWarnings.length}/{warnings.length} offene Warnungen, {infos.length} Hinweise)
        </h4>
        {checks.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Keine Befunde.</p>
        ) : (
          <ul className="space-y-1.5">
            {checks.map((c, i) => (
              <li key={`${c.id}-${i}`} className="flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <span className="flex items-center gap-2 min-w-0">
                  <SeverityBadge severity={c.severity} />
                  <span className="font-mono text-xs text-gray-400">{c.id}</span>
                  <span className="text-gray-700 dark:text-gray-300 truncate">{c.message}</span>
                </span>
                {c.severity === "warning" && (
                  acknowledgedIds.has(c.id) ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">quittiert</span>
                  ) : (
                    <button onClick={() => acknowledge(c.id)} className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 shrink-0">
                      Quittieren
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Einheiten K/E/R/V/S */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Einzelabrechnungen</h4>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-medium">Einheit</th>
                <th className="px-4 py-2 font-medium text-right">Kosten (K)</th>
                <th className="px-4 py-2 font-medium text-right">Einnahmen (E)</th>
                <th className="px-4 py-2 font-medium text-right">Soll-Vorschuss (V)</th>
                <th className="px-4 py-2 font-medium text-right">Spitze (S)</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.unit_id} className="border-t border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{u.units?.unit_number ?? "–"}</td>
                  <td className="px-4 py-2 text-right">{formatCents(u.costs)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(u.income)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(u.advances_due)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${u.balance > 0 ? "text-red-600 dark:text-red-400" : u.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {formatCents(u.balance)} {u.balance > 0 ? "(Nachschuss)" : u.balance < 0 ? "(Guthaben)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gesamtabrechnung / Kontenabstimmung */}
      {result && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Kontenabstimmung</h4>
          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 font-medium">Konto</th>
                  <th className="px-4 py-2 font-medium text-right">Anfangsbestand</th>
                  <th className="px-4 py-2 font-medium text-right">Zugänge</th>
                  <th className="px-4 py-2 font-medium text-right">Abgänge</th>
                  <th className="px-4 py-2 font-medium text-right">Endbestand (berechnet)</th>
                  <th className="px-4 py-2 font-medium text-right">Kontoauszug</th>
                </tr>
              </thead>
              <tbody>
                {result.bankReconciliations.map((r) => (
                  <tr key={r.bankAccountId} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{bankAccountLabel(r.bankAccountId)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(r.openingBalance)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCents(r.totalIn)}</td>
                    <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatCents(r.totalOut)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(r.computedClosing)}</td>
                    <td className={`px-4 py-2 text-right ${r.matches ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {r.confirmedClosing !== null ? formatCents(r.confirmedClosing) : "–"} {r.matches ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gesamtabrechnung — Kostenarten */}
      {result && result.costTypeBreakdowns.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Kostenarten</h4>
          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 font-medium">Kostenart</th>
                  <th className="px-4 py-2 font-medium">Richtung</th>
                  <th className="px-4 py-2 font-medium text-right">Gesamtbetrag</th>
                </tr>
              </thead>
              <tbody>
                {result.costTypeBreakdowns.map((b) => (
                  <tr key={b.costTypeId} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{costTypeName(b.costTypeId)}</td>
                    <td className="px-4 py-2 text-gray-500">{b.direction === "expense" ? "Ausgabe" : "Einnahme"}</td>
                    <td className="px-4 py-2 text-right">{formatCents(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rücklagenentwicklung */}
      {result && result.reserveDevelopments.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Rücklagenentwicklung</h4>
          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 font-medium">Konto</th>
                  <th className="px-4 py-2 font-medium text-right">Anfangsbestand</th>
                  <th className="px-4 py-2 font-medium text-right">Soll-Zuführung</th>
                  <th className="px-4 py-2 font-medium text-right">Ist-Zuführung</th>
                  <th className="px-4 py-2 font-medium text-right">Entnahmen</th>
                  <th className="px-4 py-2 font-medium text-right">Zinsen</th>
                  <th className="px-4 py-2 font-medium text-right">Endbestand</th>
                </tr>
              </thead>
              <tbody>
                {result.reserveDevelopments.map((r) => (
                  <tr key={r.bankAccountId} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{bankAccountLabel(r.bankAccountId)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(r.openingBalance)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(r.sollZufuehrung)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(r.istZufuehrung)}</td>
                    <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatCents(r.entnahmen)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCents(r.zinsen)}</td>
                    <td className={`px-4 py-2 text-right ${r.matches ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCents(r.computedClosing)} {r.matches ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.reserveDevelopments.some((r) => r.zufuehrungDifferenz !== 0) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
              Abweichung zwischen Soll- und Ist-Zuführung vorhanden (rückständige Zuführung, s. 5.6).
            </p>
          )}
        </div>
      )}

      {/* Vermögensbericht */}
      {result && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Vermögensbericht <span className="normal-case text-gray-400 font-normal">(nicht Gegenstand des Beschlusses)</span>
          </h4>
          <div className={`${cardCls} p-4 space-y-2 text-sm`}>
            {result.assetReport.bankBalances.map((b) => (
              <div key={b.bankAccountId} className="flex justify-between">
                <span className="text-gray-500">{bankAccountLabel(b.bankAccountId)} ({b.kind === "operating" ? "Bewirtschaftung" : "Rücklage"})</span>
                <span>{b.balance !== null ? formatCents(b.balance) : "–"}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
              <span className="text-gray-500">Offene Forderungen gegen Eigentümer</span>
              <span>{formatCents(result.assetReport.receivablesTotal)}</span>
            </div>
            {result.assetReport.liabilities.map((l, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-500">{l.label} (Verbindlichkeit)</span>
                <span className="text-red-600 dark:text-red-400">{formatCents(l.amount)}</span>
              </div>
            ))}
            {result.assetReport.otherAssets.map((a, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-500">{a.label}{a.note ? ` (${a.note})` : ""}</span>
                <span>{a.amount !== null ? formatCents(a.amount) : "–"}</span>
              </div>
            ))}
            {result.assetReport.liabilities.length === 0 && result.assetReport.otherAssets.length === 0 && (
              <p className="text-xs text-gray-400">Keine weiteren Vermögens-/Verbindlichkeitspositionen erfasst.</p>
            )}
          </div>
        </div>
      )}

      {/* Sonderumlagen */}
      {result && result.specialLevies.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Sonderumlagen</h4>
          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 font-medium">Zweck</th>
                  <th className="px-4 py-2 font-medium text-right">Soll</th>
                  <th className="px-4 py-2 font-medium text-right">Ist</th>
                  <th className="px-4 py-2 font-medium text-right">Offen</th>
                </tr>
              </thead>
              <tbody>
                {result.specialLevies.map((l) => (
                  <tr key={l.id} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{l.purpose}</td>
                    <td className="px-4 py-2 text-right">{formatCents(l.soll)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCents(l.ist)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(l.offen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dokumente (PDF-Export, M5) */}
      <DocumentsPanel
        settlementId={settlementId}
        canGenerate={settlement.status === "final" || settlement.status === "resolved"}
        onError={onError}
      />

      {/* Kommentare (Beiratsprüfung) */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Kommentare
        </h4>
        <div className="space-y-2 mb-3">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-400">Noch keine Kommentare.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-gray-700 dark:text-gray-300">{c.text}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleString("de-DE")}</p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={postComment} className="flex gap-2">
          <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Kommentar hinzufügen…" className={`${inputCls} flex-1`} />
          <button type="submit" disabled={postingComment || !commentText.trim()} className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5">
            {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>

      <p className="text-xs text-gray-400">
        Engine {settlement.engine_version} · Objekt {settlement.property_id.slice(0, 8)}…
      </p>
    </div>
  );
}
