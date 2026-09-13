import { DOMParser } from "@xmldom/xmldom";
import { parseAmountToCents } from "./amount";
import type { NormalizedEntry, NormalizedStatement, RejectedEntry } from "./types";

function firstChildText(el: Element | null, tagName: string): string | null {
  if (!el) return null;
  const nodes = el.getElementsByTagName(tagName);
  return nodes.length > 0 ? (nodes[0].textContent ?? "").trim() || null : null;
}

function allChildrenText(el: Element | null, tagName: string): string[] {
  if (!el) return [];
  const nodes = el.getElementsByTagName(tagName);
  const result: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const t = (nodes[i].textContent ?? "").trim();
    if (t) result.push(t);
  }
  return result;
}

function firstChildTextDeep(entry: Element, containerTag: string, leafTag: string): string | null {
  const containers = entry.getElementsByTagName(containerTag);
  if (containers.length === 0) return null;
  const leaf = (containers[0] as unknown as Element).getElementsByTagName(leafTag);
  return leaf.length > 0 ? (leaf[0].textContent ?? "").trim() || null : null;
}

function detectSchemaVersion(xml: string): "002" | "008" | "unknown" {
  const m = xml.match(/camt\.053\.001\.(\d+)/);
  if (!m) return "unknown";
  if (m[1] === "02") return "002";
  if (m[1] === "08") return "008";
  return "unknown";
}

/** Bal/Amt + Bal/CdtDbtInd → vorzeichenbehaftete Cents. */
function parseBalanceAmount(bal: Element): number | null {
  const amtNodes = bal.getElementsByTagName("Amt");
  if (amtNodes.length === 0) return null;
  const amountText = (amtNodes[0].textContent ?? "").trim();
  if (!amountText) return null;
  const direction = firstChildText(bal, "CdtDbtInd");
  return parseAmountToCents(amountText, ".") * (direction === "DBIT" ? -1 : 1);
}

interface StatementBalances {
  openingBalance: number | null;
  closingBalance: number | null;
  closingDate: string | null;
}

function parseStatementBalances(stmtEl: Element): StatementBalances {
  const result: StatementBalances = { openingBalance: null, closingBalance: null, closingDate: null };
  const balNodes = stmtEl.getElementsByTagName("Bal");
  for (let i = 0; i < balNodes.length; i++) {
    const bal = balNodes[i] as unknown as Element;
    const code = firstChildTextDeep(bal, "CdOrPrtry", "Cd");
    if (code === "OPBD" || code === "PRCD") {
      result.openingBalance = parseBalanceAmount(bal);
    } else if (code === "CLBD") {
      result.closingBalance = parseBalanceAmount(bal);
      const dt = firstChildText(bal, "Dt");
      result.closingDate = dt ? dt.slice(0, 10) : null;
    }
  }
  return result;
}

interface PostingFields {
  purpose: string | null;
  counterpartyIban: string | null;
  counterpartyName: string | null;
  counterpartyBic: string | null;
  endToEndId: string | null;
  mandateId: string | null;
  bankRef: string | null;
}

/** Liest Verwendungszweck/Gegenpartei/Referenzen aus dem übergebenen Bereich
 * (entweder der ganze Ntry bei einem einzelnen Posten, oder ein einzelnes
 * TxDtls bei einer aufgeteilten Sammelbuchung). Tiefensuche, damit sowohl
 * .02 (`RltdPties/Dbtr/Nm`) als auch .08 (`RltdPties/Dbtr/Pty/Nm`) ohne
 * gesonderten Zweig funktionieren. */
function extractPostingFields(scope: Element, direction: string | null): PostingFields {
  const purposeParts = allChildrenText(scope, "Ustrd");
  const purpose = purposeParts.length > 0 ? purposeParts.join(" ") : null;

  const debtorIban = firstChildTextDeep(scope, "DbtrAcct", "IBAN");
  const creditorIban = firstChildTextDeep(scope, "CdtrAcct", "IBAN");
  const counterpartyIban = direction === "CRDT" ? debtorIban : creditorIban;

  const debtorName = firstChildTextDeep(scope, "Dbtr", "Nm");
  const creditorName = firstChildTextDeep(scope, "Cdtr", "Nm");
  const counterpartyName = direction === "CRDT" ? debtorName : creditorName;

  const counterpartyBic =
    firstChildTextDeep(scope, "RltdAgts", "BIC") ?? firstChildTextDeep(scope, "RltdAgts", "BICFI");

  const endToEndIdRaw = firstChildTextDeep(scope, "Refs", "EndToEndId");
  const endToEndId = endToEndIdRaw && endToEndIdRaw !== "NOTPROVIDED" ? endToEndIdRaw : null;
  const mandateId = firstChildTextDeep(scope, "Refs", "MndtId");
  const bankRef = firstChildText(scope, "AcctSvcrRef") ?? firstChildTextDeep(scope, "Refs", "AcctSvcrRef");

  return { purpose, counterpartyIban, counterpartyName, counterpartyBic, endToEndId, mandateId, bankRef };
}

/**
 * Parst eine CAMT.053-Kontoauszugsdatei (ISO 20022, XML) in einzelne
 * Auszüge mit ihren Buchungen (weg-buchhaltung-spec.md B5). Reine Funktion:
 * kein Datei- oder Netzwerkzugriff — der Aufrufer liest die Datei und
 * übergibt den XML-Text. Unterstützt mehrere `Stmt`-Elemente je Datei sowie
 * beide Schemaversionen (`.001.02`/`.001.08`) über dieselbe Tiefensuche.
 */
export function parseCamt053(xml: string): NormalizedStatement[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const schemaVersion = detectSchemaVersion(xml);
  const stmtNodes = doc.getElementsByTagName("Stmt");

  const statements: NormalizedStatement[] = [];
  for (let stmtIdx = 0; stmtIdx < stmtNodes.length; stmtIdx++) {
    const stmtEl = stmtNodes[stmtIdx] as unknown as Element;
    const externalId = firstChildText(stmtEl, "Id");
    const iban = firstChildTextDeep(stmtEl, "Acct", "IBAN");
    const { openingBalance, closingBalance, closingDate } = parseStatementBalances(stmtEl);

    const entries: NormalizedEntry[] = [];
    const rejectedEntries: RejectedEntry[] = [];

    const entryNodes = stmtEl.getElementsByTagName("Ntry");
    for (let entryIdx = 0; entryIdx < entryNodes.length; entryIdx++) {
      const entry = entryNodes[entryIdx] as unknown as Element;

      const status = firstChildText(entry, "Sts");
      if (status !== "BOOK") continue; // vorgemerkte (PDNG) oder sonstige Umsätze ignorieren

      const amtNodes = entry.getElementsByTagName("Amt");
      if (amtNodes.length === 0) continue;
      const amountText = (amtNodes[0].textContent ?? "").trim();
      const currency = amtNodes[0].getAttribute("Ccy") || "EUR";

      const direction = firstChildText(entry, "CdtDbtInd"); // 'CRDT' | 'DBIT'
      const bookingDateRaw = firstChildText(entry, "BookgDt") ?? firstChildText(entry, "ValDt");
      if (!bookingDateRaw) continue;
      const bookingDate = bookingDateRaw.slice(0, 10);
      const valueDateRaw = firstChildText(entry, "ValDt");
      const valueDate = valueDateRaw ? valueDateRaw.slice(0, 10) : null;

      if (currency !== "EUR") {
        const signedAmount = parseAmountToCents(amountText, ".") * (direction === "DBIT" ? -1 : 1);
        rejectedEntries.push({ reason: "Währung ungleich EUR", bookingDate, amount: signedAmount, currency });
        continue;
      }

      const entryAmount = parseAmountToCents(amountText, ".") * (direction === "DBIT" ? -1 : 1);
      const bankTxCode = {
        domainCode: firstChildTextDeep(entry, "Domn", "Cd"),
        familyCode: firstChildTextDeep(entry, "Fmly", "Cd"),
        subFamilyCode: firstChildTextDeep(entry, "Fmly", "SubFmlyCd"),
        proprietaryCode: firstChildTextDeep(entry, "Prtry", "Cd"),
      };
      const returnReasonCode = firstChildTextDeep(entry, "RtrInf", "Cd");
      const isReversal = firstChildText(entry, "RvslInd") === "true";

      const txDtlsNodes = entry.getElementsByTagName("TxDtls");
      const nbOfTxsRaw = firstChildTextDeep(entry, "Btch", "NbOfTxs");
      const nbOfTxs = nbOfTxsRaw ? parseInt(nbOfTxsRaw, 10) : null;

      const makeEntry = (
        scope: Element,
        amount: number,
        batchParentId: string | null,
        needsManualSplit: boolean,
        entryDirection: string | null,
      ): NormalizedEntry => {
        const posting = extractPostingFields(scope, entryDirection);
        return {
          bookingDate,
          valueDate,
          amount,
          currency,
          purpose: posting.purpose,
          counterpartyIban: posting.counterpartyIban,
          counterpartyName: posting.counterpartyName,
          counterpartyBic: posting.counterpartyBic,
          endToEndId: posting.endToEndId,
          mandateId: posting.mandateId,
          bankRef: posting.bankRef,
          bankTxCode:
            bankTxCode.domainCode || bankTxCode.familyCode || bankTxCode.subFamilyCode || bankTxCode.proprietaryCode
              ? bankTxCode
              : null,
          returnReasonCode,
          isReversal,
          batchParentId,
          needsManualSplit,
          raw: {
            status,
            bookingDate,
            valueDate,
            amount,
            currency,
            ...posting,
            bankTxCode,
            returnReasonCode,
            isReversal,
          },
        };
      };

      if (txDtlsNodes.length > 1) {
        const childAmounts: number[] = [];
        const childDirections: (string | null)[] = [];
        for (let i = 0; i < txDtlsNodes.length; i++) {
          const tx = txDtlsNodes[i] as unknown as Element;
          const txAmtNodes = tx.getElementsByTagName("Amt");
          const txDirection = firstChildText(tx, "CdtDbtInd") ?? direction;
          const txAmount =
            txAmtNodes.length > 0
              ? parseAmountToCents((txAmtNodes[0].textContent ?? "").trim(), ".") * (txDirection === "DBIT" ? -1 : 1)
              : 0;
          childAmounts.push(txAmount);
          childDirections.push(txDirection);
        }
        const sumMatches = childAmounts.reduce((a, b) => a + b, 0) === entryAmount;

        if (sumMatches) {
          const batchParentId = `batch:${externalId ?? iban ?? stmtIdx}:${entryIdx}`;
          for (let i = 0; i < txDtlsNodes.length; i++) {
            const tx = txDtlsNodes[i] as unknown as Element;
            entries.push(makeEntry(tx, childAmounts[i], batchParentId, false, childDirections[i]));
          }
        } else {
          entries.push(makeEntry(entry, entryAmount, null, true, direction));
        }
      } else {
        const needsManualSplit = txDtlsNodes.length <= 1 && nbOfTxs !== null && nbOfTxs > 1;
        entries.push(makeEntry(entry, entryAmount, null, needsManualSplit, direction));
      }
    }

    statements.push({ iban, externalId, schemaVersion, openingBalance, closingBalance, closingDate, entries, rejectedEntries });
  }

  return statements;
}
