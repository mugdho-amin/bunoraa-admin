"use client";

import { createContext, useContext } from "react";
import type { AdminBootstrap } from "@/lib/admin/types";

export type AdminBootstrapContextValue = {
  bootstrap: AdminBootstrap | null;
  loading: boolean;
  refreshBootstrap: () => Promise<AdminBootstrap | null>;
  clearBootstrap: () => void;
};

export const AdminBootstrapContext = createContext<AdminBootstrapContextValue | null>(null);

export function useAdminBootstrap() {
  const value = useContext(AdminBootstrapContext);
  if (!value) {
    throw new Error("useAdminBootstrap must be used inside AdminProviders.");
  }
  return value;
}
