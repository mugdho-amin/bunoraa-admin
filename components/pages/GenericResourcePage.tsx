"use client";

import { useCallback, useMemo, useState } from "react";
import {
  App, Button, Card, Descriptions, Empty, Flex, Grid, Input, Modal, Pagination,
  Skeleton, Space, Table, Tag, Typography, Tooltip, Dropdown, Select, DatePicker,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useDelete, useList, useOne, useCreate, useUpdate } from "@refinedev/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BaseKey, BaseRecord, CrudSort } from "@refinedev/core";
import {
  Download, Filter, Plus, Search, Eye, Pencil, Trash2,
  ArrowUpDown, FileSpreadsheet, RefreshCcw, SlidersHorizontal,
} from "lucide-react";
import { fetchOptionsForResource } from "@/lib/admin/bootstrap";
import type { AdminOptionsResponse, AdminResourceConfig, ResourceViewAction } from "@/lib/admin/types";
import { formatValue, humanizeLabel, pickVisibleKeys } from "@/lib/admin/utils";
import { SchemaForm } from "@/components/forms/SchemaForm";
import { OrderOperationsPanel } from "@/components/pages/OrderOperationsPanel";
import { useQuery } from "@tanstack/react-query";

export type GenericResourcePageProps = {
  resource: AdminResourceConfig;
  action: ResourceViewAction;
  id?: BaseKey;
};

function buildColumns(
  records: BaseRecord[],
  resource: AdminResourceConfig,
  router: ReturnType<typeof useRouter>,
  onDelete: ((record: BaseRecord) => void) | null,
): ColumnsType<BaseRecord> {
  const sample = records[0] ?? {};
  const keys = pickVisibleKeys(sample).slice(0, 8);
  const columns: ColumnsType<BaseRecord> = keys.map((key) => ({
    title: (
      <Flex align="center" gap={4}>
        {humanizeLabel(key)}
        <ArrowUpDown size={10} style={{ color: "rgba(0,0,0,0.25)" }} />
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
        {resource.meta.capabilities.show && record.id != null ? (
          <Tooltip title="View details">
            <Button type="text" size="small" icon={<Eye size={14} />} onClick={() => router.push(`/${resource.name}/show/${record.id}`)} />
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

function pickActionFields(options?: AdminOptionsResponse) {
  return options?.actions?.PATCH || options?.actions?.PUT || options?.actions?.POST || {};
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
  const isMobile = Boolean(screens.xs) || Boolean(screens.sm);

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
  const { message } = App.useApp();

  const handleDelete = useMemo(
    () => (record: BaseRecord) => {
      if (!record?.id) return;
      Modal.confirm({
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
    [deleteOne, message, query, resource.label, resource.name],
  );

  const columns = useMemo(
    () => buildColumns(result.data || [], resource, router, resource.meta.capabilities.delete ? handleDelete : null),
    [handleDelete, resource, result.data, router],
  );

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
      {/* Toolbar */}
      <Flex justify="space-between" gap={12} wrap="wrap" align="center">
        <Flex gap={8} wrap="wrap" flex={1}>
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
        <Space wrap>
          <Dropdown
            menu={{
              items: [
                {
                  key: "csv",
                  icon: <FileSpreadsheet size={14} />,
                  label: "Export CSV",
                  onClick: () => exportToCsv(result.data || [], resource.label),
                },
              ],
            }}
            trigger={["click"]}
          >
            <Button icon={<Download size={14} />}>Export</Button>
          </Dropdown>
          <Button icon={<RefreshCcw size={14} />} onClick={() => query.refetch()}>
            Refresh
          </Button>
          {resource.meta.capabilities.create ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => router.push(`/${resource.name}/create`)}>
              Create {resource.label}
            </Button>
          ) : null}
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
                const params = new URLSearchParams();
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
        <Table
          rowKey={(record) => String(record.id)}
          dataSource={result.data}
          columns={columns}
          loading={query.isLoading}
          pagination={false}
          scroll={{ x: isMobile ? 500 : 980 }}
          locale={{ emptyText: <Empty description={`No ${resource.label.toLowerCase()} found.`} /> }}
          onRow={(record) => ({
            onDoubleClick: () => {
            if (record.id != null && resource.meta.capabilities.show) {
              router.push(`/${resource.name}/show/${record.id}`);
            }
          },
            style: { cursor: "pointer", transition: "background 0.1s" },
            onMouseEnter: (e) => { e.currentTarget.style.background = "rgba(15,118,110,0.03)"; },
            onMouseLeave: (e) => { e.currentTarget.style.background = ""; },
          })}
          size="middle"
        />
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
      <Flex justify="space-between" wrap="wrap" gap={12}>
        <Space wrap>
          {resource.meta.capabilities.edit ? (
            <Button type="primary" icon={<Pencil size={14} />} onClick={() => router.push(`/${resource.name}/edit/${id}`)}>
              Edit
            </Button>
          ) : null}
          <Button icon={<Eye size={14} />} onClick={() => router.push(`/${resource.name}`)}>
            Back to list
          </Button>
        </Space>
        <Space wrap>
          {resource.meta.extra_actions?.map((action) => (
            <Tag key={action.name} bordered={false}>
              {action.name} | {action.methods.join(", ")}
            </Tag>
          ))}
        </Space>
      </Flex>

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
    </Flex>
  );
}

function ResourceFormView({ resource, action, id }: { resource: AdminResourceConfig; action: "create" | "edit"; id?: BaseKey }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const optionsQuery = useQuery({
    queryKey: ["resource-options", resource.name, action, id],
    queryFn: () => fetchOptionsForResource(resource.name, action === "edit" ? (id as BaseKey) : undefined),
  });
  const recordQuery = useOne<BaseRecord>({
    resource: resource.name,
    id: id ?? "",
    queryOptions: { enabled: action === "edit" && Boolean(id) },
  });
  const createOne = useCreate();
  const updateOne = useUpdate();

  if (optionsQuery.isLoading || (action === "edit" && recordQuery.query.isLoading)) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <Card className="admin-soft-panel" bordered={false}>
      <Typography.Title level={5} style={{ marginBottom: 20 }}>
        {action === "create" ? `Create ${resource.label}` : `Edit ${resource.label}`}
      </Typography.Title>
      <SchemaForm
        fields={pickActionFields(optionsQuery.data)}
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
            const updated = await updateOne.mutateAsync({ resource: resource.name, id: id as BaseKey, values });
            message.success(`${resource.label} updated.`);
            router.push(`/${resource.name}/show/${updated.data.id}`);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </Card>
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
