"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import CategoryTile from "./CategoryTile";

type Category = {
  category_id: string;
  code: string;
  group_code: string;
  name_de: string;
  doc_count: number;
};

const ROLE_LABELS: Record<string, string> = {
  EIGENTUEMERGEMEINSCHAFT: "Beirat, Eigentümer, Bevollmächtigter",
  OBJEKTBETREUUNG: "Beirat, Eigentümer, Mieter, Bevollmächtigter, Dienstleister",
  OBJEKTTECHNIK: "Beirat, Eigentümer, Bevollmächtigter, Dienstleister",
  OBJEKTVERWALTUNG: "Beirat, Eigentümer, Bevollmächtigter",
  RICHTLINIEN: "Beirat, Eigentümer, Bevollmächtigter, Dienstleister",
  VERWALTUNGSBEIRAT: "Beirat",
  EINHEIT_TECHNIK: "Beirat, Eigentümer, Mieter, Bevollmächtigter",
  EINHEIT_DOKUMENTE: "Beirat, Eigentümer, Mieter, Bevollmächtigter",
  VERTRAG_ABRECHNUNGEN: "Eigentümer, Mieter, Bevollmächtigter",
  VERTRAG_KORRESPONDENZ: "Eigentümer, Mieter, Bevollmächtigter",
  FINANZEN: "Beirat, Eigentümer, Bevollmächtigter",
  IMMOBILIE_DOKUMENTE: "Beirat, Eigentümer, Bevollmächtigter",
  TECHNIK_BERICHTE: "Beirat, Eigentümer, Bevollmächtigter, Dienstleister",
  KOMMUNIKATION: "Beirat, Eigentümer, Bevollmächtigter",
  WEG_VERSAMMLUNG: "Beirat, Eigentümer, Bevollmächtigter",
  MIETER_DOKUMENTE: "Eigentümer, Mieter, Bevollmächtigter",
  RECHTLICHES: "Beirat, Eigentümer, Bevollmächtigter",
  BEHOERDEN: "Beirat, Eigentümer, Bevollmächtigter",
  MANAGEMENT: "Beirat, Eigentümer, Bevollmächtigter",
};

const GROUP_DISPLAY_NAMES: Record<string, string> = {
  EIGENTUEMERGEMEINSCHAFT: "Eigentümergemeinschaft",
  OBJEKTBETREUUNG: "Objektbetreuung",
  OBJEKTTECHNIK: "Objekttechnik",
  OBJEKTVERWALTUNG: "Objektverwaltung",
  RICHTLINIEN: "Richtlinien",
  VERWALTUNGSBEIRAT: "Verwaltungsbeirat",
  EINHEIT_TECHNIK: "Einheit – Technik",
  EINHEIT_DOKUMENTE: "Einheit – Dokumente",
  VERTRAG_ABRECHNUNGEN: "Vertrag – Abrechnungen",
  VERTRAG_KORRESPONDENZ: "Vertrag – Korrespondenz",
  FINANZEN: "Finanzen",
  IMMOBILIE_DOKUMENTE: "Immobilie – Dokumente",
  TECHNIK_BERICHTE: "Technik – Berichte",
  KOMMUNIKATION: "Kommunikation",
  WEG_VERSAMMLUNG: "WEG – Versammlung",
  MIETER_DOKUMENTE: "Mieter – Dokumente",
  RECHTLICHES: "Rechtliches",
  BEHOERDEN: "Behörden",
  MANAGEMENT: "Management",
};

type Props = {
  propertyId: string;
  groupCode: string;
  categories: Category[];
};

export default function CategoryGroupSection({ propertyId, groupCode, categories }: Props) {
  const [expanded, setExpanded] = useState(true);
  const displayName = GROUP_DISPLAY_NAMES[groupCode] ?? groupCode;
  const roleHint = ROLE_LABELS[groupCode];

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full py-3 group"
        aria-expanded={expanded}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {displayName}
        </h3>
        {roleHint && (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
            ({roleHint})
          </span>
        )}
        <ChevronDown
          className={`ml-auto w-4 h-4 text-gray-400 transition-transform ${
            expanded ? "" : "-rotate-90"
          }`}
        />
      </button>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pb-4">
          {categories.map((cat) => (
            <CategoryTile
              key={cat.category_id}
              propertyId={propertyId}
              categoryId={cat.category_id}
              name={cat.name_de}
              count={Number(cat.doc_count)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
