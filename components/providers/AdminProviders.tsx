"use client";

import "@ant-design/v5-patch-for-react-19";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { App as AntApp, ConfigProvider, theme as antdTheme } from "antd";
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

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;

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
    controlHeight: 40,
    controlHeightLG: 48,
    controlHeightSM: 32,
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    sizeMS: 12,
  },
  components: {
    Layout: {
      bodyBg: "transparent",
      headerBg: "transparent",
      siderBg: "transparent",
      triggerBg: "transparent",
    },
    Card: {
      paddingLG: 20,
      borderRadiusLG: 20,
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
      itemBorderRadius: 10,
      itemMarginBlock: 2,
      itemMarginInline: 4,
      iconSize: 16,
      collapsedIconSize: 18,
    },
    Button: {
      borderRadius: 12,
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
      paddingInline: 16,
      paddingInlineLG: 20,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 12,
      controlHeight: 40,
      controlHeightLG: 48,
    },
    Select: {
      borderRadius: 12,
      controlHeight: 40,
      controlHeightLG: 48,
    },
    Table: {
      borderRadiusLG: 16,
      headerBg: "transparent",
      headerColor: "var(--admin-muted)",
      fontSize: 13,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Modal: {
      borderRadiusLG: 20,
      paddingContentHorizontalLG: 24,
    },
    Drawer: {
      borderRadiusLG: 0,
    },
    Tabs: {
      cardBorderRadius: 12,
      cardPadding: "8px 16px",
    },
    Badge: {
      dotSize: 8,
    },
    Tag: {
      borderRadiusSM: 8,
      defaultBg: "transparent",
    },
    Tooltip: {
      borderRadiusSM: 8,
    },
    Dropdown: {
      borderRadiusLG: 16,
      paddingBlock: 4,
    },
    Notification: {
      borderRadiusLG: 16,
    },
    Message: {
      borderRadiusLG: 12,
    },
    Alert: {
      borderRadiusLG: 12,
    },
  },
};

function useThemeAwareConfig() {
  const resolved = useThemeStore((s) => s.resolved);
  const isDark = resolved === "dark";
  return useMemo(() => ({
    ...adminTheme,
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...adminTheme.token,
      // Keep menus and field popups above the app shell, sticky controls, and
      // mobile navigation. Ant Design applies this value inline to popup roots.
      zIndexPopupBase: 1600,
      colorPrimary: "#0f766e",
      colorInfo: isDark ? "#60a5fa" : "#1d4ed8",
      colorSuccess: isDark ? "#4ade80" : "#047857",
      colorWarning: isDark ? "#fbbf24" : "#b45309",
      colorError: isDark ? "#fb7185" : "#be123c",
      colorBgLayout: isDark ? "#10151c" : "#f5f7fa",
      colorBgContainer: isDark ? "#171e27" : "#ffffff",
      colorBgElevated: isDark ? "#1d2733" : "#ffffff",
      colorBorderSecondary: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
      colorBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)",
      colorText: isDark ? "#e8edf5" : "#0f172a",
      colorTextSecondary: isDark ? "#aab7c8" : "#52607a",
      colorTextTertiary: isDark ? "#91a0b4" : "#65758b",
      colorFillQuaternary: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
      boxShadow: isDark
        ? "0 6px 16px rgba(0,0,0,0.32)"
        : "0 6px 16px rgba(15,23,42,0.08)",
      boxShadowSecondary: isDark
        ? "0 6px 16px rgba(0,0,0,0.24)"
        : "0 6px 16px rgba(15,23,42,0.06)",
    },
    components: {
      ...adminTheme.components,
      Table: {
        ...adminTheme.components?.Table,
        headerBg: isDark ? "#202a36" : "#f5f7fa",
        rowHoverBg: isDark ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.035)",
        colorBgContainer: isDark ? "#171e27" : "#ffffff",
      },
      Card: {
        ...adminTheme.components?.Card,
        colorBgContainer: isDark ? "#171e27" : "#ffffff",
      },
      Menu: {
        ...adminTheme.components?.Menu,
        darkItemBg: "transparent",
        darkSubMenuItemBg: "transparent",
        darkItemSelectedBg: isDark ? "rgba(15,118,110,0.12)" : undefined,
      },
      Modal: {
        ...adminTheme.components?.Modal,
        contentBg: isDark ? "#171e27" : "#ffffff",
        headerBg: isDark ? "#171e27" : "#ffffff",
      },
      Drawer: {
        ...adminTheme.components?.Drawer,
        colorBgElevated: isDark ? "#171e27" : "#ffffff",
      },
      Dropdown: {
        ...adminTheme.components?.Dropdown,
        colorBgElevated: isDark ? "#1d2733" : "#ffffff",
      },
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
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, () => false);
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const bootstrapped = useRef(false);
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
  const configTheme = useThemeAwareConfig();

  const shouldGate = hydrated && !isLoginRoute && Boolean(getAccessToken()) && !bootstrap;

  if (!hydrated) {
    return <FullScreenLoader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={configTheme}
        getPopupContainer={(triggerNode) => triggerNode?.parentElement ?? document.body}
      >
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
