"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

type ThemeState = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemTheme();
  return mode;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      resolved: "light",
      setMode: (mode: ThemeMode) => {
        const resolved = resolveTheme(mode);
        set({ mode, resolved });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", resolved);
        }
      },
    }),
    { name: "bunoraa-admin-v2:theme" },
  ),
);

export function initTheme() {
  if (typeof document === "undefined") return;
  const state = useThemeStore.getState();
  const resolved = resolveTheme(state.mode);
  document.documentElement.setAttribute("data-theme", resolved);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const current = useThemeStore.getState();
    if (current.mode === "system") {
      const newResolved = getSystemTheme();
      useThemeStore.setState({ resolved: newResolved });
      document.documentElement.setAttribute("data-theme", newResolved);
    }
  });
}
