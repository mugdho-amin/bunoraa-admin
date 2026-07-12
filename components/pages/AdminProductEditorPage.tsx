"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCreate, useList, useOne, useUpdate } from "@refinedev/core";
import { Button, Card, Collapse, Flex, Typography, message, Spin, Tag } from "antd";
import Image from "next/image";
import {
  Plus, Trash2, Upload, X, Check, WandSparkles, GripVertical,
  Copy, ChevronDown, ChevronUp, Package,
  Eye, EyeOff, Search, Grid3X3, ArrowLeft,
} from "lucide-react";
import type { BaseKey } from "@refinedev/core";
import { CategoryTreeSelect, type CategoryNode } from "@/components/forms/CategoryTreeSelect";

interface VariantForm {
  sku: string; size: string; color: string; stock: number | null; price: number | null;
  compareAt: number | null; image: string; weight: number | null; barcode: string;
  lowStockThreshold: number; enabled: boolean; sortOrder: number;
}

interface GalleryImage {
  url: string;
  variantIds: string[];
}

interface ProductForm {
  name: string; slug: string; sku: string;
  short_description: string; description: string;
  primaryImage: string; gallery: GalleryImage[];
  price: number | null; sale_price: number | null; cost: number | null; currency: string;
  stock_quantity: number; low_stock_threshold: number; allow_backorder: boolean;
  weight: number | null;
  variants: VariantForm[]; categoryIds: string[]; primaryCategoryId: string;
  is_featured: boolean; is_bestseller: boolean; is_new_arrival: boolean;
  meta_title: string; meta_description: string; meta_keywords: string;
}

const COLOR_PRESETS = [
  { name: "Black", hex: "#000000" }, { name: "White", hex: "#FFFFFF" },
  { name: "Navy", hex: "#1B2838" }, { name: "Charcoal", hex: "#36454F" },
  { name: "Gray", hex: "#808080" }, { name: "Red", hex: "#CC0000" },
  { name: "Maroon", hex: "#800000" }, { name: "Burgundy", hex: "#900020" },
  { name: "Green", hex: "#2E7D32" }, { name: "Olive", hex: "#808000" },
  { name: "Blue", hex: "#1565C0" }, { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Brown", hex: "#6D4C41" }, { name: "Beige", hex: "#F5F5DC" },
  { name: "Cream", hex: "#FFFDD0" }, { name: "Khaki", hex: "#C3B091" },
  { name: "Orange", hex: "#FF6F00" }, { name: "Yellow", hex: "#F9A825" },
  { name: "Purple", hex: "#6A1B9A" }, { name: "Pink", hex: "#E91E63" },
];

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Free"];

const colorMap = new Map(COLOR_PRESETS.map((c) => [c.name.toLowerCase(), c.hex]));
const getColorHex = (name: string): string => colorMap.get(name.toLowerCase()) ?? "#cccccc";

const CURRENCY_OPTIONS = [
  { value: "BDT", label: "BDT (৳)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "INR", label: "INR (₹)" },
];

/** Parse money/decimal inputs; empty → null, invalid → null. */
const parseDecimal = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

const emptyVariant = (sortOrder = 0): VariantForm => ({
  sku: "", size: "", color: "", stock: null, price: null,
  compareAt: null, image: "", weight: null, barcode: "",
  lowStockThreshold: 5, enabled: true, sortOrder,
});

const emptyForm: ProductForm = {
  name: "", slug: "", sku: "", short_description: "", description: "",
  primaryImage: "", gallery: [], price: null, sale_price: null, cost: null, currency: "BDT",
  stock_quantity: 0, low_stock_threshold: 5, allow_backorder: false, weight: null,
  variants: [emptyVariant(0)], categoryIds: [], primaryCategoryId: "",
  is_featured: false, is_bestseller: false, is_new_arrival: false,
  meta_title: "", meta_description: "", meta_keywords: "",
};

export function AdminProductEditorPage({ id }: { id?: BaseKey }) {
  const router = useRouter();
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set([0]));
  const [variantSearch, setVariantSearch] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [galleryDragIndex, setGalleryDragIndex] = useState<number | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixSizes, setMatrixSizes] = useState("");
  const [matrixColors, setMatrixColors] = useState("");
  const [hasVariants, setHasVariants] = useState(false);
  const slugManuallyEdited = useRef(false);
  const variantContainerRef = useRef<HTMLDivElement>(null);

  const { query: existingQuery, result: existing } = useOne({
    resource: "catalog/products",
    id: id ?? "",
    queryOptions: { enabled: !!id },
  });
  const loadingProduct = existingQuery.isLoading;

  const { result: categoriesResult } = useList({
    resource: "catalog/categories",
    pagination: { pageSize: 500 },
    sorters: [{ field: "path", order: "asc" }],
  });
  const categories = useMemo(
    () => (categoriesResult?.data ?? []) as CategoryNode[],
    [categoriesResult],
  );

  const { mutate: createProduct } = useCreate();
  const { mutate: updateProduct } = useUpdate();
  const product = existing;

  const formInitialized = useRef(false);

  const initForm = useCallback(() => {
    if (formInitialized.current) return;
    if (id && product) {
      formInitialized.current = true;
      slugManuallyEdited.current = true;
      const rawGallery = product.images ?? [];
      const mappedGallery: GalleryImage[] = rawGallery.map((item: string | { image?: string; url?: string; variantIds?: string[] }) => {
        if (typeof item === "string") return { url: item, variantIds: [] };
        return { url: item.image || item.url || "", variantIds: item.variantIds ?? [] };
      });
      const variants: VariantForm[] = (product.variants ?? []).map((v: Record<string, unknown>, i: number) => ({
        sku: (v.sku as string) ?? "", size: (v.size as string) ?? "", color: (v.color as string) ?? "",
        stock: (v.stock_quantity ?? v.stock ?? null) as number | null, price: (v.price as number) ?? null,
        compareAt: (v.compare_at_price ?? v.compareAt ?? null) as number | null, image: (v.image as string) ?? "",
        weight: (v.weight as number) ?? null, barcode: (v.barcode as string) ?? "",
        lowStockThreshold: (v.low_stock_threshold ?? v.lowStockThreshold ?? 5) as number,
        enabled: (v.is_active ?? v.enabled ?? true) as boolean, sortOrder: (v.sort_order ?? v.sortOrder ?? i) as number,
      }));
      const hasOptions = variants.some((v) => v.size || v.color);
      setHasVariants(hasOptions);
      setForm({
        name: product.name ?? "",
        slug: product.slug ?? "",
        sku: product.sku ?? "",
        short_description: product.short_description ?? "",
        description: product.description ?? "",
        primaryImage: product.primary_image ?? "",
        gallery: mappedGallery,
        price: product.price ? Number(product.price) : null,
        sale_price: product.sale_price ? Number(product.sale_price) : null,
        cost: product.cost ? Number(product.cost) : null,
        currency: product.currency ?? "BDT",
        stock_quantity: product.stock_quantity ?? 0,
        low_stock_threshold: product.low_stock_threshold ?? 5,
        allow_backorder: product.allow_backorder ?? false,
        weight: product.weight ? Number(product.weight) : null,
        variants: variants.length ? variants : [emptyVariant(0)],
        categoryIds: (product.categories ?? []).map((c: { id?: string; category?: { id?: string } }) => c.id ?? c.category?.id).filter(Boolean) as string[],
        primaryCategoryId: String(
          product.primary_category?.id
            ?? product.primary_category_id
            ?? product.primary_category
            ?? "",
        ),
        is_featured: product.is_featured ?? false,
        is_bestseller: product.is_bestseller ?? false,
        is_new_arrival: product.is_new_arrival ?? false,
        meta_title: product.meta_title ?? "",
        meta_description: product.meta_description ?? "",
        meta_keywords: product.meta_keywords ?? "",
      });
    } else if (!id) {
      formInitialized.current = true;
    }
  }, [id, product]);

  useEffect(() => {
    const timer = setTimeout(() => initForm(), 0);
    return () => clearTimeout(timer);
  }, [initForm]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

  const handleNameChange = (value: string) => {
    updateField("name", value);
    if (!slugManuallyEdited.current) updateField("slug", slugify(value));
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const updateField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    clearFieldError(key);
    setForm((p) => ({ ...p, [key]: value }));
  };

  const updateVariant = (index: number, key: keyof VariantForm, value: string | number | boolean | null) => {
    clearFieldError(`variants.${index}.${key}`);
    setForm((p) => {
      const next = p.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v));
      return { ...p, variants: next };
    });
  };

  const toggleVariants = () => {
    const next = !hasVariants;
    setHasVariants(next);
    if (next) {
      if (form.variants.length === 1 && !form.variants[0].size && !form.variants[0].color) {
        setForm((p) => ({
          ...p,
          variants: p.variants.map((v) => ({
            ...v,
            price: v.price ?? p.price,
            compareAt: v.compareAt ?? p.sale_price ?? null,
          })),
        }));
      }
    }
  };

  const addVariant = () => {
    const idx = form.variants.length;
    setForm((p) => ({ ...p, variants: [...p.variants, { ...emptyVariant(idx), price: p.price }] }));
    setExpandedVariants((prev) => new Set(prev).add(idx));
    setTimeout(() => variantContainerRef.current?.scrollTo({ top: variantContainerRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const removeVariant = (index: number) => {
    setForm((p) => {
      const next = p.variants.filter((_, i) => i !== index).map((v, i) => ({ ...v, sortOrder: i }));
      return { ...p, variants: next.length ? next : [{ ...emptyVariant(0), price: p.price }] };
    });
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      next.delete(index);
      const adjusted = new Set<number>();
      for (const v of next) adjusted.add(v > index ? v - 1 : v);
      return adjusted;
    });
  };

  const duplicateVariant = (index: number) => {
    const idx = form.variants.length;
    setForm((p) => {
      const clone = { ...p.variants[index], sku: "", sortOrder: idx };
      return { ...p, variants: [...p.variants, clone] };
    });
    setExpandedVariants((prev) => new Set(prev).add(idx));
  };

  const toggleVariantExpand = (index: number) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const handleCategoriesChange = (ids: string[]) => {
    clearFieldError("categoryIds");
    setForm((p) => {
      // Keep primary in the categories set (matches Django admin save behavior).
      const next = [...ids];
      if (p.primaryCategoryId && !next.includes(p.primaryCategoryId)) {
        next.push(p.primaryCategoryId);
      }
      return { ...p, categoryIds: next };
    });
  };

  const handlePrimaryCategoryChange = (ids: string[]) => {
    clearFieldError("primaryCategoryId");
    clearFieldError("categoryIds");
    const primaryId = ids[0] ?? "";
    setForm((p) => {
      const nextCategories = new Set(p.categoryIds);
      // Drop previous primary if it was only present as primary auto-add.
      if (p.primaryCategoryId && p.primaryCategoryId !== primaryId) {
        // Keep old primary if user explicitly selected it among categories
        // (still in categoryIds intentionally) — only ensure new primary is added.
      }
      if (primaryId) nextCategories.add(primaryId);
      return {
        ...p,
        primaryCategoryId: primaryId,
        categoryIds: Array.from(nextCategories),
      };
    });
  };

  const generateSku = (size: string, color: string): string => {
    const prefix = "BUN";
    const sizeCode = size ? size.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2) : "OS";
    const colorCode = color ? color.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) : "XX";
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${sizeCode}-${colorCode}-${rand}`;
  };

  const generateBarcode = (): string => {
    const prefix = "BN";
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${rand}`;
  };

  const generateSingleBarcode = (index: number) => {
    setForm((p) => {
      const next = [...p.variants];
      next[index] = { ...next[index], barcode: generateBarcode() };
      return { ...p, variants: next };
    });
  };

  const generateSingleSku = (index: number) => {
    setForm((p) => {
      const v = p.variants[index];
      const next = [...p.variants];
      next[index] = { ...v, sku: generateSku(v.size, v.color) };
      return { ...p, variants: next };
    });
  };

  const generateAllSkus = () => {
    setForm((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ ...v, sku: generateSku(v.size, v.color) })),
    }));
  };

  const getStockStatus = (stock: number | null, threshold: number) => {
    if (stock === null || stock === undefined) return { label: "N/A", color: "default" as const };
    if (stock <= 0) return { label: "Out of Stock", color: "error" as const };
    if (stock <= threshold) return { label: "Low Stock", color: "warning" as const };
    return { label: "In Stock", color: "success" as const };
  };

  const moveVariant = (from: number, to: number) => {
    if (to < 0 || to >= form.variants.length) return;
    setForm((p) => {
      const next = [...p.variants];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...p, variants: next.map((v, i) => ({ ...v, sortOrder: i })) };
    });
  };

  const handleDragStart = (index: number) => { setDragIndex(index); };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    moveVariant(dragIndex, index);
    setDragIndex(index);
  };
  const handleDragEnd = () => { setDragIndex(null); };

  const handleFileUpload = (key: "primaryImage" | "gallery", file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (key === "primaryImage") {
        clearFieldError("primaryImage");
        updateField("primaryImage", dataUrl);
      } else {
        setForm((prev) => ({ ...prev, gallery: [...prev.gallery, { url: dataUrl, variantIds: [] }] }));
      }
    };
    reader.onerror = () => message.error("Failed to read file");
    reader.readAsDataURL(file);
  };

  const handleMultipleGalleryUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const results: string[] = [];
    let completed = 0;
    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      const idx = i;
      reader.onload = (e) => {
        results[idx] = e.target?.result as string;
        completed++;
        if (completed === files.length) {
          setForm((prev) => ({
            ...prev,
            gallery: [...prev.gallery, ...results.map((url) => ({ url, variantIds: [] }))],
          }));
        }
      };
      reader.onerror = () => { completed++; };
      reader.readAsDataURL(files[i]);
    }
  };

  const handleAddGalleryUrl = () => {
    const url = prompt("Enter image URL:");
    if (url) updateField("gallery", [...form.gallery, { url, variantIds: [] }]);
  };

  const handleRemoveGalleryImage = (index: number) => {
    updateField("gallery", form.gallery.filter((_, j) => j !== index));
  };

  const generateMatrix = () => {
    const sizes = matrixSizes.split(",").map((s) => s.trim()).filter(Boolean);
    const colors = matrixColors.split(",").map((c) => c.trim()).filter(Boolean);
    if (sizes.length === 0 || colors.length === 0) {
      message.error("Enter at least one size and one color"); return;
    }
    let idx = form.variants.length;
    const generated: VariantForm[] = [];
    for (const size of sizes) {
      for (const color of colors) {
        generated.push({ ...emptyVariant(idx++), size, color, price: form.price });
      }
    }
    if (generated.length === 0) return;
    setForm((p) => ({ ...p, variants: [...p.variants, ...generated] }));
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      for (let i = form.variants.length; i < form.variants.length + generated.length; i++) next.add(i);
      return next;
    });
    setMatrixOpen(false);
    message.success(`${generated.length} variants generated from matrix`);
  };

  const applyBasePriceToVariants = () => {
    if (form.price === null || form.price === undefined) {
      message.error("Set a base price first"); return;
    }
    setForm((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, price: p.price })) }));
  };

  const sortVariantsBy = (key: keyof Pick<VariantForm, "size" | "color" | "price" | "stock" | "sku">) => {
    setForm((p) => {
      const next = [...p.variants].sort((a, b) => {
        const va = a[key] ?? "";
        const vb = b[key] ?? "";
        return String(va).localeCompare(String(vb), undefined, { numeric: true });
      });
      return { ...p, variants: next.map((v, i) => ({ ...v, sortOrder: i })) };
    });
  };

  const clearAllVariants = () => {
    setForm((p) => ({ ...p, variants: [emptyVariant(0)] }));
    setExpandedVariants(new Set([0]));
    message.success("Variants cleared");
  };

  const toggleVariantEnabled = (index: number) => {
    setForm((p) => {
      const next = p.variants.map((v, i) => (i === index ? { ...v, enabled: !v.enabled } : v));
      return { ...p, variants: next };
    });
  };

  const handleVariantImageUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => updateVariant(index, "image", e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.name) newErrors["name"] = "Product name is required";
    if (!form.slug) newErrors["slug"] = "Slug is required";
    if (form.price === null || form.price === undefined || form.price <= 0) newErrors["price"] = "Price must be greater than 0";
    if (!form.primaryCategoryId) newErrors["primaryCategoryId"] = "Primary category is required";
    if (!form.categoryIds || form.categoryIds.length === 0) newErrors["categoryIds"] = "At least one category is required";

    if (hasVariants) {
      form.variants.forEach((v, i) => {
        if (!v.sku) newErrors[`variants.${i}.sku`] = "SKU is required";
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      message.error("Validation failed. Please check all fields.");
      return;
    }

    setFieldErrors({});
    setSaving(true);

    const cleanVariants = form.variants.map((v, i) => ({
      sku: v.sku.trim(),
      size: v.size || null,
      color: v.color || null,
      stock_quantity: Number(v.stock ?? 0),
      price: v.price === null || v.price === undefined ? null : Number(v.price),
      compare_at_price: v.compareAt === null || v.compareAt === undefined ? null : Number(v.compareAt),
      weight: v.weight === null || v.weight === undefined ? null : Number(v.weight),
      barcode: v.barcode?.trim() || null,
      image: v.image || null,
      low_stock_threshold: v.lowStockThreshold ?? 5,
      is_active: v.enabled,
      sort_order: i,
    }));

    const values = {
      name: form.name,
      slug: form.slug,
      sku: hasVariants ? null : (form.variants[0]?.sku || null),
      short_description: form.short_description,
      description: form.description,
      primary_image: form.primaryImage || null,
      images: form.gallery.map((g) => g.url),
      price: Number(form.price ?? 0),
      sale_price: form.sale_price === null || form.sale_price === undefined ? null : Number(form.sale_price),
      cost: form.cost === null || form.cost === undefined ? null : Number(form.cost),
      currency: form.currency,
      stock_quantity: hasVariants ? 0 : Number(form.variants[0]?.stock ?? 0),
      low_stock_threshold: form.low_stock_threshold,
      allow_backorder: form.allow_backorder,
      weight: form.weight === null || form.weight === undefined ? null : Number(form.weight),
      variants: hasVariants ? cleanVariants : [],
      categories: form.categoryIds,
      primary_category: form.primaryCategoryId || null,
      primary_category_id: form.primaryCategoryId || null,
      is_featured: form.is_featured,
      is_bestseller: form.is_bestseller,
      is_new_arrival: form.is_new_arrival,
      meta_title: (form.meta_title || form.name || "").trim(),
      meta_description: (form.meta_description || form.short_description || "").trim(),
      meta_keywords: (form.meta_keywords || "").trim(),
    };

    try {
      if (id) {
        updateProduct(
          { resource: "catalog/products", id, values },
          {
            onSuccess: () => { message.success("Product updated"); router.push("/catalog/products"); },
            onError: (err) => message.error(err?.message || "Failed to update product"),
          },
        );
      } else {
        createProduct(
          { resource: "catalog/products", values },
          {
            onSuccess: () => { message.success("Product created"); router.push("/catalog/products"); },
            onError: (err) => message.error(err?.message || "Failed to create product"),
          },
        );
      }
    } catch {
      message.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const filteredVariants = useMemo(() => {
    if (!variantSearch.trim()) return form.variants;
    const q = variantSearch.toLowerCase();
    return form.variants.filter(
      (v) => v.sku.toLowerCase().includes(q) || v.size.toLowerCase().includes(q) ||
             v.color.toLowerCase().includes(q) || v.barcode.toLowerCase().includes(q),
    );
  }, [form.variants, variantSearch]);

  const enabledCount = form.variants.filter((v) => v.enabled).length;
  const totalStock = form.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  const outOfStockCount = form.variants.filter((v) => v.stock !== null && v.stock <= 0).length;

  if (id && loadingProduct) {
    return <Flex justify="center" align="center" style={{ minHeight: 300 }}><Spin size="large" /></Flex>;
  }

  return (
    <Flex vertical gap={20}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Flex align="center" gap={12}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => router.push("/catalog/products")} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            {id ? "Edit Product" : "Create Product"}
          </Typography.Title>
        </Flex>
        <Button type="primary" icon={<Check size={16} />} onClick={handleSave} loading={saving}>
          Save
        </Button>
      </Flex>

      {/* Product Type Toggle */}
      <Card className="admin-soft-panel" variant="borderless" style={{ padding: "12px 0" }}>
        <Flex align="center" gap={16} wrap="wrap">
          <div style={{ display: "flex", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <button onClick={() => { if (hasVariants) toggleVariants(); }}
              style={{
                padding: "8px 20px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.2em",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                background: !hasVariants ? "#0f766e" : "transparent",
                color: !hasVariants ? "#fff" : "rgba(0,0,0,0.45)",
              }}>
              Simple Product
            </button>
            <button onClick={() => { if (!hasVariants) toggleVariants(); }}
              style={{
                padding: "8px 20px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.2em",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                background: hasVariants ? "#0f766e" : "transparent",
                color: hasVariants ? "#fff" : "rgba(0,0,0,0.45)",
              }}>
              Has Variants
            </button>
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 300 }}>
            {hasVariants
              ? "Each option combination (size/color) is a variant with its own price, SKU, and stock."
              : "A single item with one price, SKU, and stock."}
          </Typography.Text>
        </Flex>
      </Card>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: hasVariants ? "1fr 2fr" : "1fr" }}>
        {/* ── Left Column: Product Info ── */}
        <Flex vertical gap={20}>
          <Card className="admin-soft-panel" variant="borderless" title="Basic Information">
            <Flex vertical gap={4}>
              <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Name *</label>
              <input value={form.name} onChange={(e) => handleNameChange(e.target.value)}
                style={{
                  width: "100%", padding: "10px 16px", borderRadius: 12, border: `1px solid ${fieldErrors["name"] ? "#be123c" : "rgba(0,0,0,0.1)"}`,
                  fontSize: 14, outline: "none", background: fieldErrors["name"] ? "rgba(190,18,60,0.04)" : "#fff",
                }} />
              {fieldErrors["name"] && <span style={{ fontSize: 10, color: "#be123c", fontWeight: 500 }}>{fieldErrors["name"]}</span>}
            </Flex>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Flex vertical gap={4}>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Slug *</label>
                <input value={form.slug} onChange={(e) => { slugManuallyEdited.current = true; updateField("slug", e.target.value); }}
                  onFocus={() => slugManuallyEdited.current = true}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 12, border: `1px solid ${fieldErrors["slug"] ? "#be123c" : "rgba(0,0,0,0.1)"}`,
                    fontSize: 14, outline: "none", background: fieldErrors["slug"] ? "rgba(190,18,60,0.04)" : "#fff",
                  }} />
                {fieldErrors["slug"] && <span style={{ fontSize: 10, color: "#be123c", fontWeight: 500 }}>{fieldErrors["slug"]}</span>}
              </Flex>
              <Flex vertical gap={4}>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>SKU</label>
                <input value={form.sku} onChange={(e) => updateField("sku", e.target.value)}
                  style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }} />
              </Flex>
            </div>
            <Flex vertical gap={4} style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Short Description</label>
              <textarea value={form.short_description} onChange={(e) => updateField("short_description", e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", resize: "vertical" }} />
            </Flex>
            <Flex vertical gap={4} style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Description</label>
              <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)}
                rows={6}
                style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", resize: "vertical" }} />
            </Flex>
          </Card>

          {/* Primary Image */}
          <Card className="admin-soft-panel" variant="borderless" title="Primary Image">
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
              <label style={{
                display: "flex", cursor: "pointer", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, color: "rgba(0,0,0,0.45)",
              }}>
                <Upload size={14} /> Choose File
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload("primaryImage", f); e.target.value = ""; }} />
              </label>
              <input value={form.primaryImage} onChange={(e) => { clearFieldError("primaryImage"); updateField("primaryImage", e.target.value); }}
                placeholder="https://cdn.bunoraa.com/images/product.jpg"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 12, border: `1px solid ${fieldErrors["primaryImage"] ? "#be123c" : "rgba(0,0,0,0.1)"}`,
                  fontSize: 13, outline: "none",
                }} />
            </div>
            {fieldErrors["primaryImage"] && <span style={{ fontSize: 10, color: "#be123c", fontWeight: 500 }}>{fieldErrors["primaryImage"]}</span>}
            {form.primaryImage && (
              <div style={{ position: "relative", display: "inline-block", marginTop: 8 }}>
                <Image src={form.primaryImage} alt="Primary" width={64} height={80} unoptimized style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", objectFit: "cover" }} />
                <button onClick={() => updateField("primaryImage", "")}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#be123c", color: "#fff", fontSize: 10, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ×
                </button>
              </div>
            )}
          </Card>

          {/* Gallery */}
          <Card className="admin-soft-panel" variant="borderless" title={"Gallery Images" + (hasVariants && form.variants.length > 1 ? " — click an image, then check which variant(s) it belongs to" : "")}>
            {form.gallery.length > 0 && (
              <Flex vertical gap={8}>
                {form.gallery.map((img, i) => (
                  <div key={i}
                    style={{
                      borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", padding: 12,
                      opacity: galleryDragIndex === i ? 0.5 : 1,
                    }}
                    draggable
                    onDragStart={() => setGalleryDragIndex(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (galleryDragIndex === null || galleryDragIndex === i) return;
                      setForm((p) => {
                        const next = [...p.gallery];
                        const [moved] = next.splice(galleryDragIndex, 1);
                        next.splice(i, 0, moved);
                        return { ...p, gallery: next };
                      });
                      setGalleryDragIndex(i);
                    }}
                    onDragEnd={() => setGalleryDragIndex(null)}
                  >
                    <Flex gap={12} align="start">
                      <div style={{ cursor: "grab", color: "rgba(0,0,0,0.2)", marginTop: 4 }}>
                        <GripVertical size={16} />
                      </div>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <Image src={img.url} alt={`Gallery ${i}`} width={48} height={64} unoptimized style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", objectFit: "cover" }} />
                        <button onClick={() => handleRemoveGalleryImage(i)}
                          style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#be123c", color: "#fff", fontSize: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          ×
                        </button>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Typography.Text style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(0,0,0,0.45)" }} ellipsis>{img.url}</Typography.Text>
                        {hasVariants && form.variants.length > 1 && (
                          <Flex wrap="wrap" gap={4} style={{ marginTop: 6 }}>
                            {form.variants.map((v, vi) => {
                              const checked = img.variantIds.includes(String(vi));
                              return (
                                <label key={vi} style={{
                                  display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, border: "1px solid",
                                  fontSize: 10, cursor: "pointer", transition: "all 0.15s",
                                  background: checked ? "#0f766e" : "transparent",
                                  color: checked ? "#fff" : "rgba(0,0,0,0.45)",
                                  borderColor: checked ? "#0f766e" : "rgba(0,0,0,0.12)",
                                }}>
                                  <input type="checkbox" checked={checked} onChange={() => {
                                    setForm((p) => {
                                      const next = p.gallery.map((g, gi) => {
                                        if (gi !== i) return g;
                                        const ids = g.variantIds.includes(String(vi))
                                          ? g.variantIds.filter((vid) => vid !== String(vi))
                                          : [...g.variantIds, String(vi)];
                                        return { ...g, variantIds: ids };
                                      });
                                      return { ...p, gallery: next };
                                    });
                                  }} style={{ display: "none" }} />
                                  {v.size && <span>{v.size}</span>}
                                  {v.size && v.color && <span>/</span>}
                                  {v.color && <span>{v.color}</span>}
                                  {!v.size && !v.color && <span>Variant {vi + 1}</span>}
                                </label>
                              );
                            })}
                          </Flex>
                        )}
                      </div>
                    </Flex>
                  </div>
                ))}
              </Flex>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleMultipleGalleryUpload(e.dataTransfer.files); }}>
              <button onClick={handleAddGalleryUrl}
                style={{ padding: "8px 16px", borderRadius: 12, border: "1px dashed rgba(0,0,0,0.15)", fontSize: 11, color: "rgba(0,0,0,0.45)", cursor: "pointer", background: "none" }}>
                + Add URL
              </button>
              <label style={{ padding: "8px 16px", borderRadius: 12, border: "1px dashed rgba(0,0,0,0.15)", fontSize: 11, color: "rgba(0,0,0,0.45)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> Upload Files
                <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handleMultipleGalleryUpload(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </Card>

          {/* Base Price */}
          <Card className="admin-soft-panel" variant="borderless" title={hasVariants ? "Listing Price (shown on collections)" : "Price"}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: hasVariants ? "1fr 1fr" : "1fr 1fr 1fr" }}>
              <Flex vertical gap={4}>
                <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Price *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.price ?? ""}
                  onChange={(e) => {
                    const val = parseDecimal(e.target.value);
                    clearFieldError("price");
                    setForm((prev) => ({
                      ...prev,
                      price: val,
                      variants: prev.variants.map((v) => ({
                        ...v,
                        price: (v.price === null || v.price === 0 || v.price === prev.price) ? val : v.price,
                      })),
                    }));
                  }}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 12, border: `1px solid ${fieldErrors["price"] ? "#be123c" : "rgba(0,0,0,0.1)"}`,
                    fontSize: 14, outline: "none", background: fieldErrors["price"] ? "rgba(190,18,60,0.04)" : "#fff",
                  }}
                />
                {fieldErrors["price"] && <span style={{ fontSize: 10, color: "#be123c", fontWeight: 500 }}>{fieldErrors["price"]}</span>}
                {hasVariants && form.variants.length > 1 && form.price !== null && (
                  <button onClick={applyBasePriceToVariants} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "#0f766e", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    Apply to all variants
                  </button>
                )}
              </Flex>
              <Flex vertical gap={4}>
                <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Sale Price</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.sale_price ?? ""}
                  onChange={(e) => updateField("sale_price", parseDecimal(e.target.value))}
                  style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }}
                />
              </Flex>
              <Flex vertical gap={4}>
                <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Currency</label>
                <select value={form.currency} onChange={(e) => updateField("currency", e.target.value)}
                  style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", background: "#fff" }}>
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Flex>
            </div>

            {/* Simple Product Fields */}
            {!hasVariants && (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr", marginTop: 16 }}>
                <Flex vertical gap={4}>
                  <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Stock</label>
                  <input type="number" value={form.variants[0]?.stock ?? ""} onChange={(e) => updateVariant(0, "stock", e.target.value ? Number(e.target.value) : null)}
                    style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }} />
                </Flex>
                <Flex vertical gap={4}>
                  <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Low Stock Threshold</label>
                  <input type="number" value={form.variants[0]?.lowStockThreshold ?? 5} onChange={(e) => updateVariant(0, "lowStockThreshold", Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }} />
                </Flex>
                <Flex vertical gap={4}>
                  <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Weight (kg)</label>
                  <input type="number" step="0.01" value={form.variants[0]?.weight ?? ""} onChange={(e) => updateVariant(0, "weight", e.target.value ? Number(e.target.value) : null)}
                    style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }} />
                </Flex>
              </div>
            )}
          </Card>

          {/* Simple Product SKU/Barcode */}
          {!hasVariants && (
            <Card className="admin-soft-panel" variant="borderless" title="Product Identifiers">
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <Flex vertical gap={4}>
                  <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>SKU *</label>
                  <div style={{ position: "relative" }}>
                    <input type="text" value={form.variants[0]?.sku ?? ""}
                      onChange={(e) => { clearFieldError("variants.0.sku"); updateVariant(0, "sku", e.target.value); }}
                      style={{
                        width: "100%", padding: "10px 40px 10px 16px", borderRadius: 12,
                        border: `1px solid ${fieldErrors["variants.0.sku"] ? "#be123c" : "rgba(0,0,0,0.1)"}`,
                        fontSize: 14, outline: "none",
                      }} />
                    <button onClick={() => generateSingleSku(0)}
                      style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.35)" }}>
                      <WandSparkles size={14} />
                    </button>
                  </div>
                  {fieldErrors["variants.0.sku"] && <span style={{ fontSize: 10, color: "#be123c", fontWeight: 500 }}>{fieldErrors["variants.0.sku"]}</span>}
                </Flex>
                <Flex vertical gap={4}>
                  <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Barcode / EAN</label>
                  <div style={{ position: "relative" }}>
                    <input type="text" value={form.variants[0]?.barcode ?? ""}
                      onChange={(e) => updateVariant(0, "barcode", e.target.value)}
                      style={{ width: "100%", padding: "10px 40px 10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }} />
                    <button onClick={() => generateSingleBarcode(0)}
                      style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.35)" }}>
                      <WandSparkles size={14} />
                    </button>
                  </div>
                </Flex>
              </div>
            </Card>
          )}

          {/* Classification & SEO — collapsed sections for simple products */}
          <Collapse
            className="admin-soft-panel"
            defaultActiveKey={["categories"]}
            expandIconPosition="end"
            size="small"
            items={[
                {
                  key: "categories",
                  label: (
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      Categories {!form.primaryCategoryId && <Tag color="error" style={{ marginLeft: 8, fontSize: 10 }}>Required</Tag>}
                    </span>
                  ),
                  children: (
                    <Flex vertical gap={16} style={{ padding: "4px 0" }}>
                      <Flex vertical gap={6}>
                        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
                          Primary Category *
                        </label>
                        <CategoryTreeSelect
                          categories={categories}
                          value={form.primaryCategoryId ? [form.primaryCategoryId] : []}
                          onChange={handlePrimaryCategoryChange}
                          multiple={false}
                          placeholder="Search or browse primary category..."
                          error={fieldErrors["primaryCategoryId"]}
                        />
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          Main category used for breadcrumbs, SEO paths, and storefront navigation.
                        </Typography.Text>
                      </Flex>
                      <Flex vertical gap={6}>
                        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
                          Additional Categories
                        </label>
                        <CategoryTreeSelect
                          categories={categories}
                          value={form.categoryIds}
                          onChange={handleCategoriesChange}
                          multiple
                          placeholder="Search or browse additional categories..."
                          error={fieldErrors["categoryIds"]}
                        />
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          Secondary categories for cross-listing and filtering.
                        </Typography.Text>
                      </Flex>
                    </Flex>
                  ),
                },
                {
                  key: "seo",
                  label: (
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      Search Engine Optimization
                    </span>
                  ),
                  children: (
                    <Flex vertical gap={12} style={{ padding: "4px 0" }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Search engine metadata. Leave blank to derive from product name and short description.
                      </Typography.Text>
                      <Flex vertical gap={4}>
                        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
                          Meta Title
                        </label>
                        <input
                          value={form.meta_title}
                          onChange={(e) => updateField("meta_title", e.target.value)}
                          placeholder={form.name ? `${form.name} | Bunoraa` : "SEO title for search results"}
                          maxLength={255}
                          style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }}
                        />
                        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
                          {(form.meta_title || form.name || "").length}/255
                        </span>
                      </Flex>
                      <Flex vertical gap={4}>
                        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
                          Meta Description
                        </label>
                        <textarea
                          value={form.meta_description}
                          onChange={(e) => updateField("meta_description", e.target.value)}
                          placeholder={form.short_description || "Brief description for search engines (recommended ~150–160 characters)"}
                          rows={3}
                          maxLength={500}
                          style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", resize: "vertical" }}
                        />
                        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>
                          {(form.meta_description || form.short_description || "").length}/500
                        </span>
                      </Flex>
                      <Flex vertical gap={4}>
                        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
                          Meta Keywords
                        </label>
                        <input
                          value={form.meta_keywords}
                          onChange={(e) => updateField("meta_keywords", e.target.value)}
                          placeholder="Comma-separated keywords, e.g. handmade, cotton, gift"
                          maxLength={500}
                          style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none" }}
                        />
                      </Flex>
                    </Flex>
                  ),
                },
              ]}
          />
        </Flex>

        {/* ── Right Column: Variants (only when toggle is ON) ── */}
        {hasVariants && (
          <Flex vertical gap={16}>
            <Card className="admin-soft-panel" variant="borderless" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 24px" }}>
                <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                  <Flex align="center" gap={8}>
                    <Package size={16} color="rgba(0,0,0,0.45)" />
                    <Typography.Text strong style={{ textTransform: "uppercase", letterSpacing: "0.3em", fontSize: 13 }}>
                      Variants <span style={{ color: "rgba(0,0,0,0.35)", fontWeight: 400 }}>({form.variants.length})</span>
                    </Typography.Text>
                  </Flex>
                  <Flex gap={6}>
                    <Button size="small" onClick={() => setMatrixOpen(!matrixOpen)} icon={<Grid3X3 size={14} />}>Matrix</Button>
                    <Button size="small" onClick={addVariant} icon={<Plus size={14} />}>Add</Button>
                  </Flex>
                </Flex>
              </div>

              {/* Matrix Generator */}
              {matrixOpen && (
                <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: 20, background: "rgba(0,0,0,0.02)" }}>
                  <Flex align="center" gap={8}>
                    <Grid3X3 size={16} color="rgba(0,0,0,0.35)" />
                    <Typography.Text style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.5)" }}>Variant Matrix Generator</Typography.Text>
                  </Flex>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", margin: "8px 0" }}>
                    Generate all size × color combinations at once. Comma-separated values or click presets.
                  </Typography.Text>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Sizes</label>
                      <input value={matrixSizes} onChange={(e) => setMatrixSizes(e.target.value)}
                        placeholder="S, M, L, XL, XXL"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, outline: "none", marginTop: 4 }} />
                      <Flex wrap="wrap" gap={4} style={{ marginTop: 6 }}>
                        {SIZE_PRESETS.map((s) => (
                          <button key={s} onClick={() => setMatrixSizes((prev) => (prev ? `${prev}, ${s}` : s))}
                            style={{ padding: "2px 8px", fontSize: 10, borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", background: "none", color: "rgba(0,0,0,0.45)" }}>
                            {s}
                          </button>
                        ))}
                      </Flex>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Colors</label>
                      <input value={matrixColors} onChange={(e) => setMatrixColors(e.target.value)}
                        placeholder="Black, White, Red, Blue"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, outline: "none", marginTop: 4 }} />
                      <Flex wrap="wrap" gap={4} style={{ marginTop: 6 }}>
                        {COLOR_PRESETS.slice(0, 12).map((c) => (
                          <button key={c.name} onClick={() => setMatrixColors((prev) => (prev ? `${prev}, ${c.name}` : c.name))}
                            title={c.name}
                            style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", background: c.hex }} />
                        ))}
                      </Flex>
                    </div>
                  </div>
                  <Flex gap={8} style={{ marginTop: 12 }}>
                    <Button size="small" type="primary" onClick={generateMatrix} icon={<Grid3X3 size={14} />}>Generate</Button>
                    <Button size="small" onClick={() => setMatrixOpen(false)}>Cancel</Button>
                  </Flex>
                </div>
              )}

              {/* Search */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "8px 24px", background: "rgba(0,0,0,0.015)" }}>
                <Flex align="center" gap={8}>
                  <Search size={14} color="rgba(0,0,0,0.3)" />
                  <input value={variantSearch} onChange={(e) => setVariantSearch(e.target.value)}
                    placeholder="Search by SKU, size, color, barcode..."
                    style={{ flex: 1, border: "none", background: "none", fontSize: 12, outline: "none" }} />
                  {variantSearch && (
                    <button onClick={() => setVariantSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)" }}>
                      <X size={12} />
                    </button>
                  )}
                </Flex>
              </div>

              {/* Sort */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "8px 24px" }}>
                <Flex align="center" gap={4} wrap="wrap">
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500, marginRight: 4 }}>Sort:</span>
                  {(["size", "color", "price", "stock", "sku"] as const).map((key) => (
                    <button key={key} onClick={() => sortVariantsBy(key)}
                      style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer", color: "rgba(0,0,0,0.45)", background: "none" }}>
                      {key}
                    </button>
                  ))}
                  <span style={{ color: "rgba(0,0,0,0.15)", margin: "0 4px" }}>|</span>
                  <button onClick={clearAllVariants}
                    style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer", color: "rgba(190,18,60,0.5)", background: "none" }}>
                    Clear
                  </button>
                </Flex>
              </div>

              {/* Variant Cards */}
              <div ref={variantContainerRef} style={{ maxHeight: 600, overflowY: "auto", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                {(variantSearch ? filteredVariants : form.variants).map((variant, displayIdx) => {
                  const actualIdx = form.variants.indexOf(variant);
                  const isExpanded = expandedVariants.has(displayIdx);
                  const status = getStockStatus(variant.stock, variant.lowStockThreshold);
                  return (
                    <div key={displayIdx}
                      style={{
                        opacity: variant.enabled ? 1 : 0.5,
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                        transition: "all 0.15s",
                      }}
                      draggable
                      onDragStart={() => handleDragStart(displayIdx)}
                      onDragOver={(e) => handleDragOver(e, displayIdx)}
                      onDragEnd={handleDragEnd}
                    >
                      <div style={{ padding: "16px 24px" }}>
                        <Flex gap={8} align="start">
                          <div style={{ cursor: "grab", color: "rgba(0,0,0,0.2)", marginTop: 6 }}>
                            <GripVertical size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Flex justify="space-between" align="center" gap={8} wrap="wrap">
                              <Flex align="center" gap={8} wrap="wrap">
                                <Typography.Text code style={{ fontSize: 12, fontWeight: 600 }}>
                                  {variant.sku || <span style={{ fontStyle: "italic", color: "rgba(0,0,0,0.35)" }}>No SKU</span>}
                                </Typography.Text>
                                {variant.barcode && (
                                  <Typography.Text type="secondary" style={{ fontSize: 10, fontFamily: "monospace" }}>
                                    EAN: {variant.barcode}
                                  </Typography.Text>
                                )}
                                <Tag color={status.color} style={{ fontSize: 10, margin: 0 }}>{status.label}</Tag>
                              </Flex>
                              <Flex gap={4}>
                                <button onClick={() => toggleVariantExpand(displayIdx)}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)" }}>
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <button onClick={() => duplicateVariant(actualIdx)}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)" }}
                                  title="Duplicate">
                                  <Copy size={14} />
                                </button>
                                <button onClick={() => toggleVariantEnabled(actualIdx)}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)" }}
                                  title={variant.enabled ? "Disable" : "Enable"}>
                                  {variant.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button onClick={() => removeVariant(actualIdx)}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(190,18,60,0.4)" }}
                                  title="Remove">
                                  <Trash2 size={14} />
                                </button>
                              </Flex>
                            </Flex>

                            {/* Size/Color Tags */}
                            <Flex wrap="wrap" gap={4} style={{ marginTop: 6 }}>
                              {variant.size && (
                                <Tag style={{ margin: 0 }}>{variant.size}</Tag>
                              )}
                              {variant.color && (
                                <Tag style={{ margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: getColorHex(variant.color) }} />
                                  {variant.color}
                                </Tag>
                              )}
                              {variant.price !== null && (
                                <Typography.Text strong style={{ fontSize: 13 }}>
                                  {form.currency} {variant.price}
                                </Typography.Text>
                              )}
                            </Flex>

                            {/* Expanded Form */}
                            {isExpanded && (
                              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>SKU</label>
                                    <div style={{ position: "relative" }}>
                                      <input type="text" value={variant.sku} onChange={(e) => updateVariant(actualIdx, "sku", e.target.value)}
                                        style={{ width: "100%", padding: "6px 30px 6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }} />
                                      <button onClick={() => generateSingleSku(actualIdx)}
                                        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)" }}>
                                        <WandSparkles size={12} />
                                      </button>
                                    </div>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Barcode / EAN</label>
                                    <div style={{ position: "relative" }}>
                                      <input type="text" value={variant.barcode} onChange={(e) => updateVariant(actualIdx, "barcode", e.target.value)}
                                        style={{ width: "100%", padding: "6px 30px 6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }} />
                                      <button onClick={() => generateSingleBarcode(actualIdx)}
                                        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "rgba(0,0,0,0.3)" }}>
                                        <WandSparkles size={12} />
                                      </button>
                                    </div>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Weight (kg)</label>
                                    <input type="number" step="0.01" value={variant.weight ?? ""} onChange={(e) => updateVariant(actualIdx, "weight", e.target.value ? Number(e.target.value) : null)}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }} />
                                  </Flex>
                                </div>
                                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr", marginTop: 12 }}>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Size</label>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      <input type="text" value={variant.size} onChange={(e) => updateVariant(actualIdx, "size", e.target.value)}
                                        style={{ flex: 1, minWidth: 60, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }} />
                                      {SIZE_PRESETS.slice(0, 5).map((s) => (
                                        <button key={s} onClick={() => updateVariant(actualIdx, "size", s)}
                                          style={{ padding: "4px 8px", fontSize: 10, borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", background: variant.size === s ? "#0f766e" : "none", color: variant.size === s ? "#fff" : "rgba(0,0,0,0.45)" }}>
                                          {s}
                                        </button>
                                      ))}
                                    </div>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Color</label>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                      <input type="text" value={variant.color} onChange={(e) => updateVariant(actualIdx, "color", e.target.value)}
                                        style={{ flex: 1, minWidth: 60, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }} />
                                      {COLOR_PRESETS.slice(0, 8).map((c) => (
                                        <button key={c.name} onClick={() => updateVariant(actualIdx, "color", c.name)}
                                          title={c.name}
                                          style={{ width: 18, height: 18, borderRadius: "50%", border: variant.color === c.name ? "2px solid #0f766e" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", background: c.hex }} />
                                      ))}
                                    </div>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Variant Image</label>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <input type="text" value={variant.image} onChange={(e) => updateVariant(actualIdx, "image", e.target.value)}
                                        placeholder="Image URL"
                                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }} />
                                      <label style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                                        <Upload size={12} />
                                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVariantImageUpload(actualIdx, f); e.target.value = ""; }} />
                                      </label>
                                    </div>
                                    {variant.image && (
                                      <Image src={variant.image} alt="Variant" width={48} height={48} unoptimized style={{ borderRadius: 6, objectFit: "cover", border: "1px solid rgba(0,0,0,0.1)", marginTop: 4 }} />
                                    )}
                                  </Flex>
                                </div>
                                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr 1fr", marginTop: 12 }}>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Stock</label>
                                    <input type="number" value={variant.stock ?? ""} onChange={(e) => updateVariant(actualIdx, "stock", e.target.value ? Number(e.target.value) : null)}
                                      style={{
                                        width: "100%", padding: "6px 10px", borderRadius: 8,
                                        border: `1px solid ${variant.stock !== null && variant.stock <= 0 ? "#be123c" : "rgba(0,0,0,0.1)"}`,
                                        fontSize: 12, outline: "none",
                                      }} />
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Low Stock Threshold</label>
                                    <input type="number" value={variant.lowStockThreshold} onChange={(e) => updateVariant(actualIdx, "lowStockThreshold", Number(e.target.value))}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }} />
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Price</label>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.01"
                                      min="0"
                                      value={variant.price ?? ""}
                                      onChange={(e) => updateVariant(actualIdx, "price", parseDecimal(e.target.value))}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }}
                                    />
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>Compare At</label>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.01"
                                      min="0"
                                      value={variant.compareAt ?? ""}
                                      onChange={(e) => updateVariant(actualIdx, "compareAt", parseDecimal(e.target.value))}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, outline: "none" }}
                                    />
                                  </Flex>
                                </div>
                              </div>
                            )}
                          </div>
                        </Flex>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {form.variants.length} variants · {enabledCount} enabled · {totalStock} total stock
                  {outOfStockCount > 0 && <span style={{ color: "#be123c" }}> · {outOfStockCount} out of stock</span>}
                </Typography.Text>
                <Flex gap={6}>
                  <Button size="small" onClick={generateAllSkus}>Generate all SKUs</Button>
                </Flex>
              </div>
            </Card>
          </Flex>
        )}
      </div>
    </Flex>
  );
}
