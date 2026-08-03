"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCreate, useList, useOne, useUpdate } from "@refinedev/core";
import { Button, Card, Flex, Grid, Typography, message, Spin, Tag, Switch, Dropdown, Modal, Space, Select } from "antd";
import type { MenuProps } from "antd";
import Image from "next/image";
import { uploadImage } from "@/lib/upload";
import { uploadVideo } from "@/lib/uploadVideo";
import {
  Plus, Trash2, Upload, X, Check, WandSparkles, GripVertical,
  Copy, ChevronDown, ChevronUp, Package,
  Eye, EyeOff, Search, Grid3X3, ArrowLeft,
  FileText, Calendar,
} from "lucide-react";
import type { BaseKey } from "@refinedev/core";
import { CategoryTreeSelect, type CategoryNode } from "@/components/forms/CategoryTreeSelect";
import { useAutoSave } from "@/lib/admin/useAutoSave";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { startProductAutofill, waitForProductAutofill, type ProductAiSuggestion } from "@/lib/productAi";

interface VariantForm {
  id?: string; sku: string; size: string; color: string; stock: number | null; price: number | null;
  compareAt: number | null; image: string; weight: number | null; barcode: string;
  lowStockThreshold: number; enabled: boolean; sortOrder: number;
  _imageKey?: string;
}

interface GalleryImage {
  _id: string;
  url: string;
  variantIds: string[];
  alt: string;
  _storageKey?: string;
}

interface ProductVideoForm {
  _id: string;
  url: string;
  thumbnail: string;
  title: string;
  alt_text: string;
  is_cover: boolean;
  is_featured: boolean;
  _storageKey?: string;
}

interface CustomizationOptionForm {
  _id: string;
  name: string;
  option_type: "text" | "textarea" | "color_picker" | "image_upload" | "select" | "checkbox" | "file";
  is_required: boolean;
  price_modifier: number | null;
  choices: string[];
  ordering: number;
  is_active: boolean;
}

let galleryIdCounter = 0;
const galleryId = () => `gallery_${Date.now()}_${++galleryIdCounter}`;
const videoId = () => `video_${Date.now()}_${++galleryIdCounter}`;
const customizationId = () => `cust_${Date.now()}_${++galleryIdCounter}`;

interface ProductForm {
  name: string; slug: string; sku: string; barcode: string;
  short_description: string; description: string;
  primaryImage: string; primaryImageAlt: string; gallery: GalleryImage[];
  price: number | null; sale_price: number | null; compare_at_price: number | null; cost: number | null; currency: string;
  stock_quantity: number; low_stock_threshold: number; allow_backorder: boolean; tax_included: boolean;
  weight: number | null; length: number | null; width: number | null; height: number | null; free_shipping: boolean;
  variants: VariantForm[]; categoryIds: string[]; primaryCategoryId: string;
  is_active: boolean; is_featured: boolean; is_bestseller: boolean; is_new_arrival: boolean; can_be_customized: boolean; has_cover_video: boolean;
  tags: string[];
  videos: ProductVideoForm[];
  customization_options: CustomizationOptionForm[];
  aspect_ratio: string;
  publish_from: string; publish_until: string;
  meta_title: string; meta_description: string; meta_keywords: string;
}

const COLOR_PRESETS = [
  { name: "Black", hex: "#000000" }, { name: "White", hex: "#FFFFFF" },
  { name: "Navy", hex: "#1B2838" }, { name: "Charcoal", hex: "#36454F" },
  { name: "Gray", hex: "#808080" }, { name: "Blue", hex: "#1565C0" },
  { name: "Green", hex: "#2E7D32" }, { name: "Red", hex: "#CC0000" },
  { name: "Pink", hex: "#E91E63" }, { name: "Purple", hex: "#6A1B9A" },
  { name: "Teal", hex: "#008080" }, { name: "Olive", hex: "#808000" },
  { name: "Coral", hex: "#FF7F50" }, { name: "Mint", hex: "#98FF98" },
  { name: "Lavender", hex: "#E6E6FA" }, { name: "Cream", hex: "#FFFDD0" },
  { name: "Beige", hex: "#F5F5DC" }, { name: "Khaki", hex: "#C3B091" },
  { name: "Brown", hex: "#6D4C41" }, { name: "Maroon", hex: "#800000" },
  { name: "Burgundy", hex: "#900020" }, { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Orange", hex: "#FF6F00" }, { name: "Yellow", hex: "#F9A825" },
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
  sku: "", size: "", color: "", stock: 1, price: null,
  compareAt: null, image: "", weight: null, barcode: "",
  lowStockThreshold: 5, enabled: true, sortOrder,
});

const emptyForm: ProductForm = {
  name: "", slug: "", sku: "", barcode: "",
  short_description: "", description: "",
  primaryImage: "", primaryImageAlt: "", gallery: [], price: null, sale_price: null, compare_at_price: null, cost: null, currency: "BDT",
  stock_quantity: 1, low_stock_threshold: 5, allow_backorder: true, tax_included: true, weight: null, length: null, width: null, height: null, free_shipping: false,
  variants: [emptyVariant(0)], categoryIds: [], primaryCategoryId: "",
  is_active: true, is_featured: false, is_bestseller: false, is_new_arrival: false, can_be_customized: true, has_cover_video: false,
  tags: [],
  videos: [],
  customization_options: [],
  aspect_ratio: "",
  publish_from: "", publish_until: "",
  meta_title: "", meta_description: "", meta_keywords: "",
};

export function AdminProductEditorPage({ id }: { id?: BaseKey }) {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveAction, setSaveAction] = useState<'publish' | 'draft' | 'schedule'>(() => {
    if (typeof window === 'undefined') return 'publish';
    const saved = localStorage.getItem('admin_save_action') as 'publish' | 'draft' | 'schedule' | null;
    return (saved === 'publish' || saved === 'draft' || saved === 'schedule') ? saved : 'publish';
  });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePickDate, setSchedulePickDate] = useState('');
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set([0]));
  const [variantSearch, setVariantSearch] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [galleryDragIndex, setGalleryDragIndex] = useState<number | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixSizes, setMatrixSizes] = useState("");
  const [matrixColors, setMatrixColors] = useState("");
  const [hasVariants, setHasVariants] = useState(false);
  const [seoCollapsed, setSeoCollapsed] = useState(true);
  const [shippingCollapsed, setShippingCollapsed] = useState(true);
  const [scheduleCollapsed, setScheduleCollapsed] = useState(true);
  const [imageUploadKey, setImageUploadKey] = useState(0);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
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

  const { bootstrap } = useAdminBootstrap();
  const aspectChoices = useMemo(() => bootstrap?.aspect_ratio_choices ?? [], [bootstrap]);
  const categoryAspectRatio = useMemo(() => {
    if (!form.primaryCategoryId) return "";
    const cat = categories.find((c) => c.id === form.primaryCategoryId);
    return cat?.aspect_ratio ?? "";
  }, [form.primaryCategoryId, categories]);

  const [currentId, setCurrentId] = useState<BaseKey | undefined>(id);

  /**
   * Reconcile the form with the server's canonical state after a successful
   * save: promoted staging files get replaced by their permanent URLs and the
   * staging keys are cleared so retries/autosaves never resend stale _temp
   * references (which previously caused 400s). Pure — returns a new form or
   * the same reference when nothing changed.
   */
  const syncFormWithServer = useCallback((data: Record<string, unknown>, current: ProductForm): ProductForm => {
    const serverImages = data.images as { image_url?: string; alt_text?: string }[] | undefined;
    const serverVariants = data.variants as Record<string, unknown>[] | undefined;
    const serverVideos = data.videos as { video_url?: string; thumbnail?: string }[] | undefined;
    const serverPrimaryImage = data.primary_image as string | undefined;

    let changed = false;

    const gallery = current.gallery.map((g, i) => {
      if (!g._storageKey || !g.url.includes('/_temp/')) return g;
      const server = serverImages?.[i];
      if (!server?.image_url || server.image_url.includes('/_temp/')) return g;
      changed = true;
      return { ...g, url: server.image_url, alt: server.alt_text ?? g.alt, _storageKey: undefined };
    });

    const variants = current.variants.map((v) => {
      if (!v._imageKey || !v.image.includes('/_temp/')) return v;
      const server = (serverVariants ?? []).find((sv) => String((sv.sku as string | undefined) ?? '') === v.sku.trim());
      const serverUrl = (server?.image_url as string | undefined) || (server?.image as string | undefined);
      if (!serverUrl || serverUrl.includes('/_temp/')) return v;
      changed = true;
      return { ...v, image: serverUrl, _imageKey: undefined };
    });

    const videos = current.videos.map((v, i) => {
      if (!v._storageKey || !v.url.includes('/_temp/')) return v;
      const server = serverVideos?.[i];
      if (!server?.video_url || server.video_url.includes('/_temp/')) return v;
      changed = true;
      return { ...v, url: server.video_url, thumbnail: server.thumbnail ?? v.thumbnail, _storageKey: undefined };
    });

    const primaryImage = current.primaryImage.includes('/_temp/') && serverPrimaryImage
      ? serverPrimaryImage
      : current.primaryImage;

    if (!changed && primaryImage === current.primaryImage) return current;

    return { ...current, gallery, variants, videos, primaryImage };
  }, []);

  const getProductPayload = useCallback((data: ProductForm): Record<string, unknown> => {
    const cleanVariants = data.variants.map((v) => ({
      id: v.id || undefined,
      sku: v.sku.trim(),
      stock_quantity: Number(v.stock ?? 0),
      price: v.price === null || v.price === undefined ? null : Number(v.price),
      image_url: v.image || null,
      low_stock_threshold: v.lowStockThreshold ?? 5,
      is_active: v.enabled,
      weight: v.weight === null || v.weight === undefined ? null : Number(v.weight),
      barcode: v.barcode || '',
      compare_at_price: v.compareAt === null || v.compareAt === undefined ? null : Number(v.compareAt),
      size: v.size || '',
      color: v.color || '',
      ...(v._imageKey && (v.image || '').includes('/_temp/') ? { _image_key: v._imageKey } : {}),
    }));

    return {
      name: data.name,
      slug: data.slug,
      sku: hasVariants ? null : data.sku || null,
      barcode: hasVariants ? null : data.barcode || '',
      short_description: data.short_description,
      description: data.description,
      primary_image: data.primaryImage || null,
      primary_image_alt: data.primaryImageAlt || null,
      images_data: data.gallery.map((g) => ({ image_url: g.url, alt_text: g.alt, variant_ids: g.variantIds, ...(g._storageKey && g.url.includes('/_temp/') ? { _storage_key: g._storageKey } : {}) })),
      price: Number(data.price ?? 0),
      sale_price: data.sale_price === null || data.sale_price === undefined ? null : Number(data.sale_price),
      compare_at_price: data.compare_at_price === null || data.compare_at_price === undefined ? null : Number(data.compare_at_price),
      cost: data.cost === null || data.cost === undefined ? null : Number(data.cost),
      currency: data.currency,
      stock_quantity: hasVariants ? 0 : Number(data.variants[0]?.stock ?? 0),
      low_stock_threshold: hasVariants ? data.low_stock_threshold : Number(data.variants[0]?.lowStockThreshold ?? 5),
      allow_backorder: data.allow_backorder,
      tax_included: data.tax_included,
      weight: data.weight === null || data.weight === undefined ? null : Number(data.weight),
      length: data.length === null || data.length === undefined ? null : Number(data.length),
      width: data.width === null || data.width === undefined ? null : Number(data.width),
      height: data.height === null || data.height === undefined ? null : Number(data.height),
      free_shipping: data.free_shipping,
      ...(hasVariants ? { variants_data: cleanVariants } : {}),
      category_ids: data.categoryIds,
      primary_category: data.primaryCategoryId || null,
      is_active: data.is_active,
      is_featured: data.is_featured,
      is_bestseller: data.is_bestseller,
      is_new_arrival: data.is_new_arrival,
      can_be_customized: data.can_be_customized,
      tags: data.tags,
      videos_data: data.videos.map((v) => ({
        video_url: v.url,
        thumbnail: v.thumbnail || undefined,
        title: v.title,
        alt_text: v.alt_text,
        is_cover: v.is_cover,
        is_featured: v.is_featured,
        ...(v._storageKey && v.url.includes('/_temp/') ? { _storage_key: v._storageKey } : {}),
      })),
      has_cover_video: data.has_cover_video,
      customization_options_data: data.customization_options.map((o) => ({
        id: o._id.startsWith("cust_") ? undefined : o._id,
        name: o.name,
        option_type: o.option_type,
        is_required: o.is_required,
        price_modifier: o.price_modifier,
        choices: o.choices,
        ordering: o.ordering,
        is_active: o.is_active,
      })),
      aspect_ratio: data.aspect_ratio || "",
      publish_from: data.publish_from || null,
      publish_until: data.publish_until || null,
      meta_title: (data.meta_title || data.name || "").trim(),
      meta_description: (data.meta_description || data.short_description || "").trim(),
      meta_keywords: (data.meta_keywords || "").trim(),
    };
  }, [hasVariants]);

  const autoSave = useAutoSave({
    resource: "catalog/products",
    formData: form,
    id: currentId,
    enabled: !saving && !loadingProduct,
    intervalMs: 10000,
    getPayload: getProductPayload,
    onCreated: (newId, data) => {
      setCurrentId(newId);
      if (data) setForm((prev) => syncFormWithServer(data, prev));
    },
    onSaved: (data) => {
      setForm((prev) => syncFormWithServer(data, prev));
    },
  });

  const { mutate: createProduct } = useCreate();
  const { mutate: updateProduct } = useUpdate();
  const product = existing;

  const formInitialized = useRef(false);

  const initForm = useCallback(() => {
    if (formInitialized.current) return;
    if (id && product) {
      formInitialized.current = true;
      slugManuallyEdited.current = false;
      const rawGallery = product.images ?? [];
      const variants: VariantForm[] = (product.variants ?? []).map((v: Record<string, unknown>, i: number) => ({
        id: (v.id as string) ?? undefined, sku: (v.sku as string) ?? "", size: (v.size as string) ?? "", color: (v.color as string) ?? "",
        stock: (v.stock_quantity ?? v.stock ?? null) as number | null, price: (v.price as number) ?? null,
        compareAt: (v.compare_at_price ?? v.compareAt ?? null) as number | null, image: (v.image as string) ?? "",
        weight: (v.weight as number) ?? null, barcode: (v.barcode as string) ?? "",
        lowStockThreshold: (v.low_stock_threshold ?? v.lowStockThreshold ?? 5) as number,
        enabled: (v.is_active ?? v.enabled ?? true) as boolean, sortOrder: (v.sort_order ?? v.sortOrder ?? i) as number,
      }));
      const primaryCategoryId = String(
        product.primary_category?.id
          ?? product.primary_category_id
          ?? product.primary_category
          ?? "",
      );
      const categoryAspectDefault = categories.find((c) => c.id === primaryCategoryId)?.aspect_ratio ?? "";
      const variantUuidToIndex: Record<string, string> = {};
      variants.forEach((_, i) => {
        const v = (product.variants ?? [])[i];
        if (v?.id) variantUuidToIndex[String(v.id)] = String(i);
      });
      const mappedGallery: GalleryImage[] = rawGallery.map((item: string | { image?: string; url?: string; variant_ids?: string[]; alt?: string }) => {
        if (typeof item === "string") return { _id: galleryId(), url: item, variantIds: [], alt: "" };
        const ids = (item.variant_ids ?? []).map((uuid: string) => variantUuidToIndex[uuid]).filter(Boolean);
        return { _id: galleryId(), url: (item as Record<string, string>).image_url || item.url || "", variantIds: ids, alt: (item as Record<string, string>).alt_text ?? item.alt ?? "" };
      });
      const hasOptions = variants.some((v) => v.size || v.color);
      setHasVariants(hasOptions);
      setForm({
        name: product.name ?? "",
        slug: product.slug ?? "",
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        short_description: product.short_description ?? "",
        description: product.description ?? "",
        primaryImage: product.primary_image ?? "",
        primaryImageAlt: product.primary_image_alt ?? "",
        gallery: mappedGallery,
        price: product.price ? Number(product.price) : null,
        sale_price: product.sale_price ? Number(product.sale_price) : null,
        compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : null,
        cost: product.cost ? Number(product.cost) : null,
        currency: product.currency ?? "BDT",
        stock_quantity: product.stock_quantity ?? 0,
        low_stock_threshold: product.low_stock_threshold ?? 5,
        allow_backorder: product.allow_backorder ?? false,
        tax_included: product.tax_included ?? false,
        weight: product.weight ? Number(product.weight) : null,
        length: product.length ? Number(product.length) : null,
        width: product.width ? Number(product.width) : null,
        height: product.height ? Number(product.height) : null,
        free_shipping: product.free_shipping ?? false,
        variants: variants.length
          ? variants
          : [{
              ...emptyVariant(0),
              price: product.price ? Number(product.price) : null,
              stock: product.stock_quantity ?? null,
              lowStockThreshold: product.low_stock_threshold ?? 5,
            }],
        categoryIds: (product.categories ?? []).map((c: { id?: string; category?: { id?: string } }) => c.id ?? c.category?.id).filter(Boolean) as string[],
        primaryCategoryId,
        is_active: product.is_active ?? true,
        is_featured: product.is_featured ?? false,
        is_bestseller: product.is_bestseller ?? false,
        is_new_arrival: product.is_new_arrival ?? false,
        can_be_customized: product.can_be_customized ?? false,
        has_cover_video: (product.videos ?? []).some((v: Record<string, unknown>) => v.is_cover),
        customization_options: (product.customization_options ?? []).map((o: Record<string, unknown>, oi: number) => ({
          _id: (o.id as string) || customizationId(),
          name: (o.name as string) || "",
          option_type: ((o.option_type === "color" ? "color_picker" : o.option_type === "image" ? "image_upload" : o.option_type) as CustomizationOptionForm["option_type"]) || "text",
          is_required: (o.is_required as boolean) || false,
          price_modifier: (o.price_modifier as number) ?? null,
          choices: (o.choices as string[]) || [],
          ordering: (o.ordering as number) ?? oi,
          is_active: (o.is_active as boolean) ?? true,
        })),
        videos: (product.videos ?? []).map((v: Record<string, unknown>) => ({
          _id: (v.id as string) || videoId(),
          url: (v.video_url as string) || "",
          thumbnail: (v.thumbnail as string) || "",
          title: (v.title as string) || "",
          alt_text: (v.alt_text as string) || "",
          is_cover: (v.is_cover as boolean) || false,
          is_featured: (v.is_featured as boolean) || false,
        })),
        aspect_ratio: product.aspect_ratio || categoryAspectDefault || "",
        tags: (product.tags ?? []).map((t: string | { id?: string; name?: string }) => typeof t === "string" ? t : (t.name ?? "")),
        publish_from: product.publish_from ?? "",
        publish_until: product.publish_until ?? "",
        meta_title: product.meta_title ?? "",
        meta_description: product.meta_description ?? "",
        meta_keywords: product.meta_keywords ?? "",
      });
    } else if (!id) {
      formInitialized.current = true;
    }
  }, [id, product, categories]);

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

  // Persist save action preference
  useEffect(() => {
    localStorage.setItem('admin_save_action', saveAction);
  }, [saveAction]);

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
       setForm((p) => ({
         ...p,
         variants: p.variants.map((v) => ({
           ...v,
           sku: v.sku || p.sku,
           barcode: v.barcode || p.barcode,
           price: v.price ?? p.price,
           compareAt: v.compareAt ?? p.sale_price ?? null,
         })),
       }));
     } else {
       setForm((p) => ({
         ...p,
         sku: p.variants[0]?.sku || p.sku,
         barcode: p.variants[0]?.barcode || p.barcode,
       }));
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

  const saveMenuItems: MenuProps['items'] = [
    { key: 'publish', label: 'Publish now', icon: <Check size={14} /> },
    { key: 'draft', label: 'Save as Draft', icon: <FileText size={14} /> },
    { type: 'divider' },
    { key: 'schedule', label: 'Schedule for later...', icon: <Calendar size={14} /> },
  ];

  const handleSaveMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'schedule') {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      setSchedulePickDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`);
      setScheduleOpen(true);
    } else {
      setSaveAction(key as 'publish' | 'draft');
    }
  };

  const handleScheduleConfirm = () => {
    if (!schedulePickDate) return;
    updateField('publish_from', schedulePickDate + ':00Z');
    setSaveAction('schedule');
    setScheduleOpen(false);
  };

  const saveLabel = useMemo(() => {
    if (saveAction === 'draft') return 'Save as Draft';
    if (saveAction === 'schedule') {
      const d = form.publish_from;
      if (d) {
        try {
          return `Schedule (${new Date(d).toLocaleDateString()})`;
        } catch { /* ignore */ }
      }
      return 'Schedule';
    }
    return 'Publish';
  }, [saveAction, form.publish_from]);

  const handlePrimaryCategoryChange = (ids: string[]) => {
    clearFieldError("primaryCategoryId");
    clearFieldError("categoryIds");
    const primaryId = ids[0] ?? "";
    setForm((p) => {
      const nextCategories = new Set(p.categoryIds);
      let newAspect = p.aspect_ratio;
      if (primaryId) {
        nextCategories.add(primaryId);
        const catMap = new Map(categories.map((c) => [c.id, c]));
        let current = catMap.get(primaryId);
        while (current?.parent_id) {
          nextCategories.add(current.parent_id);
          current = catMap.get(current.parent_id);
        }
        if (!p.aspect_ratio) {
          const cat = catMap.get(primaryId);
          if (cat?.aspect_ratio) newAspect = cat.aspect_ratio;
        }
      }
      return {
        ...p,
        primaryCategoryId: primaryId,
        categoryIds: Array.from(nextCategories),
        aspect_ratio: newAspect,
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

  const generateAllBarcodes = () => {
    setForm((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ ...v, barcode: generateBarcode() })),
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

  const handleFileUpload = async (target: "primaryImage" | "gallery", file: File) => {
    try {
      const { url, key } = await uploadImage(file);
      if (target === "primaryImage") {
        clearFieldError("primaryImage");
        updateField("primaryImage", url);
        setForm((prev) => {
          if (prev.gallery.some((g) => g.url === url)) return prev;
          return { ...prev, gallery: [{ _id: galleryId(), url, _storageKey: key, variantIds: [], alt: prev.primaryImageAlt }, ...prev.gallery] };
        });
      } else {
        setForm((prev) => ({ ...prev, gallery: [...prev.gallery, { _id: galleryId(), url, _storageKey: key, variantIds: [], alt: "" }] }));
      }
    } catch {
      message.error("Failed to upload image");
    }
  };

  const handleMultipleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploads = Array.from(files).map((f) => uploadImage(f));
    const results = await Promise.allSettled(uploads);
    const items: GalleryImage[] = [];
    let failed = 0;
    for (const r of results) {
      if (r.status === "fulfilled") items.push({ _id: galleryId(), url: r.value.url, _storageKey: r.value.key, variantIds: [], alt: "" });
      else failed++;
    }
    if (items.length > 0) {
      setForm((prev) => ({ ...prev, gallery: [...prev.gallery, ...items] }));
    }
    if (failed > 0) message.warning(`${failed} file(s) failed to upload.`);
    if (items.length > 0) message.success(`${items.length} file(s) uploaded successfully.`);
  };

  const handleAddGalleryUrl = () => {
    const url = prompt("Enter image URL:");
    if (url) updateField("gallery", [...form.gallery, { _id: galleryId(), url, variantIds: [], alt: "" }]);
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

  const handleVariantImageUpload = async (index: number, file: File) => {
    try {
      const { url, key } = await uploadImage(file);
      updateVariant(index, "image", url);
      updateVariant(index, "_imageKey", key);
    } catch {
      message.error("Failed to upload variant image");
    }
  };

  const applyAiSuggestions = useCallback((suggestions: ProductAiSuggestion[]) => {
    const usable = suggestions.filter((item) => !item.is_null && item.value !== null && item.value !== undefined);
    setForm((current) => {
      const next = { ...current };
      for (const suggestion of usable) {
        const value = suggestion.value;
        switch (suggestion.field_name) {
          case "name": next.name = String(value); break;
          case "sku": next.sku = String(value); break;
          case "description": next.description = String(value); break;
          case "short_description": next.short_description = String(value); break;
          case "price": next.price = Number(value); break;
          case "sale_price": next.sale_price = Number(value); break;
          case "compare_at_price": next.compare_at_price = Number(value); break;
          case "cost": next.cost = Number(value); break;
          case "stock_quantity": next.stock_quantity = Number(value); break;
          case "low_stock_threshold": next.low_stock_threshold = Number(value); break;
          case "weight": next.weight = Number(value); break;
          case "length": next.length = Number(value); break;
          case "width": next.width = Number(value); break;
          case "height": next.height = Number(value); break;
          case "aspect_ratio": next.aspect_ratio = String(value); break;
          case "meta_title": next.meta_title = String(value); break;
          case "meta_description": next.meta_description = String(value); break;
          case "meta_keywords": next.meta_keywords = String(value); break;
          case "primary_category": next.primaryCategoryId = String(value); break;
          case "categories":
            if (Array.isArray(value)) next.categoryIds = value.map(String);
            break;
          case "tags": {
            const names = suggestion.metadata.names;
            next.tags = Array.isArray(names)
              ? names.map(String)
              : Array.isArray(value) ? value.map(String) : [String(value)];
            break;
          }
        }
      }
      if (!slugManuallyEdited.current && next.name) {
        next.slug = slugify(next.name);
      }
      return next;
    });
    return usable;
  }, []);

  const handleAiAutofill = async () => {
    const imageKeys = form.gallery.map((image) => image._storageKey).filter((key): key is string => Boolean(key));
    if (!id && imageKeys.length === 0) {
      message.warning("Upload at least one product image before running AI autofill.");
      return;
    }
    setAiRunning(true);
    try {
      const categoryNames = categories
        .filter((category) => form.categoryIds.includes(String(category.id)))
        .map((category) => category.name);
      const started = await startProductAutofill({
        product_id: id ? String(id) : undefined,
        image_keys: imageKeys,
        currency: form.currency,
        locale: "en",
        allow_external: true,
        context_hints: {
          name: form.name,
          sku: form.sku,
          description: form.description,
          short_description: form.short_description,
          categories: categoryNames,
          tags: form.tags,
          has_variants: hasVariants,
        },
      });
      const result = await waitForProductAutofill(started.job_id);
      if (result.status !== "completed") {
        throw new Error(result.error_message || "AI product analysis failed.");
      }
      const applied = applyAiSuggestions(result.suggestions ?? []);
      const lowConfidence = applied.filter((item) => item.low_confidence).length;
      message.success(
        `AI filled ${applied.length} field${applied.length === 1 ? "" : "s"}${lowConfidence ? ` (${lowConfidence} need review)` : ""}.`
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "AI product analysis failed.");
    } finally {
      setAiRunning(false);
    }
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.name) newErrors["name"] = "Product name is required";
    if (!form.slug) newErrors["slug"] = "Slug is required";
    if (form.price === null || form.price === undefined || form.price <= 0) newErrors["price"] = "Price must be greater than 0";
    if (!form.primaryCategoryId) newErrors["primaryCategoryId"] = "Primary category is required";
    if (!form.categoryIds || form.categoryIds.length === 0) newErrors["categoryIds"] = "At least one category is required";

    if (!hasVariants) {
      if (!form.sku) newErrors["sku"] = "SKU is required";
    } else {
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
    const savedData = await autoSave.flush();
    const workingForm = savedData ? syncFormWithServer(savedData, form) : form;
    if (workingForm !== form) setForm(workingForm);

    const cleanVariants = workingForm.variants.map((v) => ({
      id: v.id || undefined,
      sku: v.sku.trim(),
      stock_quantity: Number(v.stock ?? 0),
      price: v.price === null || v.price === undefined ? null : Number(v.price),
      image_url: v.image || null,
      low_stock_threshold: v.lowStockThreshold ?? 5,
      is_active: v.enabled,
      weight: v.weight === null || v.weight === undefined ? null : Number(v.weight),
      barcode: v.barcode || '',
      compare_at_price: v.compareAt === null || v.compareAt === undefined ? null : Number(v.compareAt),
      size: v.size || '',
      color: v.color || '',
      ...(v._imageKey && (v.image || '').includes('/_temp/') ? { _image_key: v._imageKey } : {}),
    }));

    const values: Record<string, unknown> = {
       name: workingForm.name,
       slug: workingForm.slug,
       sku: hasVariants ? null : workingForm.sku || null,
       barcode: hasVariants ? null : workingForm.barcode || '',
      short_description: workingForm.short_description,
      description: workingForm.description,
      images_data: workingForm.gallery.map((g) => ({ image_url: g.url, alt_text: g.alt, variant_ids: g.variantIds, ...(g._storageKey && g.url.includes('/_temp/') ? { _storage_key: g._storageKey } : {}) })),
      price: Number(workingForm.price ?? 0),
      sale_price: workingForm.sale_price === null || workingForm.sale_price === undefined ? null : Number(workingForm.sale_price),
      compare_at_price: workingForm.compare_at_price === null || workingForm.compare_at_price === undefined ? null : Number(workingForm.compare_at_price),
      cost: workingForm.cost === null || workingForm.cost === undefined ? null : Number(workingForm.cost),
      currency: workingForm.currency,
      stock_quantity: hasVariants ? workingForm.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0) : Number(workingForm.variants[0]?.stock ?? 0),
      low_stock_threshold: hasVariants ? workingForm.low_stock_threshold : Number(workingForm.variants[0]?.lowStockThreshold ?? 5),
      allow_backorder: workingForm.allow_backorder,
      tax_included: workingForm.tax_included,
      weight: workingForm.weight === null || workingForm.weight === undefined ? null : Number(workingForm.weight),
      length: workingForm.length === null || workingForm.length === undefined ? null : Number(workingForm.length),
      width: workingForm.width === null || workingForm.width === undefined ? null : Number(workingForm.width),
      height: workingForm.height === null || workingForm.height === undefined ? null : Number(workingForm.height),
      free_shipping: workingForm.free_shipping,
      ...(hasVariants ? { variants_data: cleanVariants } : {}),
      category_ids: workingForm.categoryIds,
      primary_category: workingForm.primaryCategoryId || null,
      is_featured: workingForm.is_featured,
      is_bestseller: workingForm.is_bestseller,
      is_new_arrival: workingForm.is_new_arrival,
      can_be_customized: workingForm.can_be_customized,
      has_cover_video: workingForm.has_cover_video,
      customization_options_data: workingForm.customization_options.map((o) => ({
        id: o._id.startsWith("cust_") ? undefined : o._id,
        name: o.name,
        option_type: o.option_type,
        is_required: o.is_required,
        price_modifier: o.price_modifier,
        choices: o.choices,
        ordering: o.ordering,
        is_active: o.is_active,
      })),
      videos_data: workingForm.videos.map((v) => ({
        id: v._id.startsWith("video_") ? undefined : v._id,
        video_url: v.url,
        thumbnail: v.thumbnail || undefined,
        title: v.title,
        alt_text: v.alt_text,
        is_cover: v.is_cover,
        is_featured: v.is_featured,
        ...(v._storageKey && v.url.includes('/_temp/') ? { _storage_key: v._storageKey } : {}),
      })),
      tags: workingForm.tags,
      aspect_ratio: workingForm.aspect_ratio || "",
      publish_until: workingForm.publish_until || null,
      meta_title: (workingForm.meta_title || workingForm.name || "").trim(),
      meta_description: (workingForm.meta_description || workingForm.short_description || "").trim(),
      meta_keywords: (workingForm.meta_keywords || "").trim(),
    };

    if (saveAction === 'publish') {
      values.is_active = true;
      values.publish_from = null;
    } else if (saveAction === 'draft') {
      values.is_active = false;
      values.publish_from = null;
    } else {
      values.is_active = true;
      values.publish_from = workingForm.publish_from || null;
    }

    const effectiveId = currentId || id;

    try {
      if (effectiveId) {
        updateProduct(
          { resource: "catalog/products", id: effectiveId, values },
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
        <Flex align="center" gap={8}>
          <Button
            icon={<WandSparkles size={15} />}
            onClick={handleAiAutofill}
            loading={aiRunning}
            disabled={saving}
          >
            {aiRunning ? "Analyzing product..." : "AI Autofill"}
          </Button>
          {autoSave.status !== "idle" && (
            <span className={`admin-auto-save admin-auto-save--${autoSave.status}`}>
              {autoSave.status === "saving" ? "Saving draft..."
                : autoSave.status === "saved" ? "Draft saved"
                : "Draft save failed"}
            </span>
          )}
          <Space.Compact>
            <Button type="primary" onClick={() => {
              if (saveAction === 'schedule' && !form.publish_from) {
                const next = new Date();
                next.setDate(next.getDate() + 1);
                next.setHours(0, 0, 0, 0);
                const pad = (n: number) => String(n).padStart(2, '0');
                setSchedulePickDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`);
                setScheduleOpen(true); return;
              }
              handleSave();
            }} loading={saving} style={{ paddingInline: 20 }}>
              {saveLabel}
            </Button>
            <Dropdown menu={{ items: saveMenuItems, onClick: handleSaveMenuClick }} trigger={['click']}>
              <Button type="primary" icon={<ChevronDown size={14} />} />
            </Dropdown>
          </Space.Compact>
        </Flex>
      </Flex>

      {/* Product Type Toggle */}
      <Card className="admin-soft-panel" variant="borderless" style={{ padding: "12px 0" }}>
        <Flex align="center" gap={16} wrap="wrap">
          <div style={{ display: "flex", borderRadius: 12, border: "1px solid var(--admin-input-border)", overflow: "hidden" }}>
            <button onClick={() => { if (hasVariants) toggleVariants(); }}
              className={`admin-type-pill${!hasVariants ? " active" : ""}`}>
              Simple Product
            </button>
            <button onClick={() => { if (!hasVariants) toggleVariants(); }}
              className={`admin-type-pill${hasVariants ? " active" : ""}`}>
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

      <div style={{ display: "grid", gap: isMobile ? 16 : 24, gridTemplateColumns: hasVariants && !isMobile ? "1fr 2fr" : "1fr" }}>
        {/* ── Left Column: Product Info ── */}
        <Flex vertical gap={isMobile ? 16 : 20} style={{ minWidth: 0 }}>
          <Card className="admin-soft-panel" variant="borderless" title="Basic Information">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Flex vertical gap={4}>
                <label className="admin-field-label">Name *</label>
                <input value={form.name} onChange={(e) => handleNameChange(e.target.value)}
                  className={`admin-input${fieldErrors["name"] ? " error" : ""}`} />
                {fieldErrors["name"] && <span style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{fieldErrors["name"]}</span>}
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label">Slug *</label>
                <input value={form.slug} onChange={(e) => { slugManuallyEdited.current = true; updateField("slug", e.target.value); }}
                  onFocus={() => slugManuallyEdited.current = true}
                  className={`admin-input${fieldErrors["slug"] ? " error" : ""}`} />
                {fieldErrors["slug"] && <span style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{fieldErrors["slug"]}</span>}
              </Flex>
            </div>
            {!hasVariants && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 12 }}>
                 <Flex vertical gap={4}>
                   <label className="admin-field-label">SKU *</label>
                   <div style={{ position: "relative" }}>
                      <input type="text" value={form.sku ?? ""}
                        onChange={(e) => updateField("sku", e.target.value)}
                        className={`admin-input${fieldErrors["sku"] ? " error" : ""}`}
                       style={{ paddingRight: 40 }} />
                     <button onClick={() => updateField("sku", generateSku("", ""))}
                       style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}>
                       <WandSparkles size={14} />
                     </button>
                   </div>
                   {fieldErrors["sku"] && <span style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{fieldErrors["sku"]}</span>}
                 </Flex>
                 <Flex vertical gap={4}>
                   <label className="admin-field-label">Barcode / EAN</label>
                   <div style={{ position: "relative" }}>
                     <input type="text" value={form.barcode ?? ""}
                       onChange={(e) => updateField("barcode", e.target.value)}
                       className="admin-input"
                       style={{ paddingRight: 40 }} />
                     <button onClick={() => updateField("barcode", generateBarcode())}
                       style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}>
                       <WandSparkles size={14} />
                     </button>
                   </div>
                 </Flex>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Flex vertical gap={4}>
                <label className="admin-field-label">Description</label>
                <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)}
                  rows={isMobile ? 4 : 5} className="admin-textarea" />
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label">Short Description</label>
                <textarea value={form.short_description} onChange={(e) => updateField("short_description", e.target.value)}
                  rows={isMobile ? 4 : 5} className="admin-textarea" />
              </Flex>
            </div>
          </Card>

          {/* Images — Primary + Gallery side by side */}
          <Flex gap={16} wrap="wrap">
            <Card className="admin-soft-panel" variant="borderless" title="Primary Image" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
                <label style={{
                  display: "flex", cursor: "pointer", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "8px 16px", borderRadius: 12, border: "1px solid var(--admin-input-border)", fontSize: 12, color: "var(--admin-muted)",
                }}>
                  <Upload size={14} /> Choose File
                  <input key={`primary-${imageUploadKey}`} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileUpload("primaryImage", f); setImageUploadKey((k) => k + 1); } }} />
                </label>
                <input value={form.primaryImage} onChange={(e) => {
                  clearFieldError("primaryImage");
                  const val = e.target.value;
                  updateField("primaryImage", val);
                  if (val && !form.gallery.some((g) => g.url === val)) {
                    updateField("gallery", [{ _id: galleryId(), url: val, variantIds: [], alt: form.primaryImageAlt }, ...form.gallery]);
                  }
                }}
                  placeholder="https://cdn.bunoraa.com/images/product.jpg"
                  className={`admin-input${fieldErrors["primaryImage"] ? " error" : ""}`} />
              </div>
              {fieldErrors["primaryImage"] && <span style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{fieldErrors["primaryImage"]}</span>}
              {form.primaryImage && (
                <div style={{ position: "relative", display: "inline-block", marginTop: 8 }}>
                  <Image src={form.primaryImage} alt="Primary" width={64} height={80} unoptimized style={{ borderRadius: 8, border: "1px solid var(--admin-input-border)", objectFit: "cover" }} />
                  <button onClick={() => updateField("primaryImage", "")}
                    style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--admin-danger)", color: "var(--admin-input-bg)", fontSize: 10, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ×
                  </button>
                </div>
              )}
              <Flex vertical gap={4} style={{ marginTop: 8 }}>
                <label className="admin-field-label">Alt Text</label>
                <input value={form.primaryImageAlt} onChange={(e) => updateField("primaryImageAlt", e.target.value)}
                  placeholder="Descriptive text for accessibility and SEO"
                  className="admin-input" />
              </Flex>
            </Card>
            <Card className="admin-soft-panel" variant="borderless" title="Gallery Images" style={{ flex: "1 1 300px", minWidth: 0 }}>
              {form.gallery.length > 0 && (
                <Flex vertical gap={8}>
                  {form.gallery.map((img, i) => (
                    <div key={img._id}
                      style={{
                        borderRadius: 12, border: "1px solid var(--admin-input-border)", padding: 12,
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
                        <div style={{ cursor: "grab", color: "var(--admin-muted-alpha-20)", marginTop: 4 }}>
                          <GripVertical size={16} />
                        </div>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <Image src={img.url} alt={`Gallery ${i}`} width={48} height={64} unoptimized style={{ borderRadius: 8, border: "1px solid var(--admin-input-border)", objectFit: "cover" }} />
                          <button onClick={() => handleRemoveGalleryImage(i)}
                            style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "var(--admin-danger)", color: "var(--admin-input-bg)", fontSize: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            ×
                          </button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Typography.Text style={{ fontSize: 11, fontFamily: "monospace", color: "var(--admin-muted)" }} ellipsis>{img.url}</Typography.Text>
                          {hasVariants && form.variants.length > 1 && (
                            <Flex wrap="wrap" gap={4} style={{ marginTop: 6 }}>
                              {form.variants.map((v, vi) => {
                                const checked = img.variantIds.includes(String(vi));
                                return (
                                  <label key={vi} style={{
                                    display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, border: "1px solid",
                                    fontSize: 10, cursor: "pointer", transition: "all 0.15s",
                                    background: checked ? "var(--admin-brand)" : "transparent",
                                    color: checked ? "var(--admin-text-on-brand)" : "var(--admin-muted)",
                                    borderColor: checked ? "var(--admin-brand)" : "var(--admin-input-border)",
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
                          <input value={img.alt} onChange={(e) => {
                            setForm((p) => {
                              const next = [...p.gallery];
                              next[i] = { ...next[i], alt: e.target.value };
                              return { ...p, gallery: next };
                            });
                          }}
                            placeholder="Alt text"
                            className="admin-input"
                            style={{ fontSize: 11, padding: "6px 10px", marginTop: 6 }} />
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
                  style={{ padding: "8px 16px", borderRadius: 12, border: "1px dashed var(--admin-border-strong)", fontSize: 11, color: "var(--admin-muted)", cursor: "pointer", background: "none" }}>
                  + Add URL
                </button>
                <label style={{ padding: "8px 16px", borderRadius: 12, border: "1px dashed var(--admin-border-strong)", fontSize: 11, color: "var(--admin-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <Upload size={14} /> Upload Files
                  <input key={`gallery-${imageUploadKey}`} type="file" accept="image/*" multiple style={{ display: "none" }}
                    onChange={(e) => { handleMultipleGalleryUpload(e.target.files); setImageUploadKey((k) => k + 1); }} />
                </label>
              </div>
            </Card>
          </Flex>

          {/* Videos */}
          <Card className="admin-soft-panel" variant="borderless" title="Videos" style={{ flex: "1 1 300px", minWidth: 0 }}>
            {form.videos.length > 0 && (
              <Flex vertical gap={8}>
                {form.videos.map((video, i) => (
                  <div key={video._id}
                    style={{ borderRadius: 12, border: "1px solid var(--admin-input-border)", padding: 12 }}
                  >
                    <Flex gap={12} align="start">
                      <div style={{ position: "relative", flexShrink: 0, width: 80, height: 60, borderRadius: 8, overflow: "hidden", background: "var(--admin-muted-alpha-10)", cursor: video.url ? "pointer" : "default" }}
                        onClick={() => video.url && setPreviewVideoUrl(video.url)}>
                        {video.thumbnail ? (
                          <Image src={video.thumbnail} alt={video.title} width={80} height={60} unoptimized style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 10, color: "var(--admin-muted)" }}>
                            {video.url ? "▶" : "No thumb"}
                          </div>
                        )}
                        {video.url && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", opacity: 0, transition: "opacity 0.15s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#000" }}>▶</div>
                          </div>
                        )}
                        {video.is_cover && (
                          <span style={{ position: "absolute", bottom: 2, left: 2, fontSize: 8, background: "var(--admin-brand)", color: "var(--admin-text-on-brand)", padding: "1px 4px", borderRadius: 4, fontWeight: 600 }}>
                            Cover
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input value={video.title} onChange={(e) => {
                          setForm((p) => {
                            const next = [...p.videos];
                            next[i] = { ...next[i], title: e.target.value };
                            return { ...p, videos: next };
                          });
                        }}
                          placeholder="Video title"
                          className="admin-input"
                          style={{ fontSize: 11, padding: "6px 10px", marginBottom: 6 }} />
                        <input value={video.url} onChange={(e) => {
                          setForm((p) => {
                            const next = [...p.videos];
                            next[i] = { ...next[i], url: e.target.value };
                            return { ...p, videos: next };
                          });
                        }}
                          placeholder="https://cdn.bunoraa.com/videos/product.mp4"
                          className="admin-input"
                          style={{ fontSize: 11, padding: "6px 10px", marginBottom: 6, fontFamily: "monospace" }} />
                        <Flex gap={4} align="center">
                          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={video.is_cover}
                              onChange={() => {
                                setForm((p) => ({
                                  ...p,
                                  videos: p.videos.map((v, vi) => ({ ...v, is_cover: vi === i ? !v.is_cover : false })),
                                  has_cover_video: i === 0 ? !video.is_cover : p.has_cover_video,
                                }));
                              }}
                              style={{ accentColor: "var(--admin-brand)" }} />
                            Cover
                          </label>
                          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={video.is_featured}
                              onChange={() => {
                                setForm((p) => {
                                  const next = [...p.videos];
                                  next[i] = { ...next[i], is_featured: !next[i].is_featured };
                                  return { ...p, videos: next };
                                });
                              }}
                              style={{ accentColor: "var(--admin-brand)" }} />
                            Featured
                          </label>
                          <button onClick={() => {
                            setForm((p) => ({ ...p, videos: p.videos.filter((_, j) => j !== i) }));
                          }}
                            style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "rgba(190,18,60,0.4)", fontSize: 11 }}>
                            Remove
                          </button>
                        </Flex>
                      </div>
                    </Flex>
                  </div>
                ))}
              </Flex>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => {
                setForm((p) => ({ ...p, videos: [...p.videos, { _id: videoId(), url: "", thumbnail: "", title: "", alt_text: "", is_cover: false, is_featured: false }] }));
              }}
                style={{ padding: "8px 16px", borderRadius: 12, border: "1px dashed var(--admin-border-strong)", fontSize: 11, color: "var(--admin-muted)", cursor: "pointer", background: "none" }}>
                + Add Video URL
              </button>
              <label style={{ padding: "8px 16px", borderRadius: 12, border: "1px dashed var(--admin-border-strong)", fontSize: 11, color: "var(--admin-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> Upload Video
                <input key={`video-${imageUploadKey}`} type="file" accept="video/mp4,video/webm,video/ogg" multiple style={{ display: "none" }}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files) return;
                    const uploads = Array.from(files).map((f) => uploadVideo(f));
                    const results = await Promise.allSettled(uploads);
                    const items: ProductVideoForm[] = [];
                    let failed = 0;
                    for (const r of results) {
                      if (r.status === "fulfilled") items.push({ _id: videoId(), url: r.value.url, _storageKey: r.value.key, thumbnail: "", title: "", alt_text: "", is_cover: false, is_featured: false });
                      else failed++;
                    }
                    if (items.length > 0) setForm((prev) => ({ ...prev, videos: [...prev.videos, ...items] }));
                    if (failed > 0) message.warning(`${failed} video(s) failed to upload.`);
                    if (items.length > 0) message.success(`${items.length} video(s) uploaded.`);
                    setImageUploadKey((k) => k + 1);
                  }} />
              </label>
            </div>
          </Card>

          {/* Customization Options */}
          {form.can_be_customized && (
            <Card className="admin-soft-panel" variant="borderless"
              title={<Flex align="center" gap={8}><FileText size={14} /> Customization Options</Flex>}
              style={{ flex: "1 1 300px", minWidth: 0 }}>
              {form.customization_options.length > 0 && (
                <Flex vertical gap={8}>
                  {form.customization_options.map((opt, oi) => (
                    <div key={opt._id}
                      style={{ borderRadius: 12, border: "1px solid var(--admin-input-border)", padding: 12, background: opt.is_active ? "none" : "var(--admin-muted-alpha-05)" }}>
                      <Flex gap={12} vertical>
                        <Flex gap={8} align="center" wrap>
                          <input value={opt.name} onChange={(e) => {
                            setForm((p) => {
                              const next = [...p.customization_options];
                              next[oi] = { ...next[oi], name: e.target.value };
                              return { ...p, customization_options: next };
                            });
                          }}
                            placeholder="Option name (e.g. Engraving Text)"
                            className="admin-input"
                            style={{ flex: "1 1 180px", fontSize: 11, padding: "6px 10px" }} />
                          <select value={opt.option_type} onChange={(e) => {
                            setForm((p) => {
                              const next = [...p.customization_options];
                              next[oi] = { ...next[oi], option_type: e.target.value as CustomizationOptionForm["option_type"] };
                              return { ...p, customization_options: next };
                            });
                          }}
                            className="admin-input"
                            style={{ flex: "0 1 130px", fontSize: 11, padding: "6px 10px" }}>
                            <option value="text">Text</option>
                            <option value="textarea">Text Area</option>
                            <option value="color_picker">Color Picker</option>
                            <option value="image_upload">Image Upload</option>
                            <option value="select">Select</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="file">File Upload</option>
                          </select>
                          <input type="number" value={opt.ordering ?? oi} onChange={(e) => {
                            setForm((p) => {
                              const next = [...p.customization_options];
                              next[oi] = { ...next[oi], ordering: Number(e.target.value) };
                              return { ...p, customization_options: next };
                            });
                          }}
                            className="admin-input"
                            style={{ width: 60, fontSize: 11, padding: "6px 10px" }}
                            title="Order" />
                        </Flex>
                        <Flex gap={8} align="center" wrap>
                          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={opt.is_required}
                              onChange={() => {
                                setForm((p) => {
                                  const next = [...p.customization_options];
                                  next[oi] = { ...next[oi], is_required: !next[oi].is_required };
                                  return { ...p, customization_options: next };
                                });
                              }}
                              style={{ accentColor: "var(--admin-brand)" }} />
                            Required
                          </label>
                          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={opt.is_active}
                              onChange={() => {
                                setForm((p) => {
                                  const next = [...p.customization_options];
                                  next[oi] = { ...next[oi], is_active: !next[oi].is_active };
                                  return { ...p, customization_options: next };
                                });
                              }}
                              style={{ accentColor: "var(--admin-brand)" }} />
                            Active
                          </label>
                          <Flex align="center" gap={4} style={{ marginLeft: "auto" }}>
                            <Typography.Text style={{ fontSize: 10, color: "var(--admin-muted-alpha-55)", whiteSpace: "nowrap" }}>
                              Price modifier
                            </Typography.Text>
                            <input type="number" step="any" value={opt.price_modifier ?? ""} onChange={(e) => {
                              setForm((p) => {
                                const next = [...p.customization_options];
                                next[oi] = { ...next[oi], price_modifier: e.target.value ? Number(e.target.value) : null };
                                return { ...p, customization_options: next };
                              });
                            }}
                              className="admin-input"
                              style={{ width: 90, fontSize: 11, padding: "6px 10px" }}
                              placeholder="0.00" />
                          </Flex>
                          <button onClick={() => {
                            setForm((p) => ({ ...p, customization_options: p.customization_options.filter((_, j) => j !== oi) }));
                          }}
                            style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(190,18,60,0.4)", fontSize: 11 }}>
                            Remove
                          </button>
                        </Flex>
                        {(opt.option_type === "select" || opt.option_type === "checkbox") && (
                          <Flex vertical gap={4} style={{ marginLeft: 16 }}>
                            <Typography.Text style={{ fontSize: 10, color: "var(--admin-muted-alpha-55)" }}>Choices</Typography.Text>
                            {opt.choices.map((choice, ci) => (
                              <Flex key={ci} gap={6} align="center">
                                <input value={choice} onChange={(e) => {
                                  setForm((p) => {
                                    const next = [...p.customization_options];
                                    const nextChoices = [...next[oi].choices];
                                    nextChoices[ci] = e.target.value;
                                    next[oi] = { ...next[oi], choices: nextChoices };
                                    return { ...p, customization_options: next };
                                  });
                                }}
                                  className="admin-input"
                                  style={{ flex: 1, fontSize: 11, padding: "4px 8px" }}
                                  placeholder={`Choice ${ci + 1}`} />
                                <button onClick={() => {
                                  setForm((p) => {
                                    const next = [...p.customization_options];
                                    next[oi] = { ...next[oi], choices: next[oi].choices.filter((_, j) => j !== ci) };
                                    return { ...p, customization_options: next };
                                  });
                                }}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(190,18,60,0.4)", fontSize: 10 }}>
                                  <X size={12} />
                                </button>
                              </Flex>
                            ))}
                            <button onClick={() => {
                              setForm((p) => {
                                const next = [...p.customization_options];
                                next[oi] = { ...next[oi], choices: [...next[oi].choices, ""] };
                                return { ...p, customization_options: next };
                              });
                            }}
                              style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: 8, border: "1px dashed var(--admin-border-strong)", fontSize: 10, color: "var(--admin-muted)", cursor: "pointer", background: "none" }}>
                              + Add Choice
                            </button>
                          </Flex>
                        )}
                      </Flex>
                    </div>
                  ))}
                </Flex>
              )}
              <div style={{ marginTop: 12 }}>
                <button onClick={() => {
                  setForm((p) => ({
                    ...p,
                    customization_options: [...p.customization_options, {
                      _id: customizationId(), name: "", option_type: "text" as const,
                      is_required: false, price_modifier: null, choices: [], ordering: p.customization_options.length, is_active: true,
                    }],
                  }));
                }}
                  style={{ padding: "8px 16px", borderRadius: 12, border: "1px dashed var(--admin-border-strong)", fontSize: 11, color: "var(--admin-muted)", cursor: "pointer", background: "none" }}>
                  + Add Customization Option
                </button>
              </div>
            </Card>
          )}

          {hasVariants ? (
            <>
              {/* Categories */}
              <Card className="admin-soft-panel" variant="borderless" title="Categories" style={{ position: "relative", zIndex: 1 }}>
                <Flex vertical gap={16}>
                  <Flex vertical gap={6}>
                    <label className="admin-field-label">Primary Category *</label>
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
                    <label className="admin-field-label">Additional Categories</label>
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
                  <Flex vertical gap={6}>
                    <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "var(--admin-muted)", fontWeight: 500 }}>
                      Tags
                    </label>
                    <input
                      value={form.tags.join(", ")}
                      onChange={(e) => updateField("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
                      placeholder="Comma-separated tags, e.g. handmade, cotton, eco-friendly"
                      style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--admin-input-border)", fontSize: 14, outline: "none" }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      Tags help customers find your product through search and filtering.
                    </Typography.Text>
                  </Flex>
                  <Flex vertical gap={6}>
                    <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "var(--admin-muted)", fontWeight: 500 }}>
                      Aspect Ratio
                    </label>
                    <Select
                      value={form.aspect_ratio || undefined}
                      onChange={(v) => updateField("aspect_ratio", v ?? "")}
                      placeholder="Select aspect ratio"
                      allowClear
                      style={{ width: "100%" }}
                      options={aspectChoices.map((c) => ({ value: c.code, label: c.label }))}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      Image display ratio for product cards.
                      {categoryAspectRatio && !form.aspect_ratio ? ` (Category default: ${categoryAspectRatio})` : ""}
                    </Typography.Text>
                  </Flex>
                </Flex>
              </Card>

              {/* Base Price + Stock */}
              <Card className="admin-soft-panel" variant="borderless" title="Listing Price (shown on collections)">
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: hasVariants ? (isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr") : (isMobile ? "1fr 1fr" : "1fr 1fr 1fr") }}>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Price *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
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
                    width: "100%", padding: "10px 16px", borderRadius: 12, border: `1px solid ${fieldErrors["price"]  ? "var(--admin-danger)" : "var(--admin-input-border)"}`,
                    fontSize: 14, outline: "none", background: fieldErrors["price"] ? "var(--admin-danger-light)" : "var(--admin-input-bg)",
                  }}
                />
                {fieldErrors["price"] && <span style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{fieldErrors["price"]}</span>}
                {hasVariants && form.variants.length > 1 && form.price !== null && (
                  <button onClick={applyBasePriceToVariants} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--admin-brand)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    Apply to all variants
                  </button>
                )}
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Sale Price</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={form.sale_price ?? ""}
                  onChange={(e) => updateField("sale_price", parseDecimal(e.target.value))}
                  style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--admin-input-border)", fontSize: 14, outline: "none" }}
                />
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Compare At</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={form.compare_at_price ?? ""}
                  onChange={(e) => updateField("compare_at_price", parseDecimal(e.target.value))}
                  style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--admin-input-border)", fontSize: 14, outline: "none" }}
                />
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Currency</label>
                <select value={form.currency} onChange={(e) => updateField("currency", e.target.value)}
                  className="admin-select">
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Flex>
              {!hasVariants && (
                <>
                  <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Stock</label>
                <input type="number" value={form.variants[0]?.stock ?? ""} onChange={(e) => updateVariant(0, "stock", e.target.value ? Number(e.target.value) : null)}
                  className="admin-input" />
                  </Flex>
                  <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em", whiteSpace: "nowrap" }}>Low Stock Threshold</label>
                <input type="number" value={form.variants[0]?.lowStockThreshold ?? 5} onChange={(e) => updateVariant(0, "lowStockThreshold", Number(e.target.value))}
                  className="admin-input" />
                  </Flex>
                </>
              )}
            </div>
            <Flex gap={24} style={{ marginTop: 16 }} wrap="wrap" align="center">
              <Flex align="center" gap={8}>
                <Switch checked={form.is_active} onChange={(c) => updateField("is_active", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Active</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.tax_included} onChange={(c) => updateField("tax_included", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Tax Included</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.allow_backorder} onChange={(c) => updateField("allow_backorder", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Allow Backorders</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.can_be_customized} onChange={(c) => updateField("can_be_customized", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Can Be Customized</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.has_cover_video} onChange={(c) => updateField("has_cover_video", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Has Cover Video</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_featured} onChange={(c) => updateField("is_featured", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Featured</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_bestseller} onChange={(c) => updateField("is_bestseller", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Best Seller</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_new_arrival} onChange={(c) => updateField("is_new_arrival", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>New Arrival</Typography.Text>
              </Flex>
            </Flex>
          </Card>
            </>
          ) : (
            <Flex gap={16} wrap="wrap">
              <Card className="admin-soft-panel" variant="borderless" title="Categories" style={{ flex: "1 1 300px", minWidth: 0, position: "relative", zIndex: 1 }}>
                <Flex vertical gap={16}>
                  <Flex vertical gap={6}>
                    <label className="admin-field-label">Primary Category *</label>
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
                    <label className="admin-field-label">Additional Categories</label>
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
                  <Flex vertical gap={6}>
                    <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "var(--admin-muted)", fontWeight: 500 }}>
                      Tags
                    </label>
                    <input
                      value={form.tags.join(", ")}
                      onChange={(e) => updateField("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
                      placeholder="Comma-separated tags, e.g. handmade, cotton, eco-friendly"
                      style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--admin-input-border)", fontSize: 14, outline: "none" }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      Tags help customers find your product through search and filtering.
                    </Typography.Text>
                  </Flex>
                  <Flex vertical gap={6}>
                    <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3em", color: "var(--admin-muted)", fontWeight: 500 }}>
                      Aspect Ratio
                    </label>
                    <Select
                      value={form.aspect_ratio || undefined}
                      onChange={(v) => updateField("aspect_ratio", v ?? "")}
                      placeholder="Select aspect ratio"
                      allowClear
                      style={{ width: "100%" }}
                      options={aspectChoices.map((c) => ({ value: c.code, label: c.label }))}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      Image display ratio for product cards.
                      {categoryAspectRatio && !form.aspect_ratio ? ` (Category default: ${categoryAspectRatio})` : ""}
                    </Typography.Text>
                  </Flex>
                </Flex>
              </Card>
              <Card className="admin-soft-panel" variant="borderless" title="Price" style={{ flex: "1 1 300px", minWidth: 0 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Price *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
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
                    width: "100%", padding: "10px 16px", borderRadius: 12, border: `1px solid ${fieldErrors["price"]  ? "var(--admin-danger)" : "var(--admin-input-border)"}`,
                    fontSize: 14, outline: "none", background: fieldErrors["price"] ? "var(--admin-danger-light)" : "var(--admin-input-bg)",
                  }}
                />
                {fieldErrors["price"] && <span style={{ fontSize: 10, color: "var(--admin-danger)", fontWeight: 500 }}>{fieldErrors["price"]}</span>}
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Sale Price</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={form.sale_price ?? ""}
                  onChange={(e) => updateField("sale_price", parseDecimal(e.target.value))}
                  style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--admin-input-border)", fontSize: 14, outline: "none" }}
                />
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Compare At</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  value={form.compare_at_price ?? ""}
                  onChange={(e) => updateField("compare_at_price", parseDecimal(e.target.value))}
                  style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--admin-input-border)", fontSize: 14, outline: "none" }}
                />
              </Flex>
              <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Currency</label>
                <select value={form.currency} onChange={(e) => updateField("currency", e.target.value)}
                  className="admin-select">
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Flex>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", gridColumn: "1 / -1" }}>
                <Flex vertical gap={4}>
                <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Stock</label>
                <input type="number" value={form.variants[0]?.stock ?? ""} onChange={(e) => updateVariant(0, "stock", e.target.value ? Number(e.target.value) : null)}
                  className="admin-input" />
                </Flex>
                <Flex vertical gap={4}>
                  <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em", whiteSpace: "nowrap" }}>Low Stock Threshold</label>
                  <input type="number" value={form.variants[0]?.lowStockThreshold ?? 5} onChange={(e) => updateVariant(0, "lowStockThreshold", Number(e.target.value))}
                    className="admin-input" />
                </Flex>
              </div>
            </div>
            <Flex gap={24} style={{ marginTop: 16 }} wrap="wrap" align="center">
              <Flex align="center" gap={8}>
                <Switch checked={form.is_active} onChange={(c) => updateField("is_active", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Active</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.tax_included} onChange={(c) => updateField("tax_included", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Tax Included</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.allow_backorder} onChange={(c) => updateField("allow_backorder", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Allow Backorders</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.can_be_customized} onChange={(c) => updateField("can_be_customized", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Can Be Customized</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_featured} onChange={(c) => updateField("is_featured", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Featured</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_bestseller} onChange={(c) => updateField("is_bestseller", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Best Seller</Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <Switch checked={form.is_new_arrival} onChange={(c) => updateField("is_new_arrival", c)} size="small" />
                <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>New Arrival</Typography.Text>
              </Flex>
            </Flex>
              </Card>
            </Flex>
          )}

          {/* SEO + Shipping — side by side */}
          <Flex gap={16} wrap="wrap">
            <Card className="admin-soft-panel" variant="borderless" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div onClick={() => setSeoCollapsed((p) => !p)} className="admin-section-header">
                <Typography.Text strong style={{ fontSize: 13 }}>Search Engine Optimization</Typography.Text>
                {seoCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
              {!seoCollapsed && (
                <div style={{ padding: "0 20px 20px" }}>
                  <Flex vertical gap={12} style={{ marginTop: 12 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Leave blank to derive from product name and short description.
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
                      <span style={{ fontSize: 10, color: "var(--admin-muted-light)" }}>
                        {(form.meta_title || form.name || "").length}/255
                      </span>
                    </Flex>
                    <Flex vertical gap={4}>
                      <label className="admin-field-label">Meta Description</label>
                      <textarea
                        value={form.meta_description}
                        onChange={(e) => updateField("meta_description", e.target.value)}
                        placeholder={form.short_description || "Brief description for search engines (recommended ~150–160 characters)"}
                        rows={3}
                        maxLength={500}
                        className="admin-textarea"
                      />
                      <span style={{ fontSize: 10, color: "var(--admin-muted-light)" }}>
                        {(form.meta_description || form.short_description || "").length}/500
                      </span>
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
                </div>
              )}
            </Card>
            {!hasVariants && (
              <Card className="admin-soft-panel" variant="borderless" style={{ flex: "1 1 300px", minWidth: 0 }}>
                <div onClick={() => setShippingCollapsed((p) => !p)} className="admin-section-header">
                  <Typography.Text strong style={{ fontSize: 13 }}>Shipping</Typography.Text>
                  {shippingCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </div>
                {!shippingCollapsed && (
                  <div style={{ padding: "0 20px 20px" }}>
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", marginTop: 12 }}>
                      <Flex vertical gap={4}>
                        <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Weight (kg)</label>
                        <input type="number" step="0.01" value={form.variants[0]?.weight ?? ""} onChange={(e) => updateVariant(0, "weight", e.target.value ? Number(e.target.value) : null)}
                          className="admin-input" />
                      </Flex>
                      <Flex vertical gap={4}>
                        <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Length (cm)</label>
                        <input type="number" step="0.1" value={form.length ?? ""} onChange={(e) => updateField("length", e.target.value ? Number(e.target.value) : null)}
                          className="admin-input" />
                      </Flex>
                      <Flex vertical gap={4}>
                        <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Width (cm)</label>
                        <input type="number" step="0.1" value={form.width ?? ""} onChange={(e) => updateField("width", e.target.value ? Number(e.target.value) : null)}
                          className="admin-input" />
                      </Flex>
                      <Flex vertical gap={4}>
                        <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Height (cm)</label>
                        <input type="number" step="0.1" value={form.height ?? ""} onChange={(e) => updateField("height", e.target.value ? Number(e.target.value) : null)}
                          className="admin-input" />
                      </Flex>
                    </div>
                    <Flex align="center" gap={8} style={{ marginTop: 12 }}>
                      <Switch checked={form.free_shipping} onChange={(c) => updateField("free_shipping", c)} size="small" />
                      <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted-alpha-55)" }}>Free Shipping</Typography.Text>
                    </Flex>
                  </div>
                )}
              </Card>
            )}

            {/* ── Scheduling (always visible) ── */}
            <Card className="admin-soft-panel" variant="borderless" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div onClick={() => setScheduleCollapsed((p) => !p)} className="admin-section-header">
                <Flex align="center" gap={8}>
                  <Calendar size={16} color="var(--admin-muted)" />
                  <Typography.Text strong style={{ fontSize: 13 }}>Scheduling</Typography.Text>
                </Flex>
                {scheduleCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
              {!scheduleCollapsed && (
                <div style={{ padding: "0 20px 20px" }}>
                  <div style={{ display: "grid", gap: 16, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", marginTop: 12 }}>
                    <Flex vertical gap={4}>
                      <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>
                        Publish From
                      </label>
                      <input
                        type="datetime-local"
                        value={form.publish_from ? form.publish_from.slice(0, 16) : "2000-01-01T00:00"}
                        onChange={(e) => updateField("publish_from", e.target.value ? e.target.value + ":00Z" : "")}
                        className="admin-input"
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        Schedule when the product becomes visible on your store.
                      </Typography.Text>
                    </Flex>
                    <Flex vertical gap={4}>
                      <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>
                        Publish Until
                      </label>
                      <input
                        type="datetime-local"
                        value={form.publish_until ? form.publish_until.slice(0, 16) : "2000-01-01T00:00"}
                        onChange={(e) => updateField("publish_until", e.target.value ? e.target.value + ":00Z" : "")}
                        className="admin-input"
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        Automatically unpublish the product after this date.
                      </Typography.Text>
                    </Flex>
                  </div>
                </div>
              )}
            </Card>
          </Flex>
        </Flex>

        {/* ── Right Column: Variants (only when toggle is ON) ── */}
        {hasVariants && (
          <Flex vertical gap={16} style={{ minWidth: 0 }}>
            <Card className="admin-soft-panel" variant="borderless" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 24px" }}>
                <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                  <Flex align="center" gap={8}>
                    <Package size={16} color="var(--admin-muted)" />
                    <Typography.Text strong style={{ textTransform: "uppercase", letterSpacing: "0.3em", fontSize: 13 }}>
                      Variants <span style={{ color: "var(--admin-muted-light)", fontWeight: 400 }}>({form.variants.length})</span>
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
                <div style={{ borderTop: "1px solid var(--admin-divider)", padding: 20, background: "var(--admin-hover-bg)" }}>
                  <Flex align="center" gap={8}>
                    <Grid3X3 size={16} color="var(--admin-muted-light)" />
                    <Typography.Text style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted-alpha-55)" }}>Variant Matrix Generator</Typography.Text>
                  </Flex>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", margin: "8px 0" }}>
                    Generate all size × color combinations at once. Comma-separated values or click presets.
                  </Typography.Text>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3em", color: "var(--admin-muted)", fontWeight: 500 }}>Sizes</label>
                      <input value={matrixSizes} onChange={(e) => setMatrixSizes(e.target.value)}
                        placeholder="S, M, L, XL, XXL"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--admin-input-border)", fontSize: 13, outline: "none", marginTop: 4 }} />
                      <Flex wrap="wrap" gap={4} style={{ marginTop: 6 }}>
                        {SIZE_PRESETS.map((s) => (
                          <button key={s} onClick={() => setMatrixSizes((prev) => (prev ? `${prev}, ${s}` : s))}
                            style={{ padding: "2px 8px", fontSize: 10, borderRadius: 6, border: "1px solid var(--admin-input-border)", cursor: "pointer", background: "none", color: "var(--admin-muted)" }}>
                            {s}
                          </button>
                        ))}
                      </Flex>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3em", color: "var(--admin-muted)", fontWeight: 500 }}>Colors</label>
                      <input value={matrixColors} onChange={(e) => setMatrixColors(e.target.value)}
                        placeholder="Black, White, Red, Blue"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--admin-input-border)", fontSize: 13, outline: "none", marginTop: 4 }} />
                      <Flex wrap="wrap" gap={4} style={{ marginTop: 6 }}>
                        {COLOR_PRESETS.slice(0, 12).map((c) => (
                          <button key={c.name} onClick={() => setMatrixColors((prev) => (prev ? `${prev}, ${c.name}` : c.name))}
                            title={c.name}
                            style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--admin-input-border)", cursor: "pointer", background: c.hex }} />
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
              <div style={{ borderTop: "1px solid var(--admin-divider)", padding: "8px 24px", background: "var(--admin-hover-bg)" }}>
                <Flex align="center" gap={8}>
                  <Search size={14} color="var(--admin-muted-light)" />
                  <input value={variantSearch} onChange={(e) => setVariantSearch(e.target.value)}
                    placeholder="Search by SKU, size, color, barcode..."
                    style={{ flex: 1, border: "none", background: "none", fontSize: 12, outline: "none" }} />
                  {variantSearch && (
                    <button onClick={() => setVariantSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}>
                      <X size={12} />
                    </button>
                  )}
                </Flex>
              </div>

              {/* Sort */}
              <div style={{ borderTop: "1px solid var(--admin-divider)", padding: "8px 24px" }}>
                <Flex align="center" gap={4} wrap="wrap">
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500, marginRight: 4 }}>Sort:</span>
                  {(["size", "color", "price", "stock", "sku"] as const).map((key) => (
                    <button key={key} onClick={() => sortVariantsBy(key)}
                      style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer", color: "var(--admin-muted)", background: "none" }}>
                      {key}
                    </button>
                  ))}
                  <span style={{ color: "var(--admin-border-strong)", margin: "0 4px" }}>|</span>
                  <button onClick={clearAllVariants}
                    style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer", color: "var(--admin-danger)", background: "none" }}>
                    Clear
                  </button>
                </Flex>
              </div>

              {/* Variant Cards */}
              <div ref={variantContainerRef} style={{ maxHeight: 720, overflowY: "auto", borderTop: "1px solid var(--admin-divider)" }}>
                {(variantSearch ? filteredVariants : form.variants).map((variant, displayIdx) => {
                  const actualIdx = form.variants.indexOf(variant);
                  const isExpanded = expandedVariants.has(displayIdx);
                  const status = getStockStatus(variant.stock, variant.lowStockThreshold);
                  return (
                    <div key={displayIdx}
                      className="admin-variant-card"
                      style={{
                        opacity: variant.enabled ? 1 : 0.5,
                        borderBottom: "1px solid var(--admin-divider)",
                        borderLeft: "none",
                        borderRight: "none",
                        borderTop: "none",
                        borderRadius: 0,
                      }}
                      draggable
                      onDragStart={() => handleDragStart(displayIdx)}
                      onDragOver={(e) => handleDragOver(e, displayIdx)}
                      onDragEnd={handleDragEnd}
                    >
                      <div style={{ padding: "16px 24px" }}>
                        <Flex gap={8} align="start">
                          <div style={{ cursor: "grab", color: "var(--admin-muted-alpha-20)", marginTop: 6 }}>
                            <GripVertical size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Flex justify="space-between" align="center" gap={8} wrap="wrap">
                              <Flex align="center" gap={8} wrap="wrap">
                                <Typography.Text code style={{ fontSize: 12, fontWeight: 600 }}>
                                  {variant.sku || <span style={{ fontStyle: "italic", color: "var(--admin-muted-light)" }}>No SKU</span>}
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
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}>
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <button onClick={() => duplicateVariant(actualIdx)}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}
                                  title="Duplicate">
                                  <Copy size={14} />
                                </button>
                                <button onClick={() => toggleVariantEnabled(actualIdx)}
                                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}
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
                              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--admin-divider)" }}>
                                <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr" }}>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>SKU *</label>
                                    <div style={{ position: "relative" }}>
                                      <input type="text" value={variant.sku} onChange={(e) => updateVariant(actualIdx, "sku", e.target.value)}
                                        style={{ width: "100%", padding: "6px 30px 6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }} />
                                      <button onClick={() => generateSingleSku(actualIdx)}
                                        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}>
                                        <WandSparkles size={12} />
                                      </button>
                                    </div>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>Barcode / EAN</label>
                                    <div style={{ position: "relative" }}>
                                      <input type="text" value={variant.barcode} onChange={(e) => updateVariant(actualIdx, "barcode", e.target.value)}
                                        style={{ width: "100%", padding: "6px 30px 6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }} />
                                      <button onClick={() => generateSingleBarcode(actualIdx)}
                                        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--admin-muted-light)" }}>
                                        <WandSparkles size={12} />
                                      </button>
                                    </div>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>Weight (kg)</label>
                                    <input type="number" step="0.01" value={variant.weight ?? ""} onChange={(e) => updateVariant(actualIdx, "weight", e.target.value ? Number(e.target.value) : null)}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }} />
                                  </Flex>
                                </div>
                                <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", marginTop: 12 }}>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>Size</label>
                                    <input type="text" value={variant.size} onChange={(e) => updateVariant(actualIdx, "size", e.target.value)}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }} />
                                    <Flex wrap="wrap" gap={4}>
                                      {SIZE_PRESETS.slice(0, 5).map((s) => (
                                        <button key={s} onClick={() => updateVariant(actualIdx, "size", s)}
                                          style={{ padding: "4px 8px", fontSize: 10, borderRadius: 6, border: "1px solid var(--admin-input-border)", cursor: "pointer", background: variant.size === s ? "var(--admin-brand)" : "none", color: variant.size === s ? "var(--admin-text-on-brand)" : "var(--admin-muted)" }}>
                                          {s}
                                        </button>
                                      ))}
                                    </Flex>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>Color</label>
                                    <input type="text" value={variant.color} onChange={(e) => updateVariant(actualIdx, "color", e.target.value)}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }} />
                                    <Flex wrap="wrap" gap={4}>
                                      {COLOR_PRESETS.slice(0, 12).map((c) => (
                                        <button key={c.name} onClick={() => updateVariant(actualIdx, "color", c.name)}
                                          title={c.name}
                                          style={{ width: 18, height: 18, borderRadius: "50%", border: variant.color === c.name ? "2px solid #0f766e" : "1px solid var(--admin-input-border)", cursor: "pointer", background: c.hex }} />
                                      ))}
                                    </Flex>
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>Variant Image</label>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <input type="text" value={variant.image} onChange={(e) => updateVariant(actualIdx, "image", e.target.value)}
                                        placeholder="Image URL"
                                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }} />
                                      <label style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--admin-input-border)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                                        <Upload size={12} />
                                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVariantImageUpload(actualIdx, f); e.target.value = ""; }} />
                                      </label>
                                    </div>
                                    {variant.image && (
                                      <Image src={variant.image} alt="Variant" width={48} height={48} unoptimized style={{ borderRadius: 6, objectFit: "cover", border: "1px solid var(--admin-input-border)", marginTop: 4 }} />
                                    )}
                                  </Flex>
                                </div>
                                <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", marginTop: 12 }}>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>Stock</label>
                                    <input type="number" value={variant.stock ?? ""} onChange={(e) => updateVariant(actualIdx, "stock", e.target.value ? Number(e.target.value) : null)}
                                      style={{
                                        width: "100%", padding: "6px 10px", borderRadius: 8,
                                        border: `1px solid ${variant.stock !== null && variant.stock <= 0  ? "var(--admin-danger)" : "var(--admin-input-border)"}`,
                                        fontSize: 12, outline: "none",
                                      }} />
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>Low Stock Threshold</label>
                                    <input type="number" value={variant.lowStockThreshold} onChange={(e) => updateVariant(actualIdx, "lowStockThreshold", Number(e.target.value))}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }} />
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--admin-muted)", fontWeight: 500 }}>Price</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      step="0.01"
                                      value={variant.price ?? ""}
                                      onChange={(e) => updateVariant(actualIdx, "price", parseDecimal(e.target.value))}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }}
                                    />
                                  </Flex>
                                  <Flex vertical gap={4}>
                                    <label className="admin-field-label" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Compare At</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      step="0.01"
                                      value={variant.compareAt ?? ""}
                                      onChange={(e) => updateVariant(actualIdx, "compareAt", parseDecimal(e.target.value))}
                                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--admin-input-border)", fontSize: 12, outline: "none" }}
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
              <div style={{ borderTop: "1px solid var(--admin-divider)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {form.variants.length} variants · {enabledCount} enabled · {totalStock} total stock
                  {outOfStockCount > 0 && <span style={{ color: "var(--admin-danger)" }}> · {outOfStockCount} out of stock</span>}
                </Typography.Text>
                <Flex gap={6}>
                  <Button size="small" onClick={generateAllSkus}>Generate all SKUs</Button>
                  <Button size="small" onClick={generateAllBarcodes}>Generate all Barcodes</Button>
                </Flex>
              </div>
            </Card>
          </Flex>
        )}
      </div>

      <Modal
        title={<Flex align="center" gap={8}><Calendar size={18} /> Schedule Publication</Flex>}
        open={scheduleOpen}
        onCancel={() => setScheduleOpen(false)}
        onOk={handleScheduleConfirm}
        okText="Schedule"
        okButtonProps={{ disabled: !schedulePickDate }}
        width={400}
        destroyOnClose
      >
        <Flex vertical gap={12} style={{ marginTop: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>Publish on:</Typography.Text>
          <input
            type="datetime-local"
            value={schedulePickDate || "2000-01-01T00:00"}
            onChange={(e) => setSchedulePickDate(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--admin-border)', fontSize: 14,
              background: 'var(--admin-surface)', color: 'var(--admin-ink)',
            }}
          />
          <Typography.Text style={{ fontSize: 12, color: 'var(--admin-muted)' }}>
            The product will be published automatically on this date and time.
          </Typography.Text>
        </Flex>
      </Modal>

      {/* Video Preview Modal */}
      <Modal
        open={!!previewVideoUrl}
        onCancel={() => setPreviewVideoUrl(null)}
        footer={null}
        width={720}
        destroyOnClose
        centered
        styles={{ body: { padding: 0 } }}
      >
        {previewVideoUrl && (
          <video
            key={previewVideoUrl}
            src={previewVideoUrl}
            controls
            autoPlay
            style={{ width: "100%", maxHeight: "80vh", display: "block", borderRadius: 8 }}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </Modal>
    </Flex>
  );
}
