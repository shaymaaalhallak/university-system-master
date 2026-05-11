"use client";
import { useState, useRef, useEffect } from "react";

type Option = { value: string | number; label: string };

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  disabled = false,
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.value) === String(value));
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder={disabled ? "" : placeholder}
        value={disabled ? "" : open ? search : selected ? selected.label : ""}
        onChange={(e) => {
          if (disabled) return;
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setSearch("");
        }}
        disabled={disabled}
        className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm disabled:opacity-50"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#DED7CB] bg-white shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="block w-full text-left px-3 py-2 text-sm hover:bg-[#F1EFEA] border-b border-gray-100 last:border-b-0"
              onClick={() => {
                onChange(String(opt.value));
                setOpen(false);
                setSearch("");
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#DED7CB] bg-white shadow-lg p-3 text-sm text-gray-500">
          No results found
        </div>
      )}
    </div>
  );
}
