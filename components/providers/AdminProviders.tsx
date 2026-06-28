"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore, useState } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import { RefineThemes } from "@refinedev/antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router/app";
import { usePathname, useRouter } from "next/navigation";
import { fetchAdminBootstrap } from "@/lib/admin/bootstrap";
import { AdminBootstrapContext } from "@/lib/admin/bootstrap-context";
import { authProvider } from "@/lib/admin/auth-provider";
import { clearAuthState, getAccessToken, subscribeToAuthChanges } from "@/lib/admin/auth-storage";
import { dataProvider } from "@/lib/admin/data-provider";
import { AdminApiError } from "@/lib/admin/http";
import { createAdminLiveProvider } from "@/lib/admin/live-provider";
import type { AdminBootstrap } from "@/lib/admin/types";
import { FullScreenLoader } from "@/components/shared/FullScreenLoader";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const adminTheme = {
  ...RefineThemes.Blue,
  token: {
    ...RefineThemes.Blue.token,
    colorPrimary: "#0f766e",
    colorInfo: "#1d4ed8",
    colorSuccess: "#047857",
    colorWarning: "#b45309",
    colorError: "#be123c",
    colorBgLayout: "#eef2f7",
    colorBgContainer: "#ffffff",
    colorBorderSecondary: "rgba(15, 23, 42, 0.08)",
    borderRadius: 18,
    fontFamily: 'var(--font-body), "IBM Plex Sans", sans-serif',
  },
};

export function AdminProviders({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === "/login";
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = useState(false);

  const clearBootstrap = useCallback(() => {
    setBootstrap(null);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setBootstrap(null);
      return null;
    }

    setLoading(true);
    try {
      const nextBootstrap = await fetchAdminBootstrap();
      setBootstrap(nextBootstrap);
      return nextBootstrap;
    } catch (error) {
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        clearAuthState();
        setBootstrap(null);
        if (pathname !== "/login") {
          router.replace("/login");
        }
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (!getAccessToken()) {
      if (!isLoginRoute) {
        router.replace("/login");
      }
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshBootstrap();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLoginRoute, refreshBootstrap, router]);

  useEffect(() => {
    return subscribeToAuthChanges(() => {
      if (!getAccessToken()) {
        setBootstrap(null);
        if (!isLoginRoute) {
          router.replace("/login");
        }
        return;
      }
      void refreshBootstrap();
    });
  }, [isLoginRoute, refreshBootstrap, router]);

  useEffect(() => {
    if (isLoginRoute && getAccessToken() && bootstrap) {
      router.replace("/dashboard");
    }
  }, [bootstrap, isLoginRoute, router]);

  const websocketUrl = bootstrap?.realtime.websocket_url ?? process.env.NEXT_PUBLIC_ADMIN_WS_URL ?? null;
  const liveProvider = useMemo(
    () => createAdminLiveProvider(() => websocketUrl),
    [websocketUrl],
  );

  const shouldGate = hydrated && !isLoginRoute && Boolean(getAccessToken()) && !bootstrap;

  if (!hydrated) {
    return <FullScreenLoader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={adminTheme}>
        <AntApp>
          <AdminBootstrapContext.Provider
            value={{
              bootstrap,
              loading,
              refreshBootstrap,
              clearBootstrap,
            }}
          >
            <Refine
              authProvider={authProvider}
              dataProvider={dataProvider}
              routerProvider={routerProvider}
              liveProvider={liveProvider}
              resources={(bootstrap?.resources ?? []).map((resource) => ({
                ...resource,
                create: resource.create ?? undefined,
                edit: resource.edit ?? undefined,
                show: resource.show ?? undefined,
              }))}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
              {shouldGate ? (
                <FullScreenLoader message="Syncing permissions, resources, and runtime settings..." />
              ) : (
                children
              )}
            </Refine>
          </AdminBootstrapContext.Provider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
