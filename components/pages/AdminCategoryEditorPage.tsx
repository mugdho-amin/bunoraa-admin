"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCreate, useDelete, useList, useOne, useUpdate } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { Button, Card, Flex, Grid, Image, Input, Modal, Pagination, Space, Table, Tag, Typography, Skeleton, App, Switch } from "antd";
import { Download, Upload } from "lucide-react";
import { uploadImage } from "@/lib/upload";
import type { InputRef } from "antd";
import { Plus, Search, Trash2, Pencil, Eye, ArrowLeft, Check, FolderTree } from "lucide-react";
import type { BaseKey, BaseRecord } from "@refinedev/core";
import type { ColumnsType } from "antd/es/table";
import { CategoryTreeSelect, type CategoryNode } from "@/components/forms/CategoryTreeSelect";
import { useAutoSave } from "@/lib/admin/useAutoSave";
import { AdminPageHeader } from "@/components/shared/AdminPageHeader";
import { requestAdminData } from "@/lib/admin/http";

type CategoryRecord = BaseRecord & {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  sort_order: number;
  description: string;
  is_active: boolean;
  is_visible: boolean;
  is_featured: boolean;
  category_type: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  image: string;
  icon: string;
  aspect_ratio: string;
  aspect_width: number | null;
  aspect_height: number | null;
  product_count: number;
  children_count: number;
  parent_id: string | null;
  parent_name: string | null;
  cover_video: string | null;
};

interface CategoryFormData {
  name: string;
  slug: string;
  parent_id: string | null;
  description: string;
  sort_order: number;
  is_active: boolean;
  is_visible: boolean;
  is_featured: boolean;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  image: string;
  icon: string;
  aspect_ratio: string;
  aspect_width: number | null;
  aspect_height: number | null;
  aspect_unit: string;
  category_type: string;
  cover_video: string | null;
  apply_aspect_to_products: boolean;
  apply_aspect_to_children: boolean;
  set_aspect_default_for_descendants: boolean;
}

const emptyForm: CategoryFormData = {
  name: "",
  slug: "",
  parent_id: null,
  description: "",
  sort_order: 0,
  is_active: true,
  is_visible: true,
  is_featured: false,
  meta_title: "",
  meta_description: "",
  meta_keywords: "",
  image: "",
  icon: "",
  aspect_ratio: "1:1",
  aspect_width: null,
  aspect_height: null,
  aspect_unit: "ratio",
  category_type: "STANDARD",
  cover_video: null,
  apply_aspect_to_products: false,
  apply_aspect_to_children: false,
  set_aspect_default_for_descendants: false,
};

const PRODUCT_CATEGORY_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%23e5e7eb'/%3E%3C/svg%3E";

function CategoryListView() {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { message, notification } = App.useApp();
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
        router.push("/catalog/categories/create");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  const filters = useMemo(() => {
    const f: Array<{ field: string; operator: "contains"; value: string }> = [];
    if (search.trim()) f.push({ field: "q", operator: "contains", value: search.trim() });
    return f;
  }, [search]);

  const { query: listQuery, result: listResult } = useList<CategoryRecord>({
    resource: "catalog/categories",
    pagination: { currentPage: page, pageSize },
    filters,
    sorters: [{ field: "path", order: "asc" }],
  });
  const isLoading = listQuery.isLoading;
  const refetch = listQuery.refetch;

  const { mutate: deleteCategory } = useDelete();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await requestAdminData<{ filename: string; content: string; content_type: string }>("/admin/catalog/categories/export/");
      const url = URL.createObjectURL(new Blob([data.content], { type: data.content_type || "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || "categories.csv";
      link.click();
      URL.revokeObjectURL(url);
      message.success("Categories exported");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to export categories");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    try {
      const result = await requestAdminData<{ created: number; updated: number; skipped: number; error: number; errors?: Array<{ row: number; error: string }> }>(
        "/admin/catalog/categories/import/",
        { method: "POST", body: { content: (await file.text()).replace(/^\uFEFF/, "") } },
      );
      if (result.error || result.errors?.length) {
        const first = result.errors?.[0];
        notification.warning({ message: `Import completed with ${result.error} row error(s)`, description: first ? `Row ${first.row}: ${first.error}` : undefined });
      } else {
        message.success(`Imported ${result.created + result.updated} categories`);
      }
      void refetch();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to import categories");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = useCallback(
    (record: CategoryRecord) => {
      Modal.confirm({
        title: "Delete category",
        content: `Are you sure you want to delete "${record.name}"? This action cannot be undone.`,
        okText: "Delete",
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await deleteCategory({ resource: "catalog/categories", id: record.id });
            message.success("Category deleted");
            refetch();
          } catch {
            message.error("Failed to delete category");
          }
        },
      });
    },
    [deleteCategory, message, refetch],
  );

  const categories = useMemo(() => listResult?.data ?? [], [listResult?.data]);
  const total = listResult?.total ?? 0;
  const stats = useMemo(() => ({
    total,
    active: categories.filter((c) => c.is_active).length,
    featured: categories.filter((c) => c.is_featured).length,
  }), [categories, total]);

  const columns: ColumnsType<CategoryRecord> = useMemo(() => [
    {
      title: "Image",
      dataIndex: "image",
      key: "image",
      width: 76,
      render: (image: string | null, record: CategoryRecord) => image
        ? <Image src={image} alt={`${record.name} category`} width={40} height={40} preview={false} style={{ display: "block", borderRadius: 8, objectFit: "cover" }} fallback={PRODUCT_CATEGORY_IMAGE_FALLBACK} />
        : <div className="category-table-image-placeholder" aria-label={`No image for ${record.name}`}><FolderTree size={17} /></div>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: true,
      render: (name: string, record: CategoryRecord) => (
        <Flex align="center" gap={8}>
          <FolderTree size={14} style={{ color: "var(--admin-muted-light)", flexShrink: 0 }} />
          <Typography.Link onClick={() => router.push(`/catalog/categories/edit/${record.id}`)} strong style={{ fontSize: 13 }}>
            {name}
          </Typography.Link>
        </Flex>
      ),
    },
    {
      title: "Slug",
      dataIndex: "slug",
      key: "slug",
      ellipsis: true,
      sorter: true,
      render: (slug: string) => <Typography.Text code style={{ fontSize: 11 }}>{slug}</Typography.Text>,
    },
    {
      title: "Parent",
      dataIndex: "parent_name",
      key: "parent_name",
      sorter: true,
      responsive: ["md" as const],
      render: (val: string | null) => val ? <Tag bordered={false}>{val}</Tag> : <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>,
    },
    {
      title: "Depth",
      dataIndex: "depth",
      key: "depth",
      width: 70,
      sorter: true,
      responsive: ["lg" as const],
      render: (d: number) => <Tag bordered={false} color="default">{d}</Tag>,
    },
    {
      title: "Products",
      dataIndex: "product_count",
      key: "product_count",
      width: 90,
      sorter: true,
      responsive: ["md" as const],
      render: (count: number) => <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>{count ?? 0}</Typography.Text>,
    },
    {
      title: "Subcategories",
      dataIndex: "children_count",
      key: "children_count",
      width: 110,
      sorter: true,
      responsive: ["md" as const],
      render: (count: number) => <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted)" }}>{count ?? 0}</Typography.Text>,
    },
    {
      title: "Order",
      dataIndex: "sort_order",
      key: "sort_order",
      width: 70,
      responsive: ["lg" as const],
      sorter: true,
      render: (o: number) => <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted)" }}>{o}</Typography.Text>,
    },
    {
      title: "Active",
      dataIndex: "is_active",
      key: "is_active",
      width: 80,
      sorter: true,
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"} bordered={false}>
          {active ? "Yes" : "No"}
        </Tag>
      ),
    },
    {
      title: "Featured",
      dataIndex: "is_featured",
      key: "is_featured",
      width: 90,
      sorter: true,
      responsive: ["md" as const],
      render: (featured: boolean) => (
        <Tag color={featured ? "purple" : "default"} bordered={false}>
          {featured ? "Yes" : "No"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<Eye size={14} />} onClick={() => router.push(`/catalog/categories/show/${record.id}`)} />
          <Button type="text" size="small" icon={<Pencil size={14} />} onClick={() => router.push(`/catalog/categories/edit/${record.id}`)} />
          <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ], [router, handleDelete]);

  return (
    <Flex vertical gap={18}>
      <AdminPageHeader
        title="Categories"
        eyebrow="Catalog"
        description="Organize products and merchandising."
        meta={`${total} total · ${stats.active} active · ${stats.featured} featured`}
        actions={<Space wrap>
          <input ref={importFileRef} type="file" accept=".csv,text/csv" className="admin-hidden-file-input" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.target.value = "";
          }} />
          <Button icon={<Upload size={14} />} loading={isImporting} onClick={() => importFileRef.current?.click()}>Import CSV</Button>
          <Button icon={<Download size={14} />} loading={isExporting} onClick={() => void handleExport()}>Export CSV</Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => router.push("/catalog/categories/create")}>Create category</Button>
        </Space>}
      />
      <Flex gap={12} wrap="wrap" align="center" justify="space-between" className="admin-resource-search-row">
        <Input
          ref={searchRef}
          allowClear
          placeholder="Search categories...  (Press / to focus)"
          className="admin-resource-search-input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 320 }}
          prefix={<Search size={14} style={{ color: "var(--admin-muted)" }} />}
        />
        {!isLoading && search && categories.length > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {`${categories.length} matching categories`}
          </Typography.Text>
        )}
      </Flex>

      {isLoading ? (
        <Flex vertical gap={1}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Flex key={i} align="center" gap={12} style={{ padding: "16px 8px", borderBottom: "1px solid var(--admin-border)" }}>
              <Skeleton.Avatar active size={20} />
              <Skeleton active paragraph={false} title={{ width: `${[35, 55, 40, 60, 45][i % 5]}%` }} />
            </Flex>
          ))}
        </Flex>
      ) : categories.length === 0 ? (
        <Flex vertical align="center" gap={12} style={{ padding: "60px 0" }}>
          <FolderTree size={48} style={{ color: "var(--admin-muted-light)" }} />
          <Typography.Text type="secondary">
            {search ? "No categories match your search." : "No categories yet. Create your first category."}
          </Typography.Text>
          {!search && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => router.push("/catalog/categories/create")}>
              Create Category
            </Button>
          )}
        </Flex>
      ) : isMobile ? (
        <div className="admin-mobile-record-list">
          {categories.map((category) => (
            <article className="admin-mobile-record" key={category.id}>
              <div className="admin-mobile-record-body">
                <div className="admin-mobile-record-heading">
                  <div className="category-mobile-main">
                    {category.image ? <Image src={category.image} alt="" width={44} height={44} style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }} /> : <div className="category-mobile-placeholder"><FolderTree size={18} /></div>}
                    <div className="category-mobile-summary">
                      <strong className="admin-mobile-record-title">{category.name}</strong>
                      <span>/{category.slug}</span>
                    </div>
                  </div>
                  <Space size={0} className="admin-mobile-record-actions">
                    <Button aria-label={`View ${category.name}`} type="text" icon={<Eye size={16} />} onClick={() => router.push(`/catalog/categories/show/${category.id}`)} />
                    <Button aria-label={`Edit ${category.name}`} type="text" icon={<Pencil size={16} />} onClick={() => router.push(`/catalog/categories/edit/${category.id}`)} />
                    <Button aria-label={`Delete ${category.name}`} danger type="text" icon={<Trash2 size={16} />} onClick={() => handleDelete(category)} />
                  </Space>
                </div>
                <div className="product-mobile-facts">
                  <div><span>Products</span><strong>{category.product_count}</strong></div>
                  <div><span>Parent</span><strong>{category.parent_name || "Top level"}</strong></div>
                  <div><span>Status</span><strong>{category.is_active ? "Active" : "Inactive"}</strong></div>
                  <div><span>Featured</span><strong>{category.is_featured ? "Yes" : "No"}</strong></div>
                </div>
              </div>
            </article>
          ))}
          <Pagination className="admin-mobile-pagination" current={page} pageSize={pageSize} total={total} showSizeChanger={false} onChange={(nextPage) => setPage(nextPage)} />
        </div>
      ) : (
        <Card className="admin-soft-panel" bordered={false} styles={{ body: { padding: 0 } }}>
          <Table
            rowKey="id"
            dataSource={categories}
            columns={columns}
            loading={false}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (t) => `${t} categories`,
            }}
            scroll={{ x: isMobile ? 600 : 900 }}
            locale={{ emptyText: "No categories found." }}
            onRow={(record) => ({
              style: { cursor: "pointer", transition: "background 0.1s" },
              onDoubleClick: () => router.push(`/catalog/categories/show/${record.id}`),
              onMouseEnter: (e) => { e.currentTarget.style.background = "var(--admin-hover-bg)"; },
              onMouseLeave: (e) => { e.currentTarget.style.background = ""; },
            })}
            size="middle"
          />
        </Card>
      )}
    </Flex>
  );
}

function CategoryShowView({ id }: { id: BaseKey }) {
  const router = useRouter();
  const { query: recordQuery, result: record } = useOne<CategoryRecord>({
    resource: "catalog/categories",
    id,
  });

  if (recordQuery.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  if (!record) {
    return (
      <Flex vertical align="center" gap={16} style={{ padding: 60 }}>
        <Typography.Text type="secondary">Category not found.</Typography.Text>
        <Button onClick={() => router.push("/catalog/categories")}>Back to categories</Button>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={18}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Flex align="center" gap={12}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => router.push("/catalog/categories")} />
          <Typography.Title level={4} style={{ margin: 0 }}>{record.name}</Typography.Title>
          <Tag color={record.is_active ? "green" : "default"}>{record.is_active ? "Active" : "Inactive"}</Tag>
        </Flex>
        <Space>
          <Button icon={<Pencil size={14} />} onClick={() => router.push(`/catalog/categories/edit/${id}`)}>
            Edit
          </Button>
        </Space>
      </Flex>

      <Card className="admin-soft-panel" bordered={false}>
        <Flex vertical gap={16}>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Name</Typography.Text>
              <Typography.Text strong>{record.name}</Typography.Text>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Slug</Typography.Text>
              <Typography.Text code>{record.slug}</Typography.Text>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Parent</Typography.Text>
              <Typography.Text>{record.parent_name ?? <Typography.Text type="secondary">—</Typography.Text>}</Typography.Text>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Depth</Typography.Text>
              <Typography.Text>{record.depth ?? 0}</Typography.Text>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Category Type</Typography.Text>
              <Tag bordered={false}>{record.category_type ?? "standard"}</Tag>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Sort Order</Typography.Text>
              <Typography.Text>{record.sort_order ?? 0}</Typography.Text>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Subcategories</Typography.Text>
              <Typography.Text>{record.children_count ?? 0}</Typography.Text>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Active</Typography.Text>
              <Tag color={record.is_active ? "green" : "default"}>{record.is_active ? "Yes" : "No"}</Tag>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Visible</Typography.Text>
              <Tag color={record.is_visible ? "blue" : "default"}>{record.is_visible ? "Yes" : "No"}</Tag>
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Featured</Typography.Text>
              <Tag color={record.is_featured ? "purple" : "default"}>{record.is_featured ? "Yes" : "No"}</Tag>
            </Flex>
            {record.aspect_ratio && (
              <Flex vertical gap={4}>
                <Typography.Text className="admin-field-label">Aspect Ratio</Typography.Text>
                <Typography.Text>{record.aspect_ratio}</Typography.Text>
              </Flex>
            )}
            {record.aspect_width != null && record.aspect_height != null && (
              <Flex vertical gap={4}>
                <Typography.Text className="admin-field-label">Custom Dimensions</Typography.Text>
                <Typography.Text>{record.aspect_width} × {record.aspect_height} {record.aspect_unit ?? "ratio"}</Typography.Text>
              </Flex>
            )}
          </div>
          {record.image && (
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Image</Typography.Text>
              <Image src={record.image} alt={record.name} style={{ maxWidth: 200, maxHeight: 120, borderRadius: 8, objectFit: "cover" }} preview={false} />
            </Flex>
          )}
          {record.description && (
            <Flex vertical gap={4}>
              <Typography.Text className="admin-field-label">Description</Typography.Text>
              <Typography.Text>{record.description}</Typography.Text>
            </Flex>
          )}
          {(record.meta_title || record.meta_description) && (
            <Flex vertical gap={8} style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 12 }}>
              <Typography.Text className="admin-field-label">SEO</Typography.Text>
              {record.meta_title && (
                <Flex vertical gap={2}>
                  <Typography.Text style={{ fontSize: 10, color: "var(--admin-muted)" }}>Meta Title</Typography.Text>
                  <Typography.Text>{record.meta_title}</Typography.Text>
                </Flex>
              )}
              {record.meta_description && (
                <Flex vertical gap={2}>
                  <Typography.Text style={{ fontSize: 10, color: "var(--admin-muted)" }}>Meta Description</Typography.Text>
                  <Typography.Text>{record.meta_description}</Typography.Text>
                </Flex>
              )}
              {record.meta_keywords && (
                <Flex vertical gap={2}>
                  <Typography.Text style={{ fontSize: 10, color: "var(--admin-muted)" }}>Meta Keywords</Typography.Text>
                  <Typography.Text>{record.meta_keywords}</Typography.Text>
                </Flex>
              )}
            </Flex>
          )}
        </Flex>
      </Card>
    </Flex>
  );
}

function CategoryFormView({ action, id }: { action: "create" | "edit"; id?: BaseKey }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form, setForm] = useState<CategoryFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const slugManuallyEdited = useState(false);

  const { result: categoriesResult } = useList<CategoryRecord>({
    resource: "catalog/categories",
    pagination: { pageSize: 500 },
    sorters: [{ field: "path", order: "asc" }],
  });
  const categories = useMemo(() => (categoriesResult?.data ?? []) as CategoryRecord[], [categoriesResult]);
  const { result: videosResult } = useList<BaseRecord & { id: string; title?: string; product_name?: string; video_url?: string }>({
    resource: "catalog/videos",
    pagination: { pageSize: 500 },
    sorters: [{ field: "ordering", order: "asc" }],
  });
  const coverVideos = videosResult?.data ?? [];

  const { query: existingQuery, result: existing } = useOne<CategoryRecord>({
    resource: "catalog/categories",
    id: id ?? "",
    queryOptions: { enabled: action === "edit" && !!id },
  });

  const [currentId, setCurrentId] = useState<BaseKey | undefined>(id);

  const getCategoryPayload = useCallback((data: CategoryFormData): Record<string, unknown> => ({
    name: data.name,
    slug: data.slug,
    parent_id: data.parent_id || null,
    description: data.description,
    sort_order: data.sort_order,
    is_active: data.is_active,
    is_visible: data.is_visible,
    is_featured: data.is_featured,
    meta_title: data.meta_title,
    meta_description: data.meta_description,
    meta_keywords: data.meta_keywords,
    image: data.image || null,
    icon: data.icon,
    aspect_ratio: data.aspect_ratio,
    aspect_width: data.aspect_width,
    aspect_height: data.aspect_height,
    aspect_unit: data.aspect_unit,
    category_type: data.category_type,
    cover_video: data.cover_video,
    apply_aspect_to_products: data.apply_aspect_to_products,
    apply_aspect_to_children: data.apply_aspect_to_children,
    set_aspect_default_for_descendants: data.set_aspect_default_for_descendants,
  }), []);

  const autoSave = useAutoSave({
    resource: "catalog/categories",
    formData: form,
    id: currentId,
    enabled: !saving && !existingQuery.isLoading,
    getPayload: getCategoryPayload,
    onCreated: (newId) => { setCurrentId(newId); },
  });

  const { mutate: createCategory } = useCreate();
  const { mutate: updateCategory } = useUpdate();

  const formInitialized = useRef(false);

  const initForm = useCallback(() => {
    if (formInitialized.current) return;
    if (action === "edit" && existing) {
      formInitialized.current = true;
      setForm({
        name: existing.name ?? "",
        slug: existing.slug ?? "",
        parent_id: existing.parent_id ?? null,
        description: existing.description ?? "",
        sort_order: existing.sort_order ?? 0,
        is_active: existing.is_active ?? true,
        is_visible: existing.is_visible ?? true,
        is_featured: existing.is_featured ?? false,
        meta_title: existing.meta_title ?? "",
        meta_description: existing.meta_description ?? "",
        meta_keywords: existing.meta_keywords ?? "",
        image: existing.image ?? "",
        icon: existing.icon ?? "",
        aspect_ratio: existing.aspect_ratio ?? "1:1",
        aspect_width: existing.aspect_width != null ? Number(existing.aspect_width) : null,
        aspect_height: existing.aspect_height != null ? Number(existing.aspect_height) : null,
        aspect_unit: existing.aspect_unit ?? "ratio",
        category_type: existing.category_type ?? "STANDARD",
        cover_video: existing.cover_video ?? null,
        apply_aspect_to_products: false,
        apply_aspect_to_children: false,
        set_aspect_default_for_descendants: false,
      });
    } else if (action === "create") {
      formInitialized.current = true;
    }
  }, [action, existing]);

  const resetSnapshotRef = useRef(autoSave.resetSnapshot);

  useEffect(() => {
    resetSnapshotRef.current = autoSave.resetSnapshot;
  }, [autoSave.resetSnapshot]);

  useEffect(() => {
    const timer = setTimeout(() => {
      initForm();
      resetSnapshotRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [initForm]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

  const updateField = <K extends keyof CategoryFormData>(key: K, value: CategoryFormData[K]) => {
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.slug.trim()) newErrors.slug = "Slug is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      message.error("Please fix validation errors");
      return;
    }
    setSaving(true);
    autoSave.flush();
    try {
      const values = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        parent_id: form.parent_id || null,
        description: form.description.trim(),
        sort_order: form.sort_order,
        is_active: form.is_active,
        is_visible: form.is_visible,
        is_featured: form.is_featured,
        meta_title: form.meta_title.trim(),
        meta_description: form.meta_description.trim(),
        meta_keywords: form.meta_keywords.trim(),
        image: form.image || null,
        icon: form.icon || "",
        aspect_ratio: form.aspect_ratio,
        aspect_width: form.aspect_width,
        aspect_height: form.aspect_height,
        aspect_unit: form.aspect_unit,
        category_type: form.category_type,
        cover_video: form.cover_video || null,
        apply_aspect_to_products: form.apply_aspect_to_products,
        apply_aspect_to_children: form.apply_aspect_to_children,
        set_aspect_default_for_descendants: form.set_aspect_default_for_descendants,
      };
      const effectiveId = currentId || id;
      if (action === "create" && !effectiveId) {
        await createCategory(
          { resource: "catalog/categories", values },
          { onSuccess: () => { message.success("Category created"); router.push("/catalog/categories"); } },
        );
      } else {
        await updateCategory(
          { resource: "catalog/categories", id: (effectiveId ?? id) as BaseKey, values },
          { onSuccess: () => { message.success("Category updated"); router.push("/catalog/categories"); } },
        );
      }
    } catch {
      message.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  if (action === "edit" && existingQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <Flex vertical gap={20}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Flex align="center" gap={12}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => router.push("/catalog/categories")} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            {action === "create" ? "Create Category" : "Edit Category"}
          </Typography.Title>
        </Flex>
        <Flex align="center" gap={8}>
          {autoSave.status !== "idle" && (
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: autoSave.status === "saving" ? "var(--admin-muted)"
                : autoSave.status === "saved" ? "var(--admin-success)"
                : "var(--admin-danger)",
            }}>
              {autoSave.status === "saving" ? "Saving draft..."
                : autoSave.status === "saved" ? "Draft saved"
                : "Draft save failed"}
            </span>
          )}
          <Button type="primary" icon={<Check size={16} />} onClick={handleSave} loading={saving}>
            {action === "create" ? "Create" : "Save"}
          </Button>
        </Flex>
      </Flex>

      <Card className="admin-soft-panel" bordered={false}>
        <Flex vertical gap={20}>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Name *</Typography.Text>
              <input
                value={form.name}
                onChange={(e) => {
                  updateField("name", e.target.value);
                  if (!slugManuallyEdited[0]) updateField("slug", slugify(e.target.value));
                }}
                className={`admin-input${errors.name ? " error" : ""}`}
              />
              {errors.name && <Typography.Text style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{errors.name}</Typography.Text>}
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Slug *</Typography.Text>
              <input
                value={form.slug}
                onChange={(e) => { slugManuallyEdited[1](true); updateField("slug", e.target.value); }}
                className={`admin-input${errors.slug ? " error" : ""}`}
              />
              {errors.slug && <Typography.Text style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{errors.slug}</Typography.Text>}
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Parent Category</Typography.Text>
              <CategoryTreeSelect
                categories={categories as unknown as CategoryNode[]}
                value={form.parent_id ? [form.parent_id] : []}
                onChange={(ids) => updateField("parent_id", ids[0] ?? null)}
                multiple={false}
                placeholder="None (top-level)"
              />
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Sort Order</Typography.Text>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => updateField("sort_order", Number(e.target.value))}
                className="admin-input"
              />
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Category Type</Typography.Text>
              <select
                value={form.category_type}
                onChange={(e) => updateField("category_type", e.target.value)}
                className="admin-select"
              >
                <option value="STANDARD">Standard Clothing</option>
                <option value="LIFESTYLE">Lifestyle & Home</option>
                <option value="TECHNIQUE">Artisanship / Technique Hub</option>
                <option value="SEASONAL">Seasonal / Festive</option>
              </select>
            </Flex>
          </div>

          <Flex vertical gap={6}>
            <Typography.Text className="admin-field-label">Description</Typography.Text>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
              className="admin-textarea"
            />
          </Flex>

          {/* Image */}
          <Flex vertical gap={6}>
            <Typography.Text className="admin-field-label">Image URL</Typography.Text>
            <Flex gap={8}>
              <label style={{ cursor: "pointer", display: "flex" }}>
                <Button icon={<Upload size={14} />} style={{ height: 44, borderRadius: 12 }}>Upload</Button>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const { url } = await uploadImage(file);
                        updateField("image", url);
                        message.success("Image uploaded");
                      } catch {
                        message.error("Failed to upload image");
                      }
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <input
                value={form.image}
                onChange={(e) => updateField("image", e.target.value)}
                placeholder="https://example.com/category-image.jpg"
                className="admin-input"
                style={{ flex: 1 }}
              />
            </Flex>
            {form.image && (
              <Image src={form.image} alt="Category preview" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 8, marginTop: 4 }} preview={false} />
            )}
          </Flex>

          {/* Category cover video */}
          <Flex vertical gap={6}>
            <Typography.Text className="admin-field-label">Category cover video</Typography.Text>
            <select
              value={form.cover_video ?? ""}
              onChange={(e) => updateField("cover_video", e.target.value || null)}
              className="admin-select"
            >
              <option value="">No cover video</option>
              {coverVideos.map((video) => (
                <option key={video.id} value={video.id}>
                  {[video.product_name, video.title || "Untitled video"].filter(Boolean).join(" — ")}
                </option>
              ))}
            </select>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Choose an uploaded product video. Add videos in Catalog → Product Videos first.
            </Typography.Text>
          </Flex>

          {/* Icon */}
          <Flex vertical gap={6}>
            <Typography.Text className="admin-field-label">Icon CSS Class</Typography.Text>
            <input
              value={form.icon}
              onChange={(e) => updateField("icon", e.target.value)}
              placeholder="e.g. fa-tag, material-icons"
              className="admin-input"
            />
          </Flex>

          {/* Aspect Ratio */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Aspect Ratio</Typography.Text>
              <input
                value={form.aspect_ratio}
                onChange={(e) => updateField("aspect_ratio", e.target.value)}
                placeholder="e.g. 4:5, 1:1, original"
                className="admin-input"
              />
            </Flex>
            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Aspect Width</Typography.Text>
              <input
                type="number"
                step="0.0001"
                value={form.aspect_width ?? ""}
                onChange={(e) => updateField("aspect_width", e.target.value ? Number(e.target.value) : null)}
                className="admin-input"
              />
            </Flex>
            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Aspect Height</Typography.Text>
              <input
                type="number"
                step="0.0001"
                value={form.aspect_height ?? ""}
                onChange={(e) => updateField("aspect_height", e.target.value ? Number(e.target.value) : null)}
                className="admin-input"
              />
            </Flex>
            <Flex vertical gap={6}>
              <Typography.Text className="admin-field-label">Aspect Unit</Typography.Text>
              <select
                value={form.aspect_unit}
                onChange={(e) => updateField("aspect_unit", e.target.value)}
                className="admin-select"
              >
                <option value="ratio">Ratio (unitless)</option>
                <option value="in">Inches</option>
                <option value="ft">Feet</option>
                <option value="cm">Centimeters</option>
                <option value="mm">Millimeters</option>
                <option value="px">Pixels</option>
              </select>
            </Flex>
          </div>

          {/* Status & Flags */}
          <Flex vertical gap={12} style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>Status &amp; Flags</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Control category visibility and featured status.
            </Typography.Text>
            <Flex vertical gap={10}>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_active} onChange={(c) => updateField("is_active", c)} />
                <Typography.Text style={{ fontSize: 13 }}>
                  {form.is_active ? "Active — Category is visible on the storefront" : "Active — Category is hidden"}
                </Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_visible} onChange={(c) => updateField("is_visible", c)} />
                <Typography.Text style={{ fontSize: 13 }}>
                  {form.is_visible ? "Visible — Category appears in navigation and listings" : "Visible — Category is hidden from navigation"}
                </Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_featured} onChange={(c) => updateField("is_featured", c)} />
                <Typography.Text style={{ fontSize: 13 }}>
                  {form.is_featured ? "Featured — Featured on storefront highlights" : "Featured — Not featured"}
                </Typography.Text>
              </Flex>
            </Flex>
          </Flex>

          {/* Aspect Ratio Propagation */}
          <Flex vertical gap={12} style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>Aspect Ratio Propagation</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Apply this category&apos;s aspect ratio to related entities after saving.
            </Typography.Text>
            <Flex vertical gap={10}>
              <Flex align="center" gap={8}>
                <Switch checked={form.apply_aspect_to_products} onChange={(c) => updateField("apply_aspect_to_products", c)} />
                <Typography.Text style={{ fontSize: 13 }}>Apply to products</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.apply_aspect_to_children} onChange={(c) => updateField("apply_aspect_to_children", c)} />
                <Typography.Text style={{ fontSize: 13 }}>Apply to direct children</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.set_aspect_default_for_descendants} onChange={(c) => updateField("set_aspect_default_for_descendants", c)} />
                <Typography.Text style={{ fontSize: 13 }}>Set as default for all descendants</Typography.Text>
              </Flex>
            </Flex>
          </Flex>

          {/* SEO */}
          <Flex vertical gap={16} style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>Search Engine Optimization</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Leave blank to derive from category name and description.
            </Typography.Text>
            <Flex vertical gap={4}>
              <label className="admin-field-label">Meta Title</label>
              <input
                value={form.meta_title}
                onChange={(e) => updateField("meta_title", e.target.value)}
                placeholder={form.name ? `${form.name} | Bunoraa` : "SEO title for search results"}
                maxLength={255}
                className="admin-input"
              />
              <span style={{ fontSize: 10, color: "var(--admin-muted-light)" }}>{(form.meta_title || form.name || "").length}/255</span>
            </Flex>
            <Flex vertical gap={4}>
              <label className="admin-field-label">Meta Description</label>
              <textarea
                value={form.meta_description}
                onChange={(e) => updateField("meta_description", e.target.value)}
                placeholder={form.description || "Brief description for search engines (~150–160 characters)"}
                rows={3}
                maxLength={500}
                className="admin-textarea"
              />
              <span style={{ fontSize: 10, color: "var(--admin-muted-light)" }}>{(form.meta_description || form.description || "").length}/500</span>
            </Flex>
            <Flex vertical gap={4}>
              <label className="admin-field-label">Meta Keywords</label>
              <input
                value={form.meta_keywords}
                onChange={(e) => updateField("meta_keywords", e.target.value)}
                placeholder="Comma-separated keywords, e.g. handmade, cotton, gift"
                maxLength={500}
                className="admin-input"
              />
            </Flex>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
}

export function AdminCategoryEditorPage({ action, id }: { action: "list" | "create" | "edit" | "show"; id?: BaseKey }) {
  switch (action) {
    case "list":
      return <CategoryListView />;
    case "show":
      return <CategoryShowView id={id!} />;
    case "create":
    case "edit":
      return <CategoryFormView action={action} id={id} />;
    default:
      return null;
  }
}
