"use client";

import "@ant-design/v5-patch-for-react-19";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, useState } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import { RefineThemes } from "@refinedev/antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router/app";
import { usePathname } from "next/navigation";
import { fetchAdminBootstrap } from "@/lib/admin/bootstrap";
import { AdminBootstrapContext } from "@/lib/admin/bootstrap-context";
import { authProvider } from "@/lib/admin/auth-provider";
import { clearAuthState, getAccessToken, subscribeToAuthChanges } from "@/lib/admin/auth-storage";
import { dataProvider } from "@/lib/admin/data-provider";
import { AdminApiError } from "@/lib/admin/http";
import { createAdminLiveProvider } from "@/lib/admin/live-provider";
import type { AdminBootstrap } from "@/lib/admin/types";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { FullScreenLoader } from "@/components/shared/FullScreenLoader";
import { initTheme, useThemeStore } from "@/lib/admin/theme-store";
import { registerServiceWorker } from "@/lib/admin/pwa";

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
    borderRadius: 18,
    fontFamily: 'var(--font-body), "IBM Plex Sans", sans-serif',
  },
  components: {
    Layout: {
      bodyBg: "transparent",
    },
    Card: {
      paddingLG: 20,
      borderRadiusLG: 20,
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
    },
  },
};

function useThemeAwareConfig() {
  const resolved = useThemeStore((s) => s.resolved);
  const isDark = resolved === "dark";
  return useMemo(() => ({
    ...adminTheme,
    token: {
      ...adminTheme.token,
      colorBgLayout: isDark ? "#0b1120" : "#eef2f7",
      colorBgContainer: isDark ? "#161c30" : "#ffffff",
      colorBorderSecondary: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
      colorText: isDark ? "#e8edf5" : "#0f172a",
      colorTextSecondary: isDark ? "#8a99b5" : "#52607a",
    },
  }), [isDark]);
}

export function AdminProviders({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const bootstrapped = useRef(false);
  const themeResolved = useThemeStore((s) => s.resolved);
  const themeInitialized = useRef(false);

  useEffect(() => {
    if (!themeInitialized.current) {
      initTheme();
      themeInitialized.current = true;
      registerServiceWorker();
    }
  }, []);

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
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return null;
      }
      // Network errors (CORS, DNS, timeout) should not crash the app
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      if (!isLoginRoute) {
        window.location.href = "/login";
      }
      return;
    }
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void refreshBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return subscribeToAuthChanges(() => {
      if (!getAccessToken()) {
        setBootstrap(null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return;
      }
      void refreshBootstrap().catch(() => {});
    });
  }, [refreshBootstrap]);

  useEffect(() => {
    if (isLoginRoute && getAccessToken() && bootstrap) {
      window.location.href = "/dashboard";
    }
  }, [bootstrap, isLoginRoute]);

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
      <ConfigProvider theme={useThemeAwareConfig()}>
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
