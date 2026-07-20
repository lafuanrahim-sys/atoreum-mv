"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "atoreum-theme";

type Theme = "light" | "dark";

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

function getStoredTheme(): Theme | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : null;
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = getStoredTheme() ?? getSystemTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color mode"
      className="inline-flex items-center justify-center gap-2 rounded-none border border-line px-4 py-2 text-[10px] tracking-[0.25em] uppercase text-ivory transition-colors hover:border-gold hover:text-gold"
    >
      {mounted ? (
        theme === "dark" ? (
          <>
            <span aria-hidden="true">☀️</span>
            Light
          </>
        ) : (
          <>
            <span aria-hidden="true">🌙</span>
            Dark
          </>
        )
      ) : (
        "Theme"
      )}
    </button>
  );
}
