"use client";

import dynamic from "next/dynamic";
import type { BaseKey } from "@refinedev/core";
import { AdminShell } from "@/components/shell/AdminShell";
import { FullScreenLoader } from "@/components/shared/FullScreenLoader";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { resolveAdminRoute } from "@/lib/admin/routes";
import { AdminNotFoundPage } from "@/components/pages/AdminNotFoundPage";

const AdminDashboardPage = dynamic(() => import("@/components/pages/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })), {
  loading: () => <FullScreenLoader message="Loading dashboard..." />,
});
const AdminHealthPage = dynamic(() => import("@/components/pages/AdminHealthPage").then((m) => ({ default: m.AdminHealthPage })), {
  loading: () => <FullScreenLoader message="Loading health..." />,
});
const AdminProductEditorPage = dynamic(() => import("@/components/pages/AdminProductEditorPage").then((m) => ({ default: m.AdminProductEditorPage })), {
  loading: () => <FullScreenLoader message="Loading editor..." />,
});
const AdminProductListPage = dynamic(() => import("@/components/pages/AdminProductListPage").then((m) => ({ default: m.AdminProductListPage })), {
  loading: () => <FullScreenLoader message="Loading products..." />,
});
const AdminNotificationsPage = dynamic(() => import("@/components/pages/AdminNotificationsPage").then((m) => ({ default: m.AdminNotificationsPage })), {
  loading: () => <FullScreenLoader message="Loading notifications..." />,
});
const AdminRealtimeEventsPage = dynamic(() => import("@/components/pages/AdminRealtimeEventsPage").then((m) => ({ default: m.AdminRealtimeEventsPage })), {
  loading: () => <FullScreenLoader message="Loading events..." />,
});
const SingletonSettingsPage = dynamic(() => import("@/components/pages/SingletonSettingsPage").then((m) => ({ default: m.SingletonSettingsPage })), {
  loading: () => <FullScreenLoader message="Loading settings..." />,
});
const GenericResourcePage = dynamic(() => import("@/components/pages/GenericResourcePage").then((m) => ({ default: m.GenericResourcePage })), {
  loading: () => <FullScreenLoader message="Loading resource..." />,
});

function renderProductPage(action: string, id?: BaseKey) {
  switch (action) {
    case "list":
      return <AdminProductListPage />;
    case "create":
      return <AdminProductEditorPage />;
    case "edit":
      return <AdminProductEditorPage id={id} />;
    default:
      return <AdminNotFoundPage />;
  }
}

function renderCustomPage(path: string) {
  switch (path) {
    case "/dashboard":
      return <AdminDashboardPage />;
    case "/notifications":
      return <AdminNotificationsPage />;
    case "/health":
      return <AdminHealthPage />;
    case "/health/details":
      return <AdminHealthPage detailed />;
    case "/realtime/events":
      return <AdminRealtimeEventsPage />;
    case "/cms/site-settings":
      return (
        <SingletonSettingsPage
          title="Site Settings"
          path="cms/site-settings"
          description="Global branding, messaging, and site-wide experience controls."
        />
      );
    case "/shipping/settings":
      return (
        <SingletonSettingsPage
          title="Shipping Settings"
          path="shipping/settings"
          description="Global shipping defaults and operational thresholds."
        />
      );
    default:
      return <AdminNotFoundPage />;
  }
}

export function AdminRouteRenderer({ slug }: { slug: string[] }) {
  const { bootstrap, loading } = useAdminBootstrap();

  if (loading || !bootstrap) {
    return <FullScreenLoader />;
  }

  const route = resolveAdminRoute(slug, bootstrap);

  return (
    <AdminShell route={route}>
      {route.type === "page"
        ? renderCustomPage(route.path)
        : route.type === "resource"
          ? route.resource.name === "catalog/products"
            ? renderProductPage(route.action, route.id)
            : (
                <GenericResourcePage
                  resource={route.resource}
                  action={route.action}
                  id={route.id}
                />
              )
          : <AdminNotFoundPage />}
    </AdminShell>
  );
}
