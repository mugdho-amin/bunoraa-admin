"use client";

import { useMemo, useState } from "react";
import {
  Alert, App, Button, Card, Descriptions, Empty, Flex, Grid, Input, List, Modal, Pagination,
  Skeleton, Space, Table, Tag, Typography, Tooltip, Select, DatePicker,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useDelete, useList, useOne, useCreate, useUpdate } from "@refinedev/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BaseKey, BaseRecord, CrudSort } from "@refinedev/core";
import {
  Download, Filter, Plus, Search, Eye, Pencil, Trash2,
  ArrowUpDown, RefreshCcw, SlidersHorizontal,
} from "lucide-react";
import { fetchOptionsForResource } from "@/lib/admin/bootstrap";
import { pickWritableAction } from "@/lib/admin/write-schema";
import type { AdminResourceConfig, ResourceViewAction } from "@/lib/admin/types";
import { formatValue, humanizeLabel, pickVisibleKeys } from "@/lib/admin/utils";
import { SchemaForm } from "@/components/forms/SchemaForm";
import { AdminPageHeader } from "@/components/shared/AdminPageHeader";
import { OrderOperationsPanel } from "@/components/pages/OrderOperationsPanel";
import { PreOrderOperationsPanel } from "@/components/pages/PreOrderOperationsPanel";
import { useQuery } from "@tanstack/react-query";

export type GenericResourcePageProps = {
  resource: AdminResourceConfig;
  action: ResourceViewAction;
  id?: BaseKey;
};

const ANALYTICS_LIST_FIELDS: Record<string, string[]> = {
  "analytics/dashboard": ["total_revenue", "total_orders", "total_visitors", "avg_order_value", "avg_conversion_rate", "period_days"],
  "analytics/daily": ["date", "page_views", "unique_visitors", "orders_count", "orders_revenue"],
  "analytics/product-stats": ["product_name", "date", "views", "add_to_cart_count", "orders_count", "revenue"],
  "analytics/category-stats": ["category_name", "date", "views", "product_views", "orders_count", "revenue"],
  "analytics/search-queries": ["query", "results_count", "clicked_product_name", "visitor", "created_at"],
  "analytics/cart-events": ["event_label", "product_name", "visitor", "quantity", "cart_value", "created_at"],
  "analytics/page-views": ["path", "visitor", "device_type", "country", "city", "time_on_page", "created_at"],
};

function getRecordKey(record: BaseRecord): BaseKey | undefined {
  const key = record.id ?? record.date;
  return typeof key === "string" || typeof key === "number" ? key : undefined;
}

function buildColumns(
  records: BaseRecord[],
  resource: AdminResourceConfig,
  router: ReturnType<typeof useRouter>,
  onDelete: ((record: BaseRecord) => void) | null,
): ColumnsType<BaseRecord> {
  const sample = records[0] ?? {};
  const keys = (ANALYTICS_LIST_FIELDS[resource.name] ?? pickVisibleKeys(sample).slice(0, 8))
    .filter((key) => key in sample);
  const columns: ColumnsType<BaseRecord> = keys.map((key) => ({
    title: (
      <Flex align="center" gap={4}>
        {humanizeLabel(key)}
        <ArrowUpDown size={10} style={{ color: "var(--admin-muted-light)" }} />
      </Flex>
    ),
    dataIndex: key,
    key,
    ellipsis: true,
    render: (value) => formatValue(value),
  }));

  columns.push({
    title: "Actions",
    key: "__actions",
    width: 100,
    render: (_, record) => (
      <Space size={4}>
        {resource.meta.capabilities.show && getRecordKey(record) != null ? (
          <Tooltip title="View details">
            <Button type="text" size="small" icon={<Eye size={14} />} onClick={() => router.push(`/${resource.name}/show/${getRecordKey(record)}`)} />
          </Tooltip>
        ) : null}
        {resource.meta.capabilities.edit ? (
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Pencil size={14} />} onClick={() => router.push(`/${resource.name}/edit/${record.id}`)} />
          </Tooltip>
        ) : null}
        {resource.meta.capabilities.delete && onDelete ? (
          <Tooltip title="Delete">
            <Button danger type="text" size="small" icon={<Trash2 size={14} />} onClick={() => onDelete(record)} />
          </Tooltip>
        ) : null}
      </Space>
    ),
  });

  return columns;
}

function listSearchFilter(search: string) {
  return search
    ? [{ field: "search", operator: "eq" as const, value: search }]
    : [];
}

function exportToCsv(data: BaseRecord[], filename: string) {
  if (data.length === 0) return;
  const keys = pickVisibleKeys(data[0]);
  const headers = keys.map(humanizeLabel).join(",");
  const rows = data.map((row) =>
    keys.map((key) => {
      const val = row[key];
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(","),
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ResourceListView({ resource }: { resource: AdminResourceConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const screens = Grid.useBreakpoint();
  // Ant Design's `sm` matches every viewport >= 576px, including desktop.
  // Use the medium breakpoint to keep the card layout limited to phones.
  const isMobile = screens.md === false;

  const { result, query } = useList<BaseRecord>({
    resource: resource.name,
    pagination: {
      currentPage: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 20),
    },
    sorters: searchParams.get("ordering")
      ? [{ field: searchParams.get("ordering")!.replace(/^-/, ""), order: searchParams.get("ordering")!.startsWith("-") ? "desc" : "asc" } satisfies CrudSort]
      : [],
    filters: listSearchFilter(searchParams.get("q") || ""),
    liveMode: "auto",
  });
  const deleteOne = useDelete();
  const { message, modal } = App.useApp();

  const handleDelete = useMemo(
    () => (record: BaseRecord) => {
      if (!record?.id) return;
      modal.confirm({
        title: `Delete ${resource.label} record?`,
        content: `This will permanently delete record ${record.id}.`,
        okText: "Delete",
        okButtonProps: { danger: true },
        onOk: async () => {
          await deleteOne.mutateAsync({ resource: resource.name, id: record.id as BaseKey });
          message.success("Record deleted.");
          await query.refetch();
        },
      });
    },
    [deleteOne, message, modal, query, resource.label, resource.name],
  );

  const columns = useMemo(
    () => buildColumns(result.data || [], resource, router, resource.meta.capabilities.delete ? handleDelete : null),
    [handleDelete, resource, result.data, router],
  );
  const isAnalyticsResource = resource.name.startsWith("analytics/");
  const analyticsTitleField = ANALYTICS_LIST_FIELDS[resource.name]?.[0];
  const analyticsSecondaryFields = (ANALYTICS_LIST_FIELDS[resource.name] ?? []).slice(1, 7);

  const updateQuery = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Flex vertical gap={18}>
      <AdminPageHeader
        title={resource.label}
        eyebrow={resource.group}
        description={resource.description || `Review and manage ${resource.label.toLowerCase()} records.`}
        actions={resource.meta.capabilities.create ? (
          <Button type="primary" icon={<Plus size={15} />} onClick={() => router.push(`/${resource.name}/create`)}>
            Create {resource.label}
          </Button>
        ) : null}
      />
      {/* Toolbar */}
      <Flex justify="space-between" gap={12} wrap="wrap" align="center" className="admin-resource-toolbar">
        <Flex gap={8} wrap="wrap" flex={1} className="admin-resource-search">
          <Input.Search
            allowClear
            placeholder={`Search ${resource.label.toLowerCase()}...`}
            defaultValue={searchParams.get("q") || ""}
            onSearch={(value) => updateQuery({ q: value || undefined, page: 1 })}
            style={{ maxWidth: 320 }}
            prefix={<Search size={14} style={{ color: "var(--admin-muted)" }} />}
          />
          <Tooltip title="Toggle filters">
            <Button
              icon={<SlidersHorizontal size={14} />}
              onClick={() => setShowFilters(!showFilters)}
              type={showFilters ? "primary" : "default"}
            />
          </Tooltip>
        </Flex>
        <Space wrap className="admin-resource-toolbar-actions">
          <Button icon={<Download size={14} />} onClick={() => exportToCsv(result.data || [], resource.label)}>
            Export CSV
          </Button>
          <Button icon={<RefreshCcw size={14} />} onClick={() => query.refetch()}>
            Refresh
          </Button>
        </Space>
      </Flex>

      {/* Expandable Advanced Filters */}
      {showFilters && (
        <Card className="admin-soft-panel" size="small" bordered={false}>
          <Flex gap={12} wrap="wrap" align="flex-end">
            <div>
              <Typography.Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: "var(--admin-muted)" }}>Status</Typography.Text>
              <Select
                allowClear
                placeholder="All statuses"
                style={{ width: 160 }}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "draft", label: "Draft" },
                ]}
                onChange={(val) => updateQuery({ status: val || undefined, page: 1 })}
              />
            </div>
            <div>
              <Typography.Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: "var(--admin-muted)" }}>Date range</Typography.Text>
              <DatePicker.RangePicker
                style={{ width: 240 }}
                onChange={(dates) => {
                  updateQuery({
                    date_from: dates?.[0]?.toISOString().split("T")[0],
                    date_to: dates?.[1]?.toISOString().split("T")[0],
                    page: 1,
                  });
                }}
              />
            </div>
            <Button
              size="small"
              onClick={() => {
                router.push(pathname);
              }}
              icon={<Filter size={12} />}
            >
              Clear filters
            </Button>
          </Flex>
        </Card>
      )}

      {/* Table */}
      <Card className="admin-soft-panel" bordered={false} styles={{ body: { padding: 0 } }}>
        {isMobile ? (
          query.isLoading ? (
            <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 5 }} /></div>
          ) : result.data.length === 0 ? (
            <Empty style={{ padding: 32 }} description={`No ${resource.label.toLowerCase()} found.`} />
          ) : (
            <List
              dataSource={result.data}
              split={false}
              renderItem={(record, index) => {
                const key = getRecordKey(record);
                const preferredTitleFields = [analyticsTitleField, "name", "title", "order_number", "code", "email", "product_name", "category_name", "query", "path", "date"]
                  .filter((field): field is string => Boolean(field));
                const titleField = preferredTitleFields.find((field) => record[field] !== undefined && record[field] !== null)
                  || pickVisibleKeys(record).find((field) => !["id", "uuid"].includes(field));
                const fields = isAnalyticsResource
                  ? analyticsSecondaryFields.filter((field) => field in record)
                  : pickVisibleKeys(record).filter((field) => field !== titleField && !["id", "uuid", "created_at", "updated_at"].includes(field)).slice(0, 4);
                return (
                  <List.Item key={String(key ?? record.created_at ?? index)} className="admin-mobile-record">
                    <div className="admin-mobile-record-body">
                      <div className="admin-mobile-record-heading">
                        <div className="admin-mobile-record-title">
                          {titleField ? formatValue(record[titleField]) : `${resource.label} record`}
                        </div>
                        <Space size={2} className="admin-mobile-record-actions">
                          {resource.meta.capabilities.show && key != null && <Button aria-label="View record" type="text" icon={<Eye size={16} />} onClick={() => router.push(`/${resource.name}/show/${key}`)} />}
                          {resource.meta.capabilities.edit && key != null && <Button aria-label="Edit record" type="text" icon={<Pencil size={16} />} onClick={() => router.push(`/${resource.name}/edit/${key}`)} />}
                          {resource.meta.capabilities.delete && key != null && <Button aria-label="Delete record" danger type="text" icon={<Trash2 size={16} />} onClick={() => handleDelete(record)} />}
                        </Space>
                      </div>
                      <div className="admin-mobile-record-fields">
                        {fields.map((field) => (
                          <div key={field} className="admin-mobile-record-field">
                            <span>{humanizeLabel(field)}</span>
                            <strong>{formatValue(record[field])}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          )
        ) : (
          <Table
            rowKey={(record) => String(getRecordKey(record) ?? record.created_at)}
            dataSource={result.data}
            columns={columns}
            loading={query.isLoading}
            pagination={false}
            scroll={{ x: isMobile ? 500 : 980 }}
            locale={{ emptyText: <Empty description={`No ${resource.label.toLowerCase()} found.`} /> }}
            onRow={(record) => ({
              onDoubleClick: () => {
                const key = getRecordKey(record);
                if (key != null && resource.meta.capabilities.show) {
                  router.push(`/${resource.name}/show/${key}`);
                }
              },
              style: { cursor: "pointer", transition: "background 0.1s" },
              onMouseEnter: (e) => { e.currentTarget.style.background = "var(--admin-hover-brand)"; },
              onMouseLeave: (e) => { e.currentTarget.style.background = ""; },
            })}
            size="middle"
          />
        )}
        <Flex justify="space-between" align="center" style={{ padding: "16px 20px", borderTop: "1px solid var(--admin-border)" }} wrap="wrap" gap={12}>
          <Space wrap>
            <Tag color="blue" bordered={false}>{result.total ?? 0} records</Tag>
            {resource.meta.search_fields?.length ? (
              <Tag bordered={false}>{resource.meta.search_fields.length} search fields</Tag>
            ) : null}
          </Space>
          <Pagination
            current={Number(searchParams.get("page") || 1)}
            pageSize={Number(searchParams.get("pageSize") || 20)}
            total={result.total}
            showSizeChanger
            pageSizeOptions={["10", "20", "50", "100"]}
            onChange={(page, pageSize) => updateQuery({ page, pageSize })}
          />
        </Flex>
      </Card>
    </Flex>
  );
}

function ResourceShowView({ resource, id }: { resource: AdminResourceConfig; id: BaseKey }) {
  const router = useRouter();
  const recordQuery = useOne<BaseRecord>({
    resource: resource.name,
    id,
    liveMode: "auto",
  });

  if (recordQuery.query.isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  const record = recordQuery.query.data?.data;
  if (!record) {
    return <Empty description="Record not found." />;
  }

  return (
    <Flex vertical gap={18}>
      <AdminPageHeader
        title={String(record.name ?? record.title ?? record.order_number ?? record.code ?? `${resource.label} details`)}
        eyebrow={resource.label}
        description={`Record ${String(id)}`}
        actions={<Space wrap>
          {resource.meta.capabilities.edit ? (
            <Button type="primary" icon={<Pencil size={14} />} onClick={() => router.push(`/${resource.name}/edit/${id}`)}>Edit</Button>
          ) : null}
          <Button icon={<Eye size={14} />} onClick={() => router.push(`/${resource.name}`)}>Back to list</Button>
        </Space>}
      />
      {resource.meta.extra_actions?.length ? (
        <Space wrap>{resource.meta.extra_actions.map((action) => <Tag key={action.name} bordered={false}>{action.name} | {action.methods.join(", ")}</Tag>)}</Space>
      ) : null}

      <Card className="admin-soft-panel" bordered={false}>
        <Descriptions column={{ xs: 1, lg: 2 }} bordered size="small" style={{ borderRadius: 16 }}>
          {Object.entries(record).map(([key, value]) => (
            <Descriptions.Item key={key} label={humanizeLabel(key)}>
              {formatValue(value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>

      {resource.name === "orders" && record.id ? (
        <OrderOperationsPanel
          orderId={record.id as BaseKey}
          onUpdated={async () => { await recordQuery.query.refetch(); }}
        />
      ) : null}
      {resource.name === "preorders/orders" && record.preorder_number ? (
        <PreOrderOperationsPanel
          preorderNumber={record.preorder_number as BaseKey}
          onUpdated={async () => { await recordQuery.query.refetch(); }}
        />
      ) : null}
    </Flex>
  );
}

function ResourceFormView({ resource, action, id }: { resource: AdminResourceConfig; action: "create" | "edit"; id?: BaseKey }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const optionsQuery = useQuery({
    queryKey: ["resource-options", resource.name, action, id],
    queryFn: () => fetchOptionsForResource(resource.name),
  });
  const recordQuery = useOne<BaseRecord>({
    resource: resource.name,
    id: id ?? "",
    queryOptions: { enabled: action === "edit" && Boolean(id) },
  });
  const createOne = useCreate();
  const updateOne = useUpdate();
  const writeAction = pickWritableAction(
    optionsQuery.data,
    action === "create" ? ["POST"] : ["PATCH", "PUT"],
    resource.name,
  );

  if (optionsQuery.isError) {
    return (
      <Card className="admin-soft-panel" bordered={false}>
        <Alert type="error" showIcon message="Failed to load form schema from API." />
      </Card>
    );
  }

  if (optionsQuery.isLoading || (action === "edit" && recordQuery.query.isLoading)) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <Flex vertical gap={18}>
      <AdminPageHeader
        title={action === "create" ? `Create ${resource.label}` : `Edit ${resource.label}`}
        eyebrow={resource.group}
        description={resource.description}
      />
      <Card className="admin-soft-panel" bordered={false}>
      <SchemaForm
        fields={writeAction?.fields ?? {}}
        schemaSource={`/admin/schema/${resource.name}/`}
        initialValues={recordQuery.query.data?.data}
        loading={submitting}
        submitText={action === "create" ? `Create ${resource.label}` : `Save ${resource.label}`}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            if (action === "create") {
              const created = await createOne.mutateAsync({ resource: resource.name, values });
              message.success(`${resource.label} created.`);
              router.push(`/${resource.name}/show/${created.data.id}`);
              return;
            }
            const updated = await updateOne.mutateAsync({
              resource: resource.name,
              id: id as BaseKey,
              values,
              meta: { method: writeAction?.method ?? "PATCH" },
            });
            message.success(`${resource.label} updated.`);
            router.push(`/${resource.name}/show/${updated.data.id}`);
          } finally {
            setSubmitting(false);
          }
        }}
      />
      </Card>
    </Flex>
  );
}

export function GenericResourcePage({ resource, action, id }: GenericResourcePageProps) {
  if (action === "list") return <ResourceListView resource={resource} />;
  if (action === "show" && id !== undefined && id !== "undefined") return <ResourceShowView resource={resource} id={id} />;
  if ((action === "create" || action === "edit") && resource.meta.capabilities[action]) {
    return <ResourceFormView resource={resource} action={action} id={id} />;
  }
  return (
    <Card className="admin-soft-panel" bordered={false}>
      <Typography.Text type="secondary">This action is not enabled for the selected resource.</Typography.Text>
    </Card>
  );
}
