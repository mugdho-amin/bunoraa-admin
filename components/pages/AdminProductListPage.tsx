"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDelete, useList, useUpdate } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox, Flex, Grid, Image, Input, Modal, Pagination, Space, Switch, Table, Tag, Typography, Skeleton, notification } from "antd";
import type { InputRef } from "antd";
import { Plus, Search, Trash2, Pencil, PackageSearch, Upload, Download } from "lucide-react";
import type { BaseRecord } from "@refinedev/core";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { requestAdminData } from "@/lib/admin/http";
import { AdminPageHeader } from "@/components/shared/AdminPageHeader";

type ProductRecord = BaseRecord & {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  sale_price: string | null;
  compare_at_price: string | null;
  current_price: string;
  currency: string;
  stock_quantity: number;
  is_in_stock: boolean;
  primary_image: string | null;
  primary_category_name: string;
  discount_percentage: number;
  is_active: boolean;
  is_on_sale: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  average_rating: number;
  reviews_count: number;
  views_count: number;
  sales_count: number;
  cart_count: number;
  publish_from: string | null;
  short_description: string;
};

const ROW_HOVER = { background: "var(--admin-hover-bg)" };
const PRODUCT_THUMBNAIL_SIZE = 48;
const PRODUCT_THUMBNAIL_FALLBACK =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${PRODUCT_THUMBNAIL_SIZE}' height='${PRODUCT_THUMBNAIL_SIZE}' fill='%23e5e7eb'%3E%3Crect width='${PRODUCT_THUMBNAIL_SIZE}' height='${PRODUCT_THUMBNAIL_SIZE}' rx='8'/%3E%3C/svg%3E`;

export function AdminProductListPage() {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const searchRef = useRef<InputRef>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { mutate: updateProduct, mutateAsync: updateProductAsync } = useUpdate();

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
    sorters: [{ field: sortField, order: sortOrder }],
  });
  const isLoading = listQuery.isLoading;
  const isError = listQuery.isError;
  const error = listQuery.error;
  const refetch = listQuery.refetch;

  const { mutate: deleteProduct, mutateAsync: deleteProductAsync, mutation: deleteMutation } = useDelete();
  const isDeleting = deleteMutation.isPending;

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const data = await requestAdminData<{ filename: string; content: string; content_type: string }>(
        "/admin/catalog/products/export/",
      );
      const blob = new Blob([data.content], { type: data.content_type || "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || "products_export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notification.success({ message: "Products exported" });
    } catch (err: unknown) {
      notification.error({
        message: "Failed to export products",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImport = useCallback(
    async (file: File) => {
      setIsImporting(true);
      try {
        const content = await file.text();
        const result = await requestAdminData<{
          created: number;
          updated: number;
          skipped: number;
          error: number;
          errors?: Array<{ row: number; error: string }>;
        }>("/admin/catalog/products/import/", {
          method: "POST",
          body: { content },
        });
        if (result.error > 0 || (result.errors && result.errors.length > 0)) {
          const first = result.errors?.[0];
          notification.warning({
            message: `Import completed with ${result.error} row error(s)`,
            description: first ? `Row ${first.row}: ${first.error}` : undefined,
          });
        } else {
          notification.success({
            message: `Imported ${result.created + result.updated} products`,
            description: `${result.created} created · ${result.updated} updated · ${result.skipped} skipped`,
          });
        }
        void refetch();
      } catch (err: unknown) {
        notification.error({
          message: "Failed to import products",
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setIsImporting(false);
      }
    },
    [refetch],
  );

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

  const handleCellSave = useCallback(
    (id: string, field: string, value: string | number | boolean) => {
      updateProduct(
        { resource: "catalog/products", id, values: { [field]: value } },
        {
          onSuccess: () => {
            notification.success({ message: `${field.replace(/_/g, " ")} updated` });
            setEditingCell(null);
          },
          onError: (err) => {
            notification.error({ message: `Failed to update ${field}`, description: err?.message });
          },
        },
      );
    },
    [updateProduct],
  );

  const inlineInput = (record: ProductRecord, field: string, value: string | number) => {
    const isEditing = editingCell?.id === record.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <Input
          size="small"
          type={typeof value === "number" ? "number" : "text"}
          defaultValue={value}
          autoFocus
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== String(value)) handleCellSave(record.id, field, typeof value === "number" ? Number(v) : v);
            else setEditingCell(null);
          }}
          onPressEnter={(e) => {
            const v = (e.target as HTMLInputElement).value;
            if (v !== String(value)) handleCellSave(record.id, field, typeof value === "number" ? Number(v) : v);
            else setEditingCell(null);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%" }}
        />
      );
    }
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setEditingCell({ id: record.id, field }); }}
        style={{ cursor: "pointer", minHeight: 22, display: "inline-block" }}
      >
        {value ?? "—"}
      </span>
    );
  };

  const products = listResult?.data ?? [];
  const total = listResult?.total ?? 0;
  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));

  const bulkUpdate = useCallback(async (values: Partial<ProductRecord>) => {
    if (selectedIds.length === 0) return;
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => updateProductAsync({
        resource: "catalog/products",
        id,
        values,
      })));
      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (failed) notification.warning({ message: `${succeeded} updated; ${failed} failed` });
      else notification.success({ message: `${succeeded} products updated` });
      setSelectedIds([]);
      void refetch();
    } catch {
      notification.error({ message: "Could not update selected products" });
    }
  }, [selectedIds, updateProductAsync, refetch]);

  const bulkDelete = useCallback(() => {
    if (!selectedIds.length) return;
    Modal.confirm({
      title: `Delete ${selectedIds.length} products?`,
      content: "This action cannot be undone.",
      okText: "Delete products",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        const results = await Promise.allSettled(selectedIds.map((id) => deleteProductAsync({ resource: "catalog/products", id })));
        const succeeded = results.filter((result) => result.status === "fulfilled").length;
        const failed = results.length - succeeded;
        if (failed) notification.warning({ message: `${succeeded} deleted; ${failed} failed` });
        else notification.success({ message: `${succeeded} products deleted` });
        setSelectedIds([]);
        void refetch();
      },
    });
  }, [deleteProductAsync, refetch, selectedIds]);

  const exportSelected = useCallback(() => {
    if (!selectedProducts.length) return;
    const headers = ["id", "name", "slug", "sku", "price", "sale_price", "stock_quantity", "is_active"];
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...selectedProducts.map((product) => headers.map((key) => csvCell(product[key as keyof ProductRecord])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "selected-products.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [selectedProducts]);

  const columns: ColumnsType<ProductRecord> = [
    {
      title: "Product",
      dataIndex: "name",
      key: "product",
      sorter: true,
      width: 340,
      render: (_, record) => (
        <Flex align="center" gap={isMobile ? 8 : 12} style={{ width: "100%", minWidth: 0 }}>
          <Image
            src={record.primary_image ?? undefined}
            alt={record.name}
            width={PRODUCT_THUMBNAIL_SIZE}
            height={PRODUCT_THUMBNAIL_SIZE}
            style={{ width: PRODUCT_THUMBNAIL_SIZE, height: PRODUCT_THUMBNAIL_SIZE, flex: `0 0 ${PRODUCT_THUMBNAIL_SIZE}px`, borderRadius: 8, objectFit: "cover" }}
            fallback={PRODUCT_THUMBNAIL_FALLBACK}
          />
          <Flex vertical gap={1} style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ display: "block", minWidth: 0, maxWidth: "100%", fontSize: isMobile ? 12 : 14 }} ellipsis={{ tooltip: record.name }}>
              {record.name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ display: "block", minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
              {record.sku || "—"} · {record.primary_category_name || "Uncategorized"}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      sorter: true,
      width: 110,
      render: (_, record) => (
        <Flex vertical gap={0} style={{ minWidth: 0 }}>
          <Typography.Text strong style={{ fontSize: isMobile ? 12 : 14, whiteSpace: "nowrap" }}>
            {inlineInput(record, "price", record.price)}
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
      title: "Sale",
      dataIndex: "sale_price",
      key: "sale_price",
      width: 100,
      responsive: ["md" as const],
      render: (_, record) => inlineInput(record, "sale_price", record.sale_price ?? ""),
    },
    {
      title: "Compare At",
      dataIndex: "compare_at_price",
      key: "compare_at_price",
      width: 120,
      responsive: ["md" as const],
      render: (_, record) => record.compare_at_price ? inlineInput(record, "compare_at_price", record.compare_at_price) : "—",
    },
    {
      title: "Stock",
      dataIndex: "stock_quantity",
      key: "stock_quantity",
      sorter: true,
      width: 95,
      render: (_, record) => (
        <Flex align="center" gap={4}>
          {inlineInput(record, "stock_quantity", record.stock_quantity ?? 0)}
          {record.stock_quantity === 0 && (
            <Tag color="red" style={{ fontSize: 10, lineHeight: "16px" }}>Out</Tag>
          )}
        </Flex>
      ),
    },
    {
      title: "Views",
      dataIndex: "views_count",
      key: "views_count",
      sorter: true,
      width: 80,
      responsive: ["lg" as const],
      render: (_, record) => record.views_count ?? 0,
    },
    {
      title: "Sales",
      dataIndex: "sales_count",
      key: "sales_count",
      sorter: true,
      width: 80,
      responsive: ["lg" as const],
      render: (_, record) => record.sales_count ?? 0,
    },
    {
      title: "Cart",
      dataIndex: "cart_count",
      key: "cart_count",
      sorter: true,
      width: 75,
      responsive: ["lg" as const],
      render: (_, record) => record.cart_count ?? 0,
    },
    {
      title: "Published",
      dataIndex: "publish_from",
      key: "publish_from",
      sorter: true,
      width: 125,
      responsive: ["md" as const],
      render: (_, record) => {
        if (record.publish_from) {
          return new Date(record.publish_from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }

        if (record.is_active) {
          return <Tag color="green">Published</Tag>;
        }

        return <Typography.Text type="secondary">Draft</Typography.Text>;
      },
    },
    {
      title: "Active",
      dataIndex: "is_active",
      key: "is_active",
      width: 75,
      responsive: ["md" as const],
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.is_active}
          onChange={(checked, e) => {
            e.stopPropagation();
            handleCellSave(record.id, "is_active", checked);
          }}
        />
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 150,
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
      width: 105,
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
      <AdminPageHeader
        title="Products"
        eyebrow="Catalog"
        description="Manage your product catalog."
        meta={!isLoading ? `${search ? `${products.length} of ` : ""}${total} products` : undefined}
        actions={<Space wrap>
          <input
            ref={importFileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleImport(file);
              }
              e.target.value = "";
            }}
          />
          <Button
            icon={<Upload size={16} />}
            loading={isImporting}
            onClick={() => importFileRef.current?.click()}
          >
            Import CSV
          </Button>
          <Button
            icon={<Download size={16} />}
            loading={isExporting}
            onClick={() => void handleExport()}
          >
            Export CSV
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => router.push("/catalog/products/create")}>
            Create Product
          </Button>
        </Space>}
      />

      <Card className="admin-soft-panel" variant="borderless">
        <Flex vertical gap={16}>

          <Flex justify="space-between" align="center" wrap="wrap" gap={12} className="admin-resource-search-row">
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
              className="admin-resource-search-input"
              style={{ maxWidth: 400 }}
            />
            {!isLoading && search && products.length > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {`${products.length} matching products`}
              </Typography.Text>
            )}
          </Flex>

          {products.length > 0 && (
            <Flex align="center" justify="space-between" wrap="wrap" gap={10} className="admin-product-selection-toolbar">
              <Flex align="center" gap={10} wrap="wrap">
                <Checkbox
                  checked={selectedProducts.length === products.length && products.length > 0}
                  indeterminate={selectedProducts.length > 0 && selectedProducts.length < products.length}
                  onChange={(event) => {
                    const currentIds = new Set(products.map((product) => product.id));
                    setSelectedIds((previous) => event.target.checked
                      ? Array.from(new Set([...previous, ...currentIds]))
                      : previous.filter((id) => !currentIds.has(id)));
                  }}
                >
                  Select this page
                </Checkbox>
                {selectedIds.length > 0 && <Typography.Text type="secondary">{selectedIds.length} selected</Typography.Text>}
              </Flex>
              {selectedIds.length > 0 && (
                <Space wrap size={6}>
                  <Button size="small" onClick={() => void bulkUpdate({ is_active: true })}>Publish</Button>
                  <Button size="small" onClick={() => void bulkUpdate({ is_active: false })}>Unpublish</Button>
                  <Button size="small" icon={<Download size={13} />} onClick={exportSelected}>Export selected</Button>
                  <Button size="small" danger icon={<Trash2 size={13} />} onClick={bulkDelete}>Delete selected</Button>
                  <Button size="small" type="text" onClick={() => setSelectedIds([])}>Clear</Button>
                </Space>
              )}
            </Flex>
          )}

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
          ) : isMobile ? (
            <div className="admin-mobile-record-list">
              {products.map((product) => (
                <article className="admin-mobile-record product-mobile-card" key={product.id}>
                  <div className="admin-mobile-record-body">
                    <Checkbox
                      aria-label={`Select ${product.name}`}
                      checked={selectedIds.includes(product.id)}
                      onChange={(event) => setSelectedIds((previous) => event.target.checked
                        ? Array.from(new Set([...previous, product.id]))
                        : previous.filter((id) => id !== product.id))}
                    />
                    <div className="product-mobile-main">
                      <Image
                        src={product.primary_image ?? undefined}
                        alt={product.name}
                        width={PRODUCT_THUMBNAIL_SIZE}
                        height={PRODUCT_THUMBNAIL_SIZE}
                        style={{ width: PRODUCT_THUMBNAIL_SIZE, height: PRODUCT_THUMBNAIL_SIZE, flex: `0 0 ${PRODUCT_THUMBNAIL_SIZE}px`, borderRadius: 8, objectFit: "cover" }}
                        fallback={PRODUCT_THUMBNAIL_FALLBACK}
                      />
                      <div className="product-mobile-summary">
                        <Typography.Text strong className="admin-mobile-record-title">{product.name}</Typography.Text>
                        <Typography.Text type="secondary">{product.sku || "No SKU"} · {product.primary_category_name || "Uncategorized"}</Typography.Text>
                        <Flex wrap gap={5}>
                          {product.is_active ? <Tag color="green">Published</Tag> : <Tag>Draft</Tag>}
                          {product.is_on_sale && <Tag color="volcano">Sale</Tag>}
                          {product.is_featured && <Tag color="purple">Featured</Tag>}
                          {product.stock_quantity <= 0 && <Tag color="red">Out of stock</Tag>}
                        </Flex>
                      </div>
                    </div>
                    <div className="product-mobile-facts">
                      <div><span>Price</span><strong>{inlineInput(product, "price", product.price)} {product.currency}</strong></div>
                      <div><span>Stock</span><strong>{inlineInput(product, "stock_quantity", product.stock_quantity ?? 0)}</strong></div>
                      <div><span>Orders</span><strong>{product.sales_count ?? 0}</strong></div>
                      <div><span>Visibility</span><Switch size="small" checked={product.is_active} onChange={(checked) => handleCellSave(product.id, "is_active", checked)} /></div>
                    </div>
                    <div className="product-mobile-actions">
                      <Button block icon={<Pencil size={14} />} onClick={() => router.push(`/catalog/products/edit/${product.id}`)}>Edit product</Button>
                      <Button aria-label={`Delete ${product.name}`} danger icon={<Trash2 size={15} />} loading={isDeleting} onClick={() => handleDelete(product)} />
                    </div>
                  </div>
                </article>
              ))}
              <Pagination
                className="admin-mobile-pagination"
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger={false}
                onChange={(nextPage) => { setSelectedIds([]); setPage(nextPage); }}
              />
            </div>
          ) : (
            <Table<ProductRecord>
              className="admin-product-table"
              dataSource={products}
              columns={columns}
              rowKey="id"
              rowSelection={{
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys.map(String)),
              }}
              tableLayout="fixed"
              scroll={{ x: 1515 }}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                showTotal: (t) => `${t} products`,
              }}
              onChange={(pagination: TablePaginationConfig, _filters: Record<string, unknown>, sorter: SorterResult<ProductRecord> | SorterResult<ProductRecord>[]) => {
                if (pagination.current && pagination.current !== page) {
                  setSelectedIds([]);
                  setPage(pagination.current);
                }
                if (pagination.pageSize && pagination.pageSize !== pageSize) {
                  setSelectedIds([]);
                  setPageSize(pagination.pageSize);
                }
                const s = Array.isArray(sorter) ? sorter[0] : sorter;
                if (s.order && s.field) {
                  setSortField(String(s.field));
                  setSortOrder(s.order === "ascend" ? "asc" : "desc");
                  setPage(1);
                } else {
                  setSortField("created_at");
                  setSortOrder("desc");
                }
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
