"use client";

import { getAccessToken } from "@/lib/admin/auth-storage";

export type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredInstallPrompt: DeferredInstallPrompt | null = null;
let installEventsReady = false;
const installPromptListeners = new Set<() => void>();

function notifyInstallPromptListeners() {
  installPromptListeners.forEach((listener) => listener());
}

function shouldCaptureInstallPrompt() {
  try {
    if (!getAccessToken()) return false;
    const compactDevice = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!compactDevice || standalone) return false;
    return Number(localStorage.getItem("bunoraa-admin-install-dismissed-until") || 0) <= Date.now();
  } catch {
    return false;
  }
}

export function subscribeToInstallPrompt(listener: () => void) {
  installPromptListeners.add(listener);
  return () => installPromptListeners.delete(listener);
}

export function hasDeferredInstallPrompt() {
  return deferredInstallPrompt !== null;
}

export async function promptToInstallAdminApp() {
  if (!deferredInstallPrompt) return null;
  const event = deferredInstallPrompt;
  await event.prompt();
  const choice = await event.userChoice;
  deferredInstallPrompt = null;
  notifyInstallPromptListeners();
  return choice;
}

function initializeInstallPromptEvents() {
  if (typeof window === "undefined" || installEventsReady) return;
  installEventsReady = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Leave the browser's native install UI available when the custom prompt
    // is not visible (desktop, installed app, or a previously dismissed tip).
    if (!shouldCaptureInstallPrompt()) return;
    event.preventDefault();
    deferredInstallPrompt = event as DeferredInstallPrompt;
    notifyInstallPromptListeners();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifyInstallPromptListeners();
  });
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  initializeInstallPromptEvents();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          void registration.update().catch(() => {
            // Registration remains available; the next load will retry the update.
          });
          console.info("[PWA] Service worker registered");
        })
        .catch(() => {
          console.warn("[PWA] Service worker registration failed");
        });
    });
  }
}

initializeInstallPromptEvents();

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}
