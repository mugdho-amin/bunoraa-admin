"use client";

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

initializeInstallPromptEvents();

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}
