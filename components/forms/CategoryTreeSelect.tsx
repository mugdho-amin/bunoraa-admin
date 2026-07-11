"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { ChevronRight, Home, Search, X } from "lucide-react";

export type CategoryNode = {
  id: string;
  name: string;
  parent_id?: string | null;
  parent?: string | null;
  path?: string | null;
  depth?: number | null;
  sort_order?: number | null;
  children_count?: number;
  has_children?: boolean;
};

type NormalizedCategory = {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  depth: number;
  sort_order: number;
  has_children: boolean;
  children_count: number;
};

export type CategoryTreeSelectProps = {
  categories: CategoryNode[];
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  maxPills?: number;
};

function deriveParentId(cat: CategoryNode): string | null {
  if (cat.parent_id != null && cat.parent_id !== "") return String(cat.parent_id);
  if (cat.parent != null && cat.parent !== "") return String(cat.parent);
  const path = String(cat.path || "");
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return null;
  return parts[parts.length - 2];
}

function normalizeCategories(raw: CategoryNode[]): NormalizedCategory[] {
  const base = raw.map((cat) => {
    const id = String(cat.id);
    const path = String(cat.path || id);
    const parent_id = deriveParentId(cat);
    const depth =
      typeof cat.depth === "number"
        ? cat.depth
        : Math.max(0, path.split("/").filter(Boolean).length - 1);
    return {
      id,
      name: cat.name || id,
      parent_id,
      path,
      depth,
      sort_order: typeof cat.sort_order === "number" ? cat.sort_order : 0,
      has_children: false,
      children_count: 0,
    };
  });

  const byParent = new Map<string | null, NormalizedCategory[]>();
  for (const cat of base) {
    const key = cat.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }

  for (const cat of base) {
    const children = byParent.get(cat.id) ?? [];
    cat.children_count = children.length;
    cat.has_children = children.length > 0;
  }

  return base.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

function getCategoryPath(cat: NormalizedCategory, byId: Map<string, NormalizedCategory>): string {
  const parts: string[] = [];
  let current: NormalizedCategory | undefined = cat;
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return parts.join(" › ");
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: "rgba(15,118,110,0.18)", borderRadius: 2, fontWeight: 600 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * Facebook/Django-admin style category picker with drill-down, search,
 * breadcrumbs, and multi/single selection.
 */
export function CategoryTreeSelect({
  categories,
  value,
  onChange,
  multiple = true,
  placeholder,
  error,
  disabled = false,
  maxPills = 5,
}: CategoryTreeSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);

  const normalized = useMemo(() => normalizeCategories(categories), [categories]);
  const byId = useMemo(() => new Map(normalized.map((c) => [c.id, c])), [normalized]);
  const selectedSet = useMemo(() => new Set(value.map(String)), [value]);

  const currentParentId = breadcrumb.length ? breadcrumb[breadcrumb.length - 1].id : null;
  const levelItems = useMemo(
    () => normalized.filter((c) => c.parent_id === currentParentId),
    [normalized, currentParentId],
  );

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return normalized.filter((c) => c.name.toLowerCase().includes(q));
  }, [normalized, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const openPanel = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setBreadcrumb([]);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const toggleId = (id: string) => {
    if (multiple) {
      if (selectedSet.has(id)) {
        onChange(value.filter((v) => String(v) !== id));
      } else {
        onChange([...value.map(String), id]);
      }
    } else {
      onChange([id]);
      close();
    }
  };

  const removeId = (id: string, e?: ReactMouseEvent) => {
    e?.stopPropagation();
    onChange(value.filter((v) => String(v) !== id));
  };

  const drillInto = (cat: NormalizedCategory) => {
    setBreadcrumb((prev) => [...prev, { id: cat.id, name: cat.name }]);
    setQuery("");
  };

  const goToBreadcrumb = (index: number) => {
    // -1 = root
    if (index < 0) {
      setBreadcrumb([]);
      return;
    }
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  const defaultPlaceholder = multiple ? "Search or browse categories..." : "Select a category...";
  const selectedNames = value
    .map((id) => byId.get(String(id)))
    .filter(Boolean) as NormalizedCategory[];

  const renderCheckbox = (checked: boolean) => (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: multiple ? 4 : "50%",
        border: checked ? "none" : "2px solid rgba(0,0,0,0.25)",
        background: checked ? "#0f766e" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "all 0.12s",
      }}
    >
      {checked && (
        multiple ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
        )
      )}
    </span>
  );

  const renderItem = (cat: NormalizedCategory, opts?: { path?: string; highlight?: string }) => {
    const checked = selectedSet.has(cat.id);
    return (
      <div
        key={cat.id}
        role="option"
        aria-selected={checked}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          cursor: "pointer",
          background: checked ? "rgba(15,118,110,0.08)" : "transparent",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => {
          if (!checked) e.currentTarget.style.background = "rgba(0,0,0,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = checked ? "rgba(15,118,110,0.08)" : "transparent";
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleId(cat.id);
          }}
          style={{
            border: "none",
            background: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
          aria-label={checked ? `Deselect ${cat.name}` : `Select ${cat.name}`}
        >
          {renderCheckbox(checked)}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (cat.has_children && !opts?.path) {
              drillInto(cat);
            } else {
              toggleId(cat.id);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            background: "none",
            textAlign: "left",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(0,0,0,0.85)" }}>
            {opts?.highlight ? highlightMatch(cat.name, opts.highlight) : cat.name}
          </span>
          {opts?.path && (
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.4)" }}>{opts.path}</span>
          )}
        </button>

        {cat.has_children && !opts?.path && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              drillInto(cat);
            }}
            style={{
              border: "none",
              background: "rgba(0,0,0,0.04)",
              borderRadius: 999,
              padding: "2px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              color: "rgba(0,0,0,0.45)",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
            title="Browse subcategories"
          >
            {cat.children_count}
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) close();
            else openPanel();
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          minHeight: 44,
          padding: "8px 12px",
          borderRadius: 12,
          border: `1px solid ${error ? "#be123c" : open ? "#0f766e" : "rgba(0,0,0,0.12)"}`,
          background: disabled ? "rgba(0,0,0,0.03)" : "#fff",
          boxShadow: open ? "0 0 0 2px rgba(15,118,110,0.2)" : "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
          }}
        >
          {selectedNames.length === 0 ? (
            <span style={{ fontSize: 14, color: "rgba(0,0,0,0.4)" }}>
              {placeholder || defaultPlaceholder}
            </span>
          ) : multiple ? (
            <>
              {selectedNames.slice(0, maxPills).map((cat) => (
                <span
                  key={cat.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(15,118,110,0.1)",
                    color: "#0f766e",
                    fontSize: 12,
                    fontWeight: 600,
                    maxWidth: 180,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cat.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => removeId(cat.id, e)}
                    aria-label={`Remove ${cat.name}`}
                    style={{
                      border: "none",
                      background: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "#0f766e",
                      display: "flex",
                      lineHeight: 1,
                      fontSize: 14,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedNames.length > maxPills && (
                <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
                  +{selectedNames.length - maxPills} more
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(0,0,0,0.85)" }}>
              {selectedNames[0]?.name}
            </span>
          )}
        </div>
        <ChevronRight
          size={16}
          style={{
            transform: open ? "rotate(-90deg)" : "rotate(90deg)",
            transition: "transform 0.15s",
            color: "rgba(0,0,0,0.35)",
            flexShrink: 0,
          }}
        />
      </div>

      {error && (
        <span style={{ fontSize: 10, color: "#be123c", fontWeight: 500, marginTop: 6, display: "block" }}>
          {error}
        </span>
      )}

      {/* Panel */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable={multiple}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 50,
            maxHeight: 420,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            boxShadow: "0 12px 28px rgba(0,0,0,0.14), 0 2px 4px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(0,0,0,0.04)",
                borderRadius: 999,
                padding: "0 12px",
                height: 36,
              }}
            >
              <Search size={14} color="rgba(0,0,0,0.35)" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories..."
                autoComplete="off"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 14,
                }}
              />
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: "rgba(0,0,0,0.05)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(0,0,0,0.45)",
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Breadcrumb (browse mode only) */}
          {!query.trim() && breadcrumb.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 12px",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                overflowX: "auto",
                fontSize: 13,
              }}
            >
              <button
                type="button"
                onClick={() => goToBreadcrumb(-1)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#0f766e",
                  padding: "2px 6px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                title="All categories"
              >
                <Home size={14} />
              </button>
              {breadcrumb.map((crumb, idx) => {
                const isLast = idx === breadcrumb.length - 1;
                return (
                  <span key={crumb.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "rgba(0,0,0,0.3)" }}>›</span>
                    <button
                      type="button"
                      onClick={() => !isLast && goToBreadcrumb(idx)}
                      disabled={isLast}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: isLast ? "default" : "pointer",
                        color: isLast ? "rgba(0,0,0,0.85)" : "#0f766e",
                        fontWeight: isLast ? 600 : 500,
                        padding: "2px 6px",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {crumb.name}
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 120, maxHeight: 280 }}>
            {query.trim() ? (
              searchMatches.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "rgba(0,0,0,0.4)", fontSize: 13 }}>
                  No categories found
                </div>
              ) : (
                searchMatches.map((cat) =>
                  renderItem(cat, {
                    path: getCategoryPath(cat, byId),
                    highlight: query.trim(),
                  }),
                )
              )
            ) : levelItems.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(0,0,0,0.4)", fontSize: 13 }}>
                No subcategories
              </div>
            ) : (
              levelItems.map((cat) => renderItem(cat))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "10px 12px",
              borderTop: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(0,0,0,0.015)",
            }}
          >
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", fontWeight: 500 }}>
              {multiple
                ? `${selectedSet.size} selected`
                : selectedSet.size
                  ? "1 selected"
                  : "Select a category"}
            </span>
            <button
              type="button"
              onClick={close}
              style={{
                border: "none",
                background: "#0f766e",
                color: "#fff",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
