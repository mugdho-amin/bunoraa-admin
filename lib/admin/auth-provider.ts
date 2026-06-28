"use client";

import type { AuthProvider } from "@refinedev/core";
import {
  clearAuthState,
  clearPendingMfaChallenge,
  getAccessToken,
  getPendingMfaChallenge,
  setPendingMfaChallenge,
  setTokens,
} from "@/lib/admin/auth-storage";
import { AdminApiError, requestAdminData } from "@/lib/admin/http";
import type { AdminBootstrap, PendingMfaChallenge } from "@/lib/admin/types";

type LoginResponse = {
  access?: string;
  refresh?: string;
  mfa_required?: boolean;
  mfa_token?: string;
  methods?: string[];
};

export async function loginWithPassword(email: string, password: string) {
  const data = await requestAdminData<LoginResponse>("/auth/token/", {
    method: "POST",
    body: { email, password },
    skipAuth: true,
  });

  if (data.mfa_required && data.mfa_token) {
    const challenge: PendingMfaChallenge = {
      email,
      mfaToken: data.mfa_token,
      methods: Array.isArray(data.methods) ? data.methods : ["totp"],
    };
    setPendingMfaChallenge(challenge);
    return { requiresMfa: true, methods: challenge.methods };
  }

  if (!data.access) {
    throw new AdminApiError("Login did not return an access token.", 500);
  }

  setTokens(data.access, data.refresh ?? null);
  clearPendingMfaChallenge();
  return { requiresMfa: false, methods: [] as string[] };
}

export async function verifyMfaCode(method: string, code: string) {
  const challenge = getPendingMfaChallenge();
  if (!challenge) {
    throw new AdminApiError("MFA challenge not found. Please sign in again.", 400);
  }

  const data = await requestAdminData<LoginResponse>("/accounts/mfa/verify/", {
    method: "POST",
    body: {
      mfa_token: challenge.mfaToken,
      method,
      code,
    },
    skipAuth: true,
  });

  if (!data.access) {
    throw new AdminApiError("MFA verification did not return an access token.", 500);
  }

  setTokens(data.access, data.refresh ?? null);
  clearPendingMfaChallenge();
}

export const authProvider: AuthProvider = {
  login: async () => ({
    success: true,
    redirectTo: "/dashboard",
  }),
  logout: async () => {
    clearAuthState();
    return {
      success: true,
      redirectTo: "/login",
    };
  },
  check: async () => {
    if (getAccessToken()) {
      return {
        authenticated: true,
      };
    }
    return {
      authenticated: false,
      redirectTo: "/login",
    };
  },
  onError: async (error) => {
    if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
      clearAuthState();
      return {
        logout: true,
        redirectTo: "/login",
        error,
      };
    }
    return {
      error,
    };
  },
  getPermissions: async () => {
    const bootstrap = await requestAdminData<AdminBootstrap>("/admin/bootstrap/");
    return bootstrap.authorization.permissions;
  },
  getIdentity: async () => {
    const bootstrap = await requestAdminData<AdminBootstrap>("/admin/bootstrap/");
    return bootstrap.identity;
  },
};
