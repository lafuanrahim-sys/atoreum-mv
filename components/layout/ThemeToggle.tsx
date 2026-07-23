"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "atoreum-theme";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("theme-dark");
    root.classList.remove("theme-light");
  } else {
    root.classList.add("theme-light");
    root.classList.remove("theme-dark");
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// The real theme lives in localStorage/matchMedia, which only exist in the
// browser — reading them for a lazy useState initializer would make the
// client's first hydration pass diverge from the server-rendered markup.
// useSyncExternalStore keeps the server snapshot ("light") for that first
// pass, then switches to the real value right after hydration completes.
function readTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : getSystemTheme();
}

function getServerTheme(): Theme {
  return "light";
}

function subscribeTheme(callback: () => void) {
  listeners.add(callback);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    mq.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
  };
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, getServerTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    listeners.forEach((listener) => listener());
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center text-ivory-dim transition-colors hover:text-gold"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
          <circle cx="12" cy="12" r="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M12 2.75v2M12 19.25v2M4.75 12h-2M21.25 12h-2M6.4 6.4 5 5M19 19l-1.4-1.4M6.4 17.6 5 19M19 5l-1.4 1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
