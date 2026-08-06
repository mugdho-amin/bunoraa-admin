"use client";

import type { BaseKey } from "@refinedev/core";
import { requestAdminData, requestAdminRaw } from "@/lib/admin/http";
import type { AdminBootstrap, AdminOptionsResponse } from "@/lib/admin/types";

export async function fetchAdminBootstrap() {
  return requestAdminData<AdminBootstrap>("/admin/bootstrap/");
}

export async function fetchOptionsForResource(resource: string, id?: BaseKey) {
  const suffix = id ? `/admin/${resource}/${id}` : `/admin/${resource}`;
  const response = await requestAdminRaw<AdminOptionsResponse | { data?: AdminOptionsResponse }>(suffix, {
    method: "OPTIONS",
  });
  // OPTIONS is normally returned as bare DRF metadata, but API gateways and
  // response middleware may wrap it in the standard {data: ...} envelope.
  // Normalize both shapes so forms can consume serializer actions reliably.
  if (response && typeof response === "object" && "data" in response) {
    const data = response.data;
    if (data && typeof data === "object" && ("actions" in data || "name" in data || "description" in data)) {
      return data;
    }
  }
  return response as AdminOptionsResponse;
}

export async function fetchOptionsForSingleton(path: string) {
  const response = await requestAdminRaw<AdminOptionsResponse | { data?: AdminOptionsResponse }>(`/admin/${path}`, {
    method: "OPTIONS",
  });
  if (response && typeof response === "object" && "data" in response) {
    const data = response.data;
    if (data && typeof data === "object" && ("actions" in data || "name" in data || "description" in data)) {
      return data;
    }
  }
  return response as AdminOptionsResponse;
}
