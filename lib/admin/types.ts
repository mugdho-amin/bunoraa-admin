import type { BaseKey } from "@refinedev/core";

export type AdminIdentity = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  permissions: string[];
  last_login: string | null;
};

export type AdminResourceCapabilities = {
  list: boolean;
  show: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export type AdminResourceMeta = {
  group: string;
  label: string;
  icon: string;
  description?: string;
  capabilities: AdminResourceCapabilities;
  search_fields?: string[];
  ordering_fields?: string[];
  filterset_fields?: string[];
  extra_actions?: Array<{
    name: string;
    url_path: string;
    detail: boolean;
    methods: string[];
  }>;
};

export type AdminResourceConfig = {
  name: string;
  identifier: string;
  group: string;
  label: string;
  icon: string;
  description?: string;
  list: string;
  show?: string | null;
  create?: string | null;
  edit?: string | null;
  meta: AdminResourceMeta;
};

export type AdminPageConfig = {
  name: string;
  path: string;
  group: string;
  label: string;
  icon: string;
  description?: string;
};

export type AdminBootstrap = {
  app: {
    name: string;
    environment: string;
    debug: boolean;
    version: string;
  };
  identity: AdminIdentity;
  authorization: {
    groups: string[];
    permissions: string[];
    is_superuser: boolean;
  };
  features: {
    mfa_required: boolean;
    audit_logging: boolean;
    realtime: boolean;
    dynamic_resources: boolean;
  };
  realtime: {
    websocket_path: string;
    websocket_url: string;
  };
  pages: AdminPageConfig[];
  resources: AdminResourceConfig[];
  navigation: Array<{
    group: string;
    items: Array<{
      type: "page" | "resource";
      name: string;
      label: string;
      icon: string;
      path: string;
      description?: string;
      order: number;
    }>;
  }>;
  generated_at: string;
};

export type AdminApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
};

export type AdminPaginationMeta = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  page?: number;
  page_size?: number;
  total_pages?: number;
};

export type PendingMfaChallenge = {
  email: string;
  mfaToken: string;
  methods: string[];
};

export type AdminFieldChoice = {
  value: string | number | boolean;
  display_name: string;
};

export type AdminFieldSchema = {
  type?: string;
  required?: boolean;
  read_only?: boolean;
  label?: string;
  help_text?: string;
  placeholder?: string;
  choices?: AdminFieldChoice[];
  max_length?: number;
  min_length?: number;
  child?: AdminFieldSchema;
};

export type AdminOptionsResponse = {
  name?: string;
  description?: string;
  renders?: string[];
  parses?: string[];
  actions?: Record<string, Record<string, AdminFieldSchema>>;
};

export type ResourceViewAction = "list" | "create" | "edit" | "show";

export type ParsedAdminRoute =
  | {
      type: "page";
      page: AdminPageConfig;
      path: string;
    }
  | {
      type: "resource";
      resource: AdminResourceConfig;
      action: ResourceViewAction;
      id?: BaseKey;
      path: string;
    }
  | {
      type: "not-found";
      path: string;
    };
