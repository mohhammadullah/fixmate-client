"use client";

import { useSyncExternalStore } from "react";

/**
 * FixMate theme system
 * --------------------
 * Single source of truth: the `.dark` class on <html>, persisted to
 * localStorage under "fixmate-theme". Default is dark; the user's manual
 * toggle is never overridden automatically.
 *
 * Implemented as a tiny external store consumed with useSyncExternalStore,
 * so no effects/setState loops are needed and concurrent rendering stays
 * consistent. The server snapshot is always "dark", matching the inline
 * bootstrap script's default (see layout.tsx).
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "fixmate-theme";

const listeners = new Set<() => void>();

function readDomTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);

  // Keep multiple tabs in sync.
  function handleStorage(event: StorageEvent) {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(event.newValue === "light" ? "light" : "dark");
    }
  }

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getThemeSnapshot(): Theme {
  return readDomTheme();
}

export function getServerThemeSnapshot(): Theme {
  return "dark";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode, disabled cookies) — theme still
    // applies for the current session.
  }
  emitChange();
}

export function toggleTheme() {
  applyTheme(readDomTheme() === "dark" ? "light" : "dark");
}

function subscribeMounted() {
  return () => {};
}

/** True only after hydration — lets us render an identical placeholder on
 *  the server to avoid hydration mismatches. */
function useMounted() {
  return useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
}

export default function ThemeToggle() {
  const mounted = useMounted();
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  // Stable, same-sized placeholder before hydration — no layout shift,
  // no hydration warning.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle color theme"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        disabled
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-heading transition-colors duration-200 hover:bg-surface-muted"
    >
      {isDark ? (
        // Sun — click to switch to light
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon — click to switch to dark
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
