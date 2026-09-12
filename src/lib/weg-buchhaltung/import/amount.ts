/**
 * Wandelt einen Textbetrag in ganzzahlige Cent um — ohne parseFloat/Number()
 * auf dem Betrag (harte Regel: keine Gleitkommazahlen für Geld). Reine
 * String-Arithmetik, damit z. B. "19,99" garantiert 1999 ergibt, nie 1998
 * oder 2000 durch Fließkomma-Rundungsfehler.
 */
export function parseAmountToCents(raw: string, decimalSeparator: "," | "."): number {
  let s = raw.trim();
  if (s === "") throw new Error("Leerer Betrag");

  let negative = false;
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  else if (s.startsWith("+")) { s = s.slice(1); }
  // Manche Bank-Exports klammern negative Beträge: "(19,99)"
  if (s.startsWith("(") && s.endsWith(")")) { negative = true; s = s.slice(1, -1); }

  const thousandSeparator = decimalSeparator === "," ? "." : ",";
  s = s.split(thousandSeparator).join("");

  const parts = s.split(decimalSeparator);
  if (parts.length > 2) throw new Error(`Ungültiger Betrag: ${raw}`);

  const integerPart = parts[0].replace(/\D/g, "") || "0";
  let fractionalPart = (parts[1] ?? "").replace(/\D/g, "");
  fractionalPart = (fractionalPart + "00").slice(0, 2);

  const cents = parseInt(integerPart, 10) * 100 + parseInt(fractionalPart, 10);
  return negative ? -cents : cents;
}
