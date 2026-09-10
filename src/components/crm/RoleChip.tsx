import { type RoleType, roleLabel } from "@/types/crm";

const ROLE_COLORS: Record<RoleType, string> = {
  owner: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  tenant: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  subtenant: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  beirat: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  proxy: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  service_provider: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  caretaker: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  other: "bg-gray-500/15 text-gray-500 dark:text-gray-400",
};

export default function RoleChip({ role }: { role: RoleType }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ROLE_COLORS[role] ?? ROLE_COLORS.other}`}
    >
      {roleLabel(role)}
    </span>
  );
}
