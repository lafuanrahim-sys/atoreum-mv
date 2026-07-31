"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type LuxSelectOption = {
  value: string;
  label: string;
  /** Optional annotation, e.g. a product count. */
  meta?: string;
};

/**
 * Custom listbox replacing native <select> for the storefront's filter bars.
 * The OS-rendered popup (blue system highlight, default fonts) broke the
 * brand surface completely — this keeps the closed trigger consistent with
 * the site's input styling and renders the open panel with our own tokens.
 *
 * Two layouts:
 * - "vertical" (default): classic dropdown below the trigger.
 * - "horizontal": options fan out beside the trigger as a row of pills,
 *   wrapping onto extra rows when they run out of width.
 *
 * Follows the WAI-ARIA listbox pattern: the trigger keeps focus while the
 * arrow keys move aria-activedescendant, Enter/Space commit, Esc closes,
 * Home/End jump, and single-character keys jump to the next match.
 */
export default function LuxSelect({
  label,
  value,
  options,
  onChange,
  orientation = "vertical",
}: {
  label: string;
  value: string;
  options: LuxSelectOption[];
  onChange: (value: string) => void;
  orientation?: "vertical" | "horizontal";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const selected = options[selectedIndex];
  const horizontal = orientation === "horizontal";

  const openList = useCallback(() => {
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [options, value]);

  const commit = useCallback(
    (index: number) => {
      const opt = options[index];
      if (opt) onChange(opt.value);
      setOpen(false);
    },
    [options, onChange]
  );

  // Close when clicking anywhere outside the component.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the active option scrolled into view while navigating a long list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
    const prevKey = horizontal ? "ArrowLeft" : "ArrowUp";
    if (!open) {
      if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case nextKey:
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case prevKey:
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        // Type-ahead: jump to the next option starting with the pressed key.
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const lower = e.key.toLowerCase();
          const start = activeIndex + 1;
          const order = [...options.slice(start), ...options.slice(0, start)];
          const found = order.findIndex((o) => o.label.toLowerCase().startsWith(lower));
          if (found !== -1) setActiveIndex((start + found) % options.length);
        }
      }
    }
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ivory-dim">{label}</span>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open ? `${id}-opt-${activeIndex}` : undefined}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
          className="flex min-h-11 w-full min-w-44 cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-transparent px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-ivory-dim focus:border-gold focus:outline-none"
        >
          <span className="truncate text-ivory">{selected?.label}</span>
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`h-3 w-3 shrink-0 text-gold transition-transform duration-200 motion-reduce:transition-none ${
              horizontal ? (open ? "-rotate-90" : "rotate-90") : open ? "rotate-180" : ""
            }`}
          >
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <ul
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={label}
            aria-orientation={orientation}
            className={
              horizontal
                ? "lux-select-panel-h absolute left-full top-0 z-40 ml-3 flex w-max max-w-[min(56rem,60vw)] flex-wrap items-center gap-2"
                : "lux-select-panel-v absolute left-0 top-full z-40 mt-2 max-h-80 w-max min-w-full max-w-72 overflow-y-auto rounded-md border border-line bg-ink-2/95 py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
            }
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={opt.value}
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActiveIndex(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => commit(i)}
                  className={
                    horizontal
                      ? `flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-xs uppercase tracking-[0.15em] backdrop-blur-md transition-colors duration-100 ${
                          isSelected
                            ? "border-gold bg-ink-2/95 text-gold"
                            : isActive
                              ? "border-ivory-dim bg-ink-2/95 text-gold"
                              : "border-line bg-ink-2/95 text-ivory-dim"
                        }`
                      : `relative flex min-h-10 cursor-pointer items-center justify-between gap-4 px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors duration-100 ${
                          isActive ? "bg-ink/50 text-gold" : isSelected ? "text-gold" : "text-ivory-dim"
                        }`
                  }
                >
                  {!horizontal && isSelected && (
                    <span aria-hidden="true" className="absolute inset-y-2 left-0 w-px bg-gold" />
                  )}
                  <span className="truncate">{opt.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {opt.meta && (
                      <span className="text-[10px] tracking-normal text-ivory-dim/70 tabular-nums">
                        {opt.meta}
                      </span>
                    )}
                    {isSelected && (
                      <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 text-gold">
                        <path d="M2 6.5L4.8 9 10 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </label>
  );
}
