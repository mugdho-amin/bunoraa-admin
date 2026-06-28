"use client";

import type {
  BaseKey,
  BaseRecord,
  CreateManyParams,
  CreateParams,
  CustomParams,
  CrudFilter,
  CrudOperators,
  CrudSort,
  DataProvider,
  DeleteManyParams,
  DeleteOneParams,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetOneParams,
  UpdateManyParams,
  UpdateParams,
} from "@refinedev/core";
import { getApiBaseUrl, requestAdminData, requestAdminEnvelope } from "@/lib/admin/http";
import type { AdminPaginationMeta } from "@/lib/admin/types";

function buildOrdering(sorters?: CrudSort[]) {
  if (!sorters || sorters.length === 0) {
    return null;
  }
  return sorters
    .map((sorter) => `${sorter.order === "desc" ? "-" : ""}${sorter.field}`)
    .join(",");
}

function appendFilter(params: URLSearchParams, field: string, operator: CrudOperators, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  if (field === "q" || field === "search") {
    const normalized = String(value);
    // Support both DRF SearchFilter (`search`) and existing custom Bunoraa admin endpoints (`q`).
    params.set("search", normalized);
    params.set("q", normalized);
    return;
  }

  if (operator === "in" && Array.isArray(value)) {
    value.forEach((entry) => params.append(field, String(entry)));
    return;
  }

  params.set(field, String(value));
}

function buildFilters(filters?: CrudFilter[]) {
  const params = new URLSearchParams();
  (filters ?? []).forEach((filter) => {
    if ("field" in filter && filter.field) {
      appendFilter(params, String(filter.field), filter.operator, filter.value);
    }
  });
  return params;
}

function adminResourcePath(resource: string, id?: BaseKey) {
  return id ? `/admin/${resource}/${id}` : `/admin/${resource}`;
}

async function resolveList<TData extends BaseRecord = BaseRecord>(
  resource: string,
  query: URLSearchParams,
) {
  const suffix = query.toString();
  const response = await requestAdminEnvelope<TData[]>(
    `${adminResourcePath(resource)}${suffix ? `?${suffix}` : ""}`,
  );
  const pagination = (response.meta?.pagination as AdminPaginationMeta | undefined) ?? undefined;
  return {
    data: Array.isArray(response.data) ? response.data : [],
    total: pagination?.count ?? (Array.isArray(response.data) ? response.data.length : 0),
    meta: response.meta,
  } as GetListResponse<TData>;
}

export const dataProvider = {
  getApiUrl: () => getApiBaseUrl(),

  getList: async (params: GetListParams) => {
    const { resource, pagination, filters, sorters } = params;
    const query = buildFilters(filters);
    if (pagination?.currentPage) {
      query.set("page", String(pagination.currentPage));
    }
    if (pagination?.pageSize) {
      query.set("page_size", String(pagination.pageSize));
    }
    const ordering = buildOrdering(sorters);
    if (ordering) {
      query.set("ordering", ordering);
    }
    return resolveList(resource, query);
  },

  getOne: async (params: GetOneParams) => {
    const { resource, id } = params;
    const data = await requestAdminData<BaseRecord>(adminResourcePath(resource, id));
    return { data };
  },

  getMany: async (params: GetManyParams) => {
    const { resource, ids } = params;
    const query = new URLSearchParams();
    ids?.forEach((id: BaseKey) => query.append("id", String(id)));
    const response = await resolveList(resource, query);
    return { data: response.data };
  },

  create: async (params: CreateParams<unknown>) => {
    const { resource, variables } = params;
    const data = await requestAdminData<BaseRecord>(adminResourcePath(resource), {
      method: "POST",
      body: variables,
    });
    return { data };
  },

  createMany: async (params: CreateManyParams<unknown>) => {
    const { resource, variables } = params;
    const created = await Promise.all(
      variables.map((payload: unknown) =>
        requestAdminData<BaseRecord>(adminResourcePath(resource), {
          method: "POST",
          body: payload,
        }),
      ),
    );
    return { data: created };
  },

  update: async (params: UpdateParams<unknown>) => {
    const { resource, id, variables } = params;
    const data = await requestAdminData<BaseRecord>(adminResourcePath(resource, id), {
      method: "PATCH",
      body: variables,
    });
    return { data };
  },

  updateMany: async (params: UpdateManyParams<unknown>) => {
    const { resource, ids, variables } = params;
    const updated = await Promise.all(
      ids.map((id: BaseKey) =>
        requestAdminData<BaseRecord>(adminResourcePath(resource, id), {
          method: "PATCH",
          body: variables,
        }),
      ),
    );
    return { data: updated };
  },

  deleteOne: async (params: DeleteOneParams<unknown>) => {
    const { resource, id, variables } = params;
    const data = await requestAdminData<BaseRecord | null>(adminResourcePath(resource, id), {
      method: "DELETE",
      body: variables,
    });
    return { data: data ?? ({ id } as BaseRecord) };
  },

  deleteMany: async (params: DeleteManyParams<unknown>) => {
    const { resource, ids } = params;
    const deleted = await Promise.all(
      ids.map((id: BaseKey) =>
        requestAdminData<BaseRecord | null>(adminResourcePath(resource, id), {
          method: "DELETE",
        }),
      ),
    );
    return {
      data: deleted.map((entry, index) => entry ?? ({ id: ids[index] } as BaseRecord)),
    };
  },

  custom: async (params: CustomParams<unknown, unknown>) => {
    const { url, method = "get", payload, query, headers } = params;
    const search = new URLSearchParams();
    if (query && typeof query === "object") {
      Object.entries(query as Record<string, unknown>).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => search.append(key, String(entry)));
          return;
        }
        search.set(key, String(value));
      });
    }

    const normalizedUrl = url.startsWith("/api/")
      ? url.replace(/^\/api\/v1/, "")
      : url.startsWith("/admin") || url.startsWith("/auth") || url.startsWith("/accounts")
        ? url
        : `/admin/${url}`;

    const suffix = search.toString();
    const data = await requestAdminData<BaseRecord | BaseRecord[] | null>(
      `${normalizedUrl}${suffix ? `?${suffix}` : ""}`,
      {
        method: method.toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS",
        body: payload,
        headers,
      },
    );

    return { data: data as BaseRecord };
  },
} as unknown as DataProvider;
