"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon";

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * A typable dropdown: filters `options` as the user types, but still submits
 * through a hidden `name` input so server actions read it exactly like the
 * native `<select>` it replaces — no action.ts changes needed at call sites.
 */
export function Combobox({
  name,
  options,
  placeholder = "Type to search…",
  required,
  defaultValue,
}: {
  name: string;
  options: ComboboxOption[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const initial = options.find((o) => o.value === defaultValue) ?? null;
  const [query, setQuery] = useState(initial?.label ?? "");
  const [selected, setSelected] = useState<ComboboxOption | null>(initial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || selected?.label === query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options, selected]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // If the field is closed with typed text that doesn't match a real
  // option, snap back to the selected label (or empty) so the hidden
  // value submitted to the server and the visible text never disagree.
  useEffect(() => {
    if (open) return;
    const match = options.find((o) => o.label === query);
    if (match) {
      setSelected(match);
    } else {
      setSelected(null);
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-1">
      <input type="hidden" name={name} value={selected?.value ?? ""} required={required} />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none">
        <Icon name="map-pin" size={16} />
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="pl-9 pr-8"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)] pointer-events-none">
        <Icon name="chevron-right" size={14} className="rotate-90" />
      </span>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--muted)]">No matching areas</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface)]"
                  onClick={() => {
                    setSelected(o);
                    setQuery(o.label);
                    setOpen(false);
                  }}
                >
                  {o.label}
                  {selected?.value === o.value && (
                    <span style={{ color: "var(--trust)" }}>
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
