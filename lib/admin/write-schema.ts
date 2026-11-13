import type { AdminFieldSchema, AdminOptionsResponse } from "@/lib/admin/types";

export type AdminWriteMethod = "POST" | "PUT" | "PATCH";

export function pickWritableAction(
  options: AdminOptionsResponse | undefined,
  preferredMethods: readonly AdminWriteMethod[],
) {
  for (const method of preferredMethods) {
    const fields = options?.actions?.[method];
    if (fields && Object.values(fields).some((field: AdminFieldSchema) => !field.read_only)) {
      return { method, fields };
    }
  }
  return null;
}
