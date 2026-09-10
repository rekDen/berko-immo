"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

export type ComboboxOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
};

export default function Combobox({
  value,
  onChange,
  options,
  placeholder = "Suchen…",
  emptyLabel = "Keine Treffer",
  disabled = false,
  allowClear = true,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Dropdown-Position berechnen (fixed, über Scrollcontainer)
  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(300, filtered.length * 36 + 56);
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    setDropdownStyle({
      position: "fixed",
      top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, [filtered.length]);

  useEffect(() => {
    function onClose(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        const dropdown = document.getElementById("combobox-portal");
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClose);
    return () => document.removeEventListener("mousedown", onClose);
  }, []);

  useEffect(() => {
    if (open) {
      setHighlight(0);
      updatePosition();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, updatePosition]);

  // Position aktualisieren wenn gescrollt / Fenster geändert
  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) select(filtered[highlight].value);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const dropdown = open ? (
    <div
      id="combobox-portal"
      style={dropdownStyle}
      className="rounded-lg border border-gray-200 bg-white shadow-xl dark:bg-gray-800 dark:border-gray-700 overflow-hidden"
    >
      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full text-sm rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 dark:bg-gray-900 dark:border-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
        />
      </div>
      <ul className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-gray-400">{emptyLabel}</li>
        ) : (
          filtered.map((o, idx) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => select(o.value)}
                onMouseEnter={() => setHighlight(idx)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  idx === highlight
                    ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                } ${o.value === value ? "font-medium" : ""}`}
              >
                {o.label}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50 flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected ? "" : "text-gray-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}
