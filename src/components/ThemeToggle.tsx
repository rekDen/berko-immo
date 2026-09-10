"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Helles Design aktivieren" : "Dunkles Design aktivieren"}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
        text-gray-500 dark:text-gray-400
        hover:text-gray-900 dark:hover:text-white
        hover:bg-gray-100 dark:hover:bg-gray-800`}
    >
      <span className="flex-shrink-0">
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-400" />
        )}
      </span>
      {!collapsed && (
        <span>{isDark ? "Helles Design" : "Dunkles Design"}</span>
      )}
    </button>
  );
}
