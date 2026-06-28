"use client";

import type { PendingMfaChallenge } from "@/lib/admin/types";

const ACCESS_TOKEN_KEY = "bunoraa-admin-v2:access-token";
const REFRESH_TOKEN_KEY = "bunoraa-admin-v2:refresh-token";
const MFA_CHALLENGE_KEY = "bunoraa-admin-v2:mfa-challenge";
const AUTH_EVENT_NAME = "bunoraa-admin-v2:auth";

function emitAuthChange() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
}

export function subscribeToAuthChanges(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(AUTH_EVENT_NAME, listener);
  return () => window.removeEventListener(AUTH_EVENT_NAME, listener);
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh?: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
  emitAuthChange();
}

export function clearAuthState() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(MFA_CHALLENGE_KEY);
  emitAuthChange();
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export function setPendingMfaChallenge(challenge: PendingMfaChallenge) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(MFA_CHALLENGE_KEY, JSON.stringify(challenge));
  emitAuthChange();
}

export function getPendingMfaChallenge(): PendingMfaChallenge | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(MFA_CHALLENGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PendingMfaChallenge;
    if (
      typeof parsed?.email === "string" &&
      typeof parsed?.mfaToken === "string" &&
      Array.isArray(parsed?.methods)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function clearPendingMfaChallenge() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(MFA_CHALLENGE_KEY);
  emitAuthChange();
}
