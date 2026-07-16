"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

type ThemeState = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

const THEME_COLOR_LIGHT = "#f3f5f9";
const THEME_COLOR_DARK = "#0b1120";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemTheme();
  return mode;
}

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  const meta = document.querySelector("meta[name=\"theme-color\"]");
  if (meta) meta.setAttribute("content", resolved === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      resolved: "light",
      setMode: (mode: ThemeMode) => {
        const resolved = resolveTheme(mode);
        set({ mode, resolved });
        applyTheme(resolved);
      },
    }),
    { name: "bunoraa-admin-v2:theme" },
  ),
);

export function initTheme() {
  if (typeof document === "undefined") return;
  const state = useThemeStore.getState();
  const resolved = resolveTheme(state.mode);
  applyTheme(resolved);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const current = useThemeStore.getState();
    if (current.mode === "system") {
      const newResolved = getSystemTheme();
      useThemeStore.setState({ resolved: newResolved });
      applyTheme(newResolved);
    }
  });
}
