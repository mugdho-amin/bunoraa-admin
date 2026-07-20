"use client";

import { clearAuthState, getAccessToken, getRefreshToken, setTokens } from "@/lib/admin/auth-storage";
import type { AdminApiEnvelope } from "@/lib/admin/types";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  body?: unknown;
  headers?: HeadersInit;
  skipAuth?: boolean;
  raw?: boolean;
  retryOnAuth?: boolean;
  withCredentials?: boolean;
};

const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!rawBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL environment variable is required. Set it to your API base URL (e.g. https://api.bunoraa.com/api/v1)");
}
const API_BASE_URL = rawBaseUrl.replace(/\/$/, "");

let refreshPromise: Promise<string | null> | null = null;

export class AdminApiError extends Error {
  status: number;
  payload?: unknown;
  path?: string;

  constructor(message: string, status: number, payload?: unknown, path?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.payload = payload;
    this.path = path;
  }
}

function ensurePath(path: string) {
  const [pathname, query] = path.split("?");
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const slashed = normalized.endsWith("/") ? normalized : `${normalized}/`;
  return query ? `${slashed}?${query}` : slashed;
}

function buildApiUrl(path: string) {
  return new URL(`${API_BASE_URL}${ensurePath(path)}`);
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(payload: unknown, fallback = "Request failed") {
  if (!payload) {
    return fallback;
  }
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload !== "object") {
    return fallback;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }
  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }
  if (record.meta && typeof record.meta === "object") {
    const errors = (record.meta as Record<string, unknown>).errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && first.length > 0) {
        return String(first[0]);
      }
      if (typeof first === "string") {
        return first;
      }
    }
  }
  return fallback;
}

function hasBinary(value: unknown): boolean {
  if (typeof File !== "undefined" && value instanceof File) {
    return true;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(hasBinary);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasBinary);
  }
  return false;
}

function appendToFormData(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (typeof File !== "undefined" && value instanceof File) {
    formData.append(key, value);
    return;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    formData.append(key, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        formData.append(key, String(item));
        return;
      }
      if (typeof File !== "undefined" && item instanceof File) {
        formData.append(key, item);
        return;
      }
      formData.append(key, JSON.stringify(item));
    });
    return;
  }
  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }
  formData.append(key, String(value));
}

function serializeBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return body ? JSON.stringify(body) : undefined;
  }
  if (body instanceof FormData) {
    return body;
  }
  if (!hasBinary(body)) {
    return JSON.stringify(body);
  }
  const formData = new FormData();
  Object.entries(body as Record<string, unknown>).forEach(([key, value]) => {
    appendToFormData(formData, key, value);
  });
  return formData;
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    return null;
  }
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const response = await fetch(buildApiUrl("/auth/token/refresh/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      clearAuthState();
      return null;
    }

    const payload = await parseJson(response);
    const envelope = payload as AdminApiEnvelope<{ access?: string; refresh?: string }> | null;
    const access =
      (envelope && typeof envelope === "object" && envelope.data?.access) ||
      ((payload as Record<string, unknown> | null)?.access as string | undefined) ||
      null;

    if (access) {
      const payloadRecord = payload as Record<string, unknown> | null;
      const newRefresh =
        (payloadRecord?.refresh as string | undefined) ??
        ((payloadRecord?.data as Record<string, unknown> | undefined)?.refresh as string | undefined) ??
        refresh;
      setTokens(access, newRefresh);
      return access;
    }

    clearAuthState();
    return null;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function requestInternal<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    skipAuth = false,
    raw = false,
    retryOnAuth = true,
    withCredentials = !skipAuth,
  } = options;

  const token = skipAuth ? null : getAccessToken();
  const serializedBody = method === "GET" || method === "OPTIONS" ? undefined : serializeBody(body);
  const isFormData = typeof FormData !== "undefined" && serializedBody instanceof FormData;

  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: serializedBody as BodyInit | undefined,
    credentials: withCredentials ? "include" : "same-origin",
  });

  const payload = await parseJson(response);

  if (response.status === 401 && retryOnAuth && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestInternal<T>(path, { ...options, retryOnAuth: false });
    }
    clearAuthState();
  }

  if (!response.ok) {
    throw new AdminApiError(
      extractMessage(payload, response.statusText || "Request failed"),
      response.status,
      payload,
      path,
    );
  }

  if (raw) {
    return payload as T;
  }

  if (payload && typeof payload === "object" && "success" in (payload as Record<string, unknown>)) {
    return payload as T;
  }

  return {
    success: true,
    message: "OK",
    data: payload,
    meta: null,
  } as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function requestAdminRaw<T>(path: string, options: RequestOptions = {}) {
  return requestInternal<T>(path, { ...options, raw: true });
}

export async function requestAdminEnvelope<T>(path: string, options: RequestOptions = {}) {
  return requestInternal<AdminApiEnvelope<T>>(path, options);
}

export async function requestAdminData<T>(path: string, options: RequestOptions = {}) {
  const envelope = await requestAdminEnvelope<T>(path, options);
  return envelope.data;
}
