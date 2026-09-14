// Match-Kreis (Donut-Chart), Spec §5.1. Handgerollte SVG-Komponente — im
// Repo ist keine Chart-Bibliothek als Dependency vorhanden (verifiziert).
// Farbbänder sind in MM1 fest kodiert; Spec sieht Tenant-Konfiguration vor
// (MM4-Scope).

function bandColor(score: number): string {
  if (score >= 80) return "#16a34a"; // grün
  if (score >= 50) return "#d97706"; // amber
  return "#dc2626"; // rot
}

export function MatchCircle({ score, confidence, size = "sm" }: { score: number; confidence?: number; size?: "sm" | "lg" }) {
  const dimension = size === "lg" ? 120 : 40;
  const stroke = size === "lg" ? 10 : 5;
  const radius = dimension / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const color = bandColor(clamped);
  const lowConfidence = confidence !== undefined && confidence < 0.7;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dimension, height: dimension }}>
      <svg width={dimension} height={dimension} className="-rotate-90">
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={stroke} />
        <circle
          cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className={`absolute font-semibold text-gray-800 dark:text-gray-100 ${size === "lg" ? "text-2xl" : "text-[10px]"}`}>
        {Math.round(clamped)}%
      </span>
      {lowConfidence && (
        <span
          title="Angaben unvollständig"
          className={`absolute ${size === "lg" ? "-top-1 -right-1 w-5 h-5 text-[11px]" : "-top-0.5 -right-0.5 w-3 h-3 text-[8px]"} flex items-center justify-center rounded-full bg-amber-400 text-white font-bold`}
        >
          !
        </span>
      )}
    </div>
  );
}
