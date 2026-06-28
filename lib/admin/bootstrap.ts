"use client";

import type { BaseKey } from "@refinedev/core";
import { requestAdminData, requestAdminRaw } from "@/lib/admin/http";
import type { AdminBootstrap, AdminOptionsResponse } from "@/lib/admin/types";

export async function fetchAdminBootstrap() {
  return requestAdminData<AdminBootstrap>("/admin/bootstrap/");
}

export async function fetchOptionsForResource(resource: string, id?: BaseKey) {
  const suffix = id ? `/admin/${resource}/${id}` : `/admin/${resource}`;
  return requestAdminRaw<AdminOptionsResponse>(suffix, {
    method: "OPTIONS",
  });
}

export async function fetchOptionsForSingleton(path: string) {
  return requestAdminRaw<AdminOptionsResponse>(`/admin/${path}`, {
    method: "OPTIONS",
  });
}
