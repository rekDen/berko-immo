"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Übersicht", suffix: "" },
  { label: "Dokumente", suffix: "/dokumente" },
  { label: "Verknüpfte Kontakte", suffix: "/nutzer" },
  { label: "Vorgänge", suffix: "/vorgaenge" },
  { label: "Termine", suffix: "/termine" },
  { label: "Kommunikation", suffix: "/kommunikation" },
  { label: "FAQs", suffix: "/faqs", disabled: true },
];

type Props = {
  propertyId: string;
  propertyName: string;
};

export default function PropertyTabBar({ propertyId, propertyName }: Props) {
  const pathname = usePathname();
  const basePath = `/objekte/${propertyId}`;

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <div className="px-6 pt-6 pb-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {propertyName}
        </h1>
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {tabs.map((tab) => {
            const href = `${basePath}${tab.suffix}`;
            const isActive =
              tab.suffix === "/dokumente"
                ? pathname.startsWith(`${basePath}/dokumente`)
                : pathname === href;

            if (tab.disabled) {
              return (
                <span
                  key={tab.label}
                  className="px-4 py-2.5 text-sm text-gray-300 dark:text-gray-600 cursor-not-allowed whitespace-nowrap"
                >
                  {tab.label}
                </span>
              );
            }

            return (
              <Link
                key={tab.label}
                href={href}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
