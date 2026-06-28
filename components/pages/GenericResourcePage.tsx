"use client";

import { useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  Input,
  Modal,
  Pagination,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useDelete, useList, useOne, useCreate, useUpdate } from "@refinedev/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BaseKey, BaseRecord, CrudSort } from "@refinedev/core";
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
    title: humanizeLabel(key),
    dataIndex: key,
    key,
    render: (value) => formatValue(value),
  }));

  columns.push({
    title: "Actions",
    key: "__actions",
    fixed: "right",
    render: (_, record) => (
      <Space wrap>
        <Button size="small" onClick={() => router.push(`/${resource.name}/show/${record.id}`)}>
          View
        </Button>
        {resource.meta.capabilities.edit ? (
          <Button size="small" onClick={() => router.push(`/${resource.name}/edit/${record.id}`)}>
            Edit
          </Button>
        ) : null}
        {resource.meta.capabilities.delete && onDelete ? (
          <Button danger size="small" onClick={() => onDelete(record)}>
            Delete
          </Button>
        ) : null}
      </Space>
    ),
  });

  return columns;
}

function listSearchFilter(search: string) {
  return search
    ? [
        {
          field: "search",
          operator: "eq" as const,
          value: search,
        },
      ]
    : [];
}

function pickActionFields(options?: AdminOptionsResponse) {
  return options?.actions?.PATCH || options?.actions?.PUT || options?.actions?.POST || {};
}

function ResourceListView({ resource }: { resource: AdminResourceConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { result, query } = useList<BaseRecord>({
    resource: resource.name,
    pagination: {
      currentPage: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 20),
    },
    sorters: searchParams.get("ordering")
      ? [
          {
            field: searchParams.get("ordering")!.replace(/^-/, ""),
            order: searchParams.get("ordering")!.startsWith("-") ? "desc" : "asc",
          } satisfies CrudSort,
        ]
      : [],
    filters: listSearchFilter(searchParams.get("q") || ""),
    liveMode: "auto",
  });
  const deleteOne = useDelete();
  const { message } = App.useApp();
  const handleDelete = useMemo(
    () => (record: BaseRecord) => {
      if (!record?.id) {
        return;
      }

      Modal.confirm({
        title: `Delete ${resource.label} record?`,
        content: `This will permanently delete record ${record.id}.`,
        okText: "Delete",
        okButtonProps: {
          danger: true,
        },
        onOk: async () => {
          await deleteOne.mutateAsync({
            resource: resource.name,
            id: record.id as BaseKey,
          });
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
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Flex vertical gap={18}>
      <Flex justify="space-between" gap={16} wrap="wrap">
        <Input.Search
          allowClear
          placeholder={`Search ${resource.label.toLowerCase()}`}
          defaultValue={searchParams.get("q") || ""}
          onSearch={(value) => updateQuery({ q: value || undefined, page: 1 })}
          style={{ maxWidth: 360 }}
        />
        {resource.meta.capabilities.create ? (
          <Button type="primary" onClick={() => router.push(`/${resource.name}/create`)}>
            Create {resource.label}
          </Button>
        ) : null}
      </Flex>

      <Card className="admin-soft-panel" bordered={false}>
        <Table
          rowKey={(record) => String(record.id)}
          dataSource={result.data}
          columns={columns}
          loading={query.isLoading}
          pagination={false}
          scroll={{ x: 980 }}
          onRow={(record) => ({
            onDoubleClick: () => router.push(`/${resource.name}/show/${record.id}`),
          })}
        />
        <Flex justify="space-between" align="center" style={{ marginTop: 20 }} wrap="wrap" gap={12}>
          <Space wrap>
            <Tag color="blue">{result.total ?? 0} records</Tag>
            {resource.meta.search_fields?.length ? (
              <Tag>{resource.meta.search_fields.length} search fields</Tag>
            ) : null}
          </Space>
          <Pagination
            current={Number(searchParams.get("page") || 1)}
            pageSize={Number(searchParams.get("pageSize") || 20)}
            total={result.total}
            showSizeChanger
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
            <Button type="primary" onClick={() => router.push(`/${resource.name}/edit/${id}`)}>
              Edit
            </Button>
          ) : null}
          <Button onClick={() => router.push(`/${resource.name}`)}>Back to list</Button>
        </Space>
        <Space wrap>
          {resource.meta.extra_actions?.map((action) => (
            <Tag key={action.name}>
              {action.name} | {action.methods.join(", ")}
            </Tag>
          ))}
        </Space>
      </Flex>

      <Card className="admin-soft-panel" bordered={false}>
        <Descriptions column={{ xs: 1, lg: 2 }} bordered>
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
          onUpdated={async () => {
            await recordQuery.query.refetch();
          }}
        />
      ) : null}
    </Flex>
  );
}

function ResourceFormView({
  resource,
  action,
  id,
}: {
  resource: AdminResourceConfig;
  action: "create" | "edit";
  id?: BaseKey;
}) {
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
    queryOptions: {
      enabled: action === "edit" && Boolean(id),
    },
  });
  const createOne = useCreate();
  const updateOne = useUpdate();

  if (optionsQuery.isLoading || (action === "edit" && recordQuery.query.isLoading)) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <Card className="admin-soft-panel" bordered={false}>
      <SchemaForm
        fields={pickActionFields(optionsQuery.data)}
        initialValues={recordQuery.query.data?.data}
        loading={submitting}
        submitText={action === "create" ? `Create ${resource.label}` : `Save ${resource.label}`}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            if (action === "create") {
              const created = await createOne.mutateAsync({
                resource: resource.name,
                values,
              });
              message.success(`${resource.label} created.`);
              router.push(`/${resource.name}/show/${created.data.id}`);
              return;
            }

            const updated = await updateOne.mutateAsync({
              resource: resource.name,
              id: id as BaseKey,
              values,
            });
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

export function GenericResourcePage({
  resource,
  action,
  id,
}: GenericResourcePageProps) {
  if (action === "list") {
    return <ResourceListView resource={resource} />;
  }

  if (action === "show" && id !== undefined) {
    return <ResourceShowView resource={resource} id={id} />;
  }

  if ((action === "create" || action === "edit") && resource.meta.capabilities[action]) {
    return <ResourceFormView resource={resource} action={action} id={id} />;
  }

  return (
    <Card className="admin-soft-panel" bordered={false}>
      <Typography.Text type="secondary">
        This action is not enabled for the selected resource.
      </Typography.Text>
    </Card>
  );
}
