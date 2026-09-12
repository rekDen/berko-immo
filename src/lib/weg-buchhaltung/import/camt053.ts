import { DOMParser } from "@xmldom/xmldom";
import { parseAmountToCents } from "./amount";
import type { ParsedRow } from "./types";

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

/**
 * Parst eine CAMT.053-Kontoauszugsdatei (ISO 20022, XML) in einzelne
 * Buchungen (weg-buchhaltung-spec.md 5.3.5). Reine Funktion: kein Datei-
 * oder Netzwerkzugriff — der Aufrufer liest die Datei und übergibt den
 * XML-Text. Liest je Ntry (Eintrag): Betrag, Richtung (CdtDbtInd),
 * Buchungsdatum, Verwendungszweck (RmtInf/Ustrd), Gegenkonto-IBAN.
 */
export function parseCamt053(xml: string): ParsedRow[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const entries = doc.getElementsByTagName("Ntry");

  const rows: ParsedRow[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as unknown as Element;

    const amtEl = entry.getElementsByTagName("Amt")[0] as unknown as Element | undefined;
    if (!amtEl) continue;
    const amountText = (amtEl.textContent ?? "").trim();

    const direction = firstChildText(entry, "CdtDbtInd"); // 'CRDT' | 'DBIT'
    const bookingDateRaw =
      firstChildText(entry, "BookgDt") ?? firstChildText(entry, "ValDt");
    // BookgDt/ValDt enthalten ein <Dt> oder <DtTm>-Kindelement; textContent
    // des Elternelements liefert bereits nur den Text der Blattelemente.
    if (!bookingDateRaw) continue;
    const bookingDate = bookingDateRaw.slice(0, 10);

    const purposeParts = allChildrenText(entry, "Ustrd");
    const purpose = purposeParts.length > 0 ? purposeParts.join(" ") : null;

    // Gegenkonto: bei Gutschrift (CRDT) ist der Debitor die Gegenpartei,
    // bei Belastung (DBIT) der Kreditor.
    const debtorIban = firstChildTextDeep(entry, "DbtrAcct", "IBAN");
    const creditorIban = firstChildTextDeep(entry, "CdtrAcct", "IBAN");
    const counterpartyIban = direction === "CRDT" ? debtorIban : creditorIban;

    // Name der Gegenpartei (B8.2 Stufe 2: Namensähnlichkeit) — <Dbtr>/<Cdtr>
    // sind eigene PartyIdentification-Elemente neben <DbtrAcct>/<CdtrAcct>.
    const debtorName = firstChildTextDeep(entry, "Dbtr", "Nm");
    const creditorName = firstChildTextDeep(entry, "Cdtr", "Nm");
    const counterpartyName = direction === "CRDT" ? debtorName : creditorName;

    const signedAmount = parseAmountToCents(amountText, ".") * (direction === "DBIT" ? -1 : 1);

    rows.push({
      bookingDate,
      amount: signedAmount,
      purpose,
      counterpartyIban,
      counterpartyName,
    });
  }
  return rows;
}

function firstChildTextDeep(entry: Element, containerTag: string, leafTag: string): string | null {
  const containers = entry.getElementsByTagName(containerTag);
  if (containers.length === 0) return null;
  const leaf = (containers[0] as unknown as Element).getElementsByTagName(leafTag);
  return leaf.length > 0 ? (leaf[0].textContent ?? "").trim() || null : null;
}
