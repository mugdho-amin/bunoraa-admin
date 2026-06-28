"use client";

import type { BaseKey } from "@refinedev/core";
import type { AdminBootstrap, AdminPageConfig, AdminResourceConfig, ParsedAdminRoute, ResourceViewAction } from "@/lib/admin/types";

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

function matchCustomPage(path: string, pages: AdminPageConfig[]) {
  const normalized = normalizePath(path);
  return pages.find((page) => normalizePath(page.path) === normalized) ?? null;
}

function matchResourceAction(path: string, resources: AdminResourceConfig[]) {
  const normalized = normalizePath(path);
  for (const resource of resources) {
    const resourcePath = normalizePath(resource.list);
    if (normalized === resourcePath) {
      return {
        resource,
        action: "list" as ResourceViewAction,
      };
    }

    if (resource.create && normalized === normalizePath(resource.create)) {
      return {
        resource,
        action: "create" as ResourceViewAction,
      };
    }

    if (resource.edit) {
      const prefix = normalizePath(resource.edit.replace(":id", ""));
      if (normalized.startsWith(prefix)) {
        const id = normalized.slice(prefix.length).replace(/^\/+/, "");
        if (id) {
          return {
            resource,
            action: "edit" as ResourceViewAction,
            id,
          };
        }
      }
    }

    if (resource.show) {
      const prefix = normalizePath(resource.show.replace(":id", ""));
      if (normalized.startsWith(prefix)) {
        const id = normalized.slice(prefix.length).replace(/^\/+/, "");
        if (id) {
          return {
            resource,
            action: "show" as ResourceViewAction,
            id,
          };
        }
      }
    }
  }
  return null;
}

export function resolveAdminRoute(slug: string[], bootstrap: AdminBootstrap): ParsedAdminRoute {
  const fallbackPath = slug.length ? slug.join("/") : "dashboard";

  const customPage = matchCustomPage(fallbackPath, bootstrap.pages);
  if (customPage) {
    return {
      type: "page",
      page: customPage,
      path: `/${normalizePath(customPage.path)}`,
    };
  }

  const resourceMatch = matchResourceAction(fallbackPath, bootstrap.resources);
  if (resourceMatch) {
    return {
      type: "resource",
      resource: resourceMatch.resource,
      action: resourceMatch.action,
      id: resourceMatch.id as BaseKey | undefined,
      path: `/${normalizePath(fallbackPath)}`,
    };
  }

  return {
    type: "not-found",
    path: `/${normalizePath(fallbackPath)}`,
  };
}
