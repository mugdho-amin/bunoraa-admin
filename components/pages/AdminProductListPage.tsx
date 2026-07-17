"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDelete, useList } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { Button, Card, Flex, Grid, Image, Input, Modal, Space, Table, Tag, Typography, Skeleton, notification } from "antd";
import type { InputRef } from "antd";
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

const ROW_HOVER = { background: "var(--admin-hover-bg)" };

export function AdminProductListPage() {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const isMobile = Boolean(screens.xs) || Boolean(screens.sm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const searchRef = useRef<InputRef>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        router.push("/catalog/products/create");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

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
      width: isMobile ? "50%" : "30%",
      render: (_, record) => (
        <Flex align="center" gap={isMobile ? 8 : 12}>
          <Image
            src={record.primary_image ?? undefined}
            alt={record.name}
            width={isMobile ? 32 : 48}
            height={isMobile ? 32 : 48}
            style={{ borderRadius: 8, objectFit: "cover" }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' fill='%23e5e7eb'%3E%3Crect width='48' height='48' rx='8'/%3E%3C/svg%3E"
          />
          <Flex vertical gap={1}>
            <Typography.Text strong style={{ fontSize: isMobile ? 12 : 14 }} ellipsis={{ tooltip: record.name }}>
              {record.name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {record.sku || "—"} · {record.primary_category_name || "Uncategorized"}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Price",
      key: "price",
      width: isMobile ? "20%" : "15%",
      render: (_, record) => (
        <Flex vertical gap={0}>
          <Typography.Text strong style={{ fontSize: isMobile ? 12 : 14 }}>
            {record.current_price}
          </Typography.Text>
          {record.is_on_sale && record.sale_price && (
            <Typography.Text delete type="secondary" style={{ fontSize: 11 }}>
              {record.price}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Stock",
      key: "stock",
      width: isMobile ? "auto" : "12%",
      render: (_, record) => (
        isMobile
          ? <span style={{ color: record.is_in_stock ? "var(--admin-success)" : "var(--admin-danger)", fontSize: 18 }}>{record.is_in_stock ? "✓" : "✗"}</span>
          : record.is_in_stock
            ? <Tag color="green">In Stock</Tag>
            : <Tag color="red">Out of stock</Tag>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: "18%",
      responsive: ["md" as const],
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
      width: isMobile ? "auto" : "15%",
      render: (_, record) => (
        <Space size={isMobile ? 0 : "small"}>
          <Button
            type="text"
            size={isMobile ? "small" : "middle"}
            icon={<Pencil size={isMobile ? 14 : 16} />}
            onClick={() => router.push(`/catalog/products/edit/${record.id}`)}
          />
          <Button
            type="text"
            danger
            size={isMobile ? "small" : "middle"}
            icon={<Trash2 size={isMobile ? 14 : 16} />}
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

          <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
            <Input
              ref={searchRef}
              placeholder="Search products...  (Press / to focus)"
              prefix={<Search size={16} style={{ color: "var(--admin-muted-light)" }} />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              allowClear
              style={{ maxWidth: 400 }}
            />
            {!isLoading && products.length > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {search ? `${products.length} of ${total} products` : `${total} products`}
              </Typography.Text>
            )}
          </Flex>

          {isLoading ? (
            <Flex vertical gap={1}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Flex key={i} align="center" gap={12} style={{ padding: "12px 8px", borderBottom: "1px solid var(--admin-border)" }}>
                  <Skeleton.Avatar active size={40} shape="square" style={{ borderRadius: 8 }} />
                  <Flex vertical gap={4} style={{ flex: 1 }}>
                    <Skeleton active paragraph={false} title={{ width: `${[55, 70, 60, 80, 50, 65][i % 6]}%` }} />
                    <Skeleton active paragraph={false} title={{ width: `${[25, 35, 20, 30, 40, 28][i % 6]}%` }} />
                  </Flex>
                </Flex>
              ))}
            </Flex>
          ) : products.length === 0 ? (
            <Flex vertical align="center" gap={12} style={{ padding: "48px 0" }}>
              <PackageSearch size={48} style={{ color: "var(--admin-muted-light)" }} />
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
                showTotal: (t) => `${t} products`,
              }}
              onRow={(record) => ({
                onDoubleClick: () => router.push(`/catalog/products/edit/${record.id}`),
                onMouseEnter: (e) => { (e.currentTarget as HTMLElement).style.background = ROW_HOVER.background; },
                onMouseLeave: (e) => { (e.currentTarget as HTMLElement).style.background = ""; },
              })}
            />
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
