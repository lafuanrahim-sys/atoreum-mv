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
      aria-label="Toggle color mode"
      className="inline-flex items-center justify-center gap-2 rounded-none border border-line px-4 py-2 text-[10px] tracking-[0.25em] uppercase text-ivory transition-colors hover:border-gold hover:text-gold"
    >
      {theme === "dark" ? (
        <>
          <span aria-hidden="true">☀️</span>
          Light
        </>
      ) : (
        <>
          <span aria-hidden="true">🌙</span>
          Dark
        </>
      )}
    </button>
  );
}
