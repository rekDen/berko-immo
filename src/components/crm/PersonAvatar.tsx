const COLORS = [
  "from-blue-500 to-blue-600",
  "from-emerald-500 to-emerald-600",
  "from-violet-500 to-violet-600",
  "from-amber-500 to-amber-600",
  "from-pink-500 to-pink-600",
  "from-cyan-500 to-cyan-600",
  "from-indigo-500 to-indigo-600",
  "from-rose-500 to-rose-600",
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

type Props = {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

export default function PersonAvatar({
  firstName,
  lastName,
  companyName,
  size = "md",
}: Props) {
  const name = companyName || [firstName, lastName].filter(Boolean).join(" ") || "?";
  const initials = companyName
    ? companyName.slice(0, 2).toUpperCase()
    : [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const color = COLORS[hashString(name) % COLORS.length];

  return (
    <div
      className={`${SIZES[size]} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white flex-shrink-0`}
      title={name}
    >
      {initials}
    </div>
  );
}
