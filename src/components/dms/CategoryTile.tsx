"use client";

import Link from "next/link";

type Props = {
  propertyId: string;
  categoryId: string;
  name: string;
  count: number;
};

export default function CategoryTile({ propertyId, categoryId, name, count }: Props) {
  return (
    <Link
      href={`/objekte/${propertyId}/dokumente/${categoryId}`}
      className="flex items-center justify-between px-4 py-3 rounded-lg transition-colors
        bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50
        dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
    >
      <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
      {count > 0 && (
        <span
          className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-semibold rounded-full
            bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
          aria-label={`${count} Dokumente`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
