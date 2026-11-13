"use client";

import { requestAdminData, requestAdminRaw } from "@/lib/admin/http";
import type { AdminBootstrap, AdminOptionsResponse } from "@/lib/admin/types";

export async function fetchAdminBootstrap() {
  return requestAdminData<AdminBootstrap>("/admin/bootstrap/");
}

export async function fetchOptionsForResource(resource: string) {
  const suffix = `/admin/schema/${resource}/`;
  const response = await requestAdminRaw<AdminOptionsResponse | { data?: AdminOptionsResponse }>(suffix, {
    method: "GET",
  });
  return normalizeOptionsResponse(response);
}

export async function fetchOptionsForSingleton(path: string) {
  const response = await requestAdminRaw<AdminOptionsResponse | { data?: AdminOptionsResponse }>(`/admin/${path}`, {
    method: "OPTIONS",
  });
  return normalizeOptionsResponse(response);
}

/** Accept bare DRF metadata plus one or more API/gateway envelope layers. */
function normalizeOptionsResponse(response: unknown): AdminOptionsResponse {
  let current = response;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") break;
    const record = current as Record<string, unknown>;
    if (record.actions && typeof record.actions === "object") {
      return record as AdminOptionsResponse;
    }
    if (!("data" in record)) break;
    current = record.data;
  }
  return (current && typeof current === "object" ? current : {}) as AdminOptionsResponse;
}
