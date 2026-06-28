"use client";

import { useCallback, useMemo, useState } from "react";
import { useDelete, useList } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { Button, Card, Flex, Image, Input, Modal, Space, Table, Tag, Typography, Skeleton, notification } from "antd";
import { Plus, Search, Trash2, Pencil, PackageSearch } from "lucide-react";
import type { BaseRecord } from "@refinedev/core";
import type { ColumnsType } from "antd/es/table";

type ProductRecord = BaseRecord & {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  sale_price: string | null;
  current_price: string;
  currency: string;
  is_in_stock: boolean;
  primary_image: string | null;
  primary_category_name: string;
  discount_percentage: number;
  is_on_sale: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  average_rating: number;
  reviews_count: number;
  short_description: string;
};

export function AdminProductListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filters = useMemo(() => {
    const f: Array<{ field: string; operator: "contains"; value: string }> = [];
    if (search.trim()) {
      f.push({ field: "q", operator: "contains", value: search.trim() });
    }
    return f;
  }, [search]);

  const { query: listQuery, result: listResult } = useList<ProductRecord>({
    resource: "catalog/products",
    pagination: { currentPage: page, pageSize },
    filters,
    sorters: [{ field: "-created_at", order: "desc" }],
  });
  const isLoading = listQuery.isLoading;
  const isError = listQuery.isError;
  const error = listQuery.error;
  const refetch = listQuery.refetch;

  const { mutate: deleteProduct, mutation: deleteMutation } = useDelete();
  const isDeleting = deleteMutation.isPending;

  const handleDelete = useCallback(
    (record: ProductRecord) => {
      Modal.confirm({
        title: "Delete product",
        content: `Are you sure you want to delete "${record.name}"? This action cannot be undone.`,
        okText: "Delete",
        okType: "danger",
        cancelText: "Cancel",
        onOk: () =>
          new Promise<void>((resolve, reject) => {
            deleteProduct(
              {
                resource: "catalog/products",
                id: record.id,
              },
              {
                onSuccess: () => {
                  notification.success({ message: "Product deleted" });
                  resolve();
                },
                onError: (err) => {
                  notification.error({ message: "Failed to delete product", description: err?.message });
                  reject(err);
                },
              },
            );
          }),
      });
    },
    [deleteProduct],
  );

  const products = listResult?.data ?? [];
  const total = listResult?.total ?? 0;

  const columns: ColumnsType<ProductRecord> = [
    {
      title: "Product",
      key: "product",
      width: "30%",
      render: (_, record) => (
        <Flex align="center" gap={12}>
          <Image
            src={record.primary_image || "/placeholder.svg"}
            alt={record.name}
            width={48}
            height={48}
            style={{ borderRadius: 8, objectFit: "cover" }}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iMjQiIHk9IjI2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjEwIj5ObyBJbWc8L3RleHQ+PC9zdmc+"
          />
          <Flex vertical gap={2}>
            <Typography.Text strong style={{ fontSize: 14 }} ellipsis={{ tooltip: record.name }}>
              {record.name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.sku || "—"} · {record.primary_category_name || "Uncategorized"}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Price",
      key: "price",
      width: "15%",
      render: (_, record) => (
        <Flex vertical gap={2}>
          <Typography.Text strong>
            {record.currency} {record.current_price}
          </Typography.Text>
          {record.is_on_sale && record.sale_price && (
            <Typography.Text delete type="secondary" style={{ fontSize: 12 }}>
              {record.currency} {record.price}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Stock",
      key: "stock",
      width: "12%",
      render: (_, record) => {
        if (!record.is_in_stock) {
          return <Tag color="red">Out of stock</Tag>;
        }
        return <Tag color="green">In Stock</Tag>;
      },
    },
    {
      title: "Status",
      key: "status",
      width: "18%",
      render: (_, record) => {
        const badges: React.ReactNode[] = [];
        if (record.is_on_sale) badges.push(<Tag key="sale" color="volcano">Sale</Tag>);
        if (record.is_featured) badges.push(<Tag key="featured" color="purple">Featured</Tag>);
        if (record.is_bestseller) badges.push(<Tag key="bestseller" color="gold">Best Seller</Tag>);
        if (record.is_new_arrival) badges.push(<Tag key="new" color="cyan">New</Tag>);
        return badges.length > 0 ? <Flex gap={4} wrap="wrap">{badges}</Flex> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: "15%",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<Pencil size={16} />}
            onClick={() => router.push(`/catalog/products/edit/${record.id}`)}
          />
          <Button
            type="text"
            danger
            icon={<Trash2 size={16} />}
            loading={isDeleting}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  if (isError) {
    return (
      <Card className="admin-soft-panel">
        <Flex vertical align="center" gap={16} style={{ padding: "48px 0" }}>
          <Typography.Text type="danger">Failed to load products</Typography.Text>
          <Typography.Text type="secondary">{error?.message}</Typography.Text>
          <Button onClick={() => refetch()}>Retry</Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex vertical gap={20}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Flex vertical gap={4}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Products
          </Typography.Title>
          <Typography.Text type="secondary">Manage your product catalog</Typography.Text>
        </Flex>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => router.push("/catalog/products/create")}>
          Create Product
        </Button>
      </Flex>

      <Card className="admin-soft-panel" variant="borderless">
        <Flex vertical gap={16}>
          <Input
            placeholder="Search products..."
            prefix={<Search size={16} color="#999" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            allowClear
            style={{ maxWidth: 400 }}
          />

          {isLoading ? (
            <Flex vertical gap={12}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} active avatar paragraph={{ rows: 1 }} />
              ))}
            </Flex>
          ) : products.length === 0 ? (
            <Flex vertical align="center" gap={12} style={{ padding: "48px 0" }}>
              <PackageSearch size={48} color="#ccc" />
              <Typography.Text type="secondary">
                {search ? "No products match your search." : "No products yet. Create your first product."}
              </Typography.Text>
              {!search && (
                <Button type="primary" icon={<Plus size={16} />} onClick={() => router.push("/catalog/products/create")}>
                  Create Product
                </Button>
              )}
            </Flex>
          ) : (
            <Table<ProductRecord>
              dataSource={products}
              columns={columns}
              rowKey="id"
              pagination={{
                current: page,
                pageSize,
                total,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
              }}
              onRow={(record) => ({
                style: { cursor: "pointer" },
                onClick: () => router.push(`/catalog/products/edit/${record.id}`),
              })}
            />
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
