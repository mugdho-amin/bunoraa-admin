"use client";

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          console.info("[PWA] Service worker registered");
        })
        .catch(() => {
          console.warn("[PWA] Service worker registration failed");
        });
    });
  }
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}
