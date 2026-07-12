"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

type CommandItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
};

type CommandPaletteProps = {
  items: CommandItem[];
  onClose: () => void;
  onNavigate: (key: string) => void;
};

export function CommandPalette({ items, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      query.trim()
        ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
        : items,
    [items, query],
  );

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        onNavigate(filtered[selectedIndex].key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, filtered, selectedIndex, onNavigate]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--admin-border)" }}>
          <Search size={18} style={{ color: "var(--admin-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, resources, and actions..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "none",
              fontSize: 15,
              color: "var(--admin-ink)",
            }}
          />
          <kbd style={{ fontSize: 10, color: "var(--admin-muted)", background: "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: 4, fontFamily: "inherit" }}>
            ESC
          </kbd>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--admin-muted)", fontSize: 13 }}>
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "10px 16px",
                  border: "none",
                  background: i === selectedIndex ? "rgba(15,118,110,0.08)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                  color: "var(--admin-ink)",
                  transition: "background 0.1s",
                }}
              >
                <span style={{ color: "var(--admin-muted)", flexShrink: 0, display: "flex" }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))
          )}
        </div>
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--admin-border)", display: "flex", gap: 16, fontSize: 11, color: "var(--admin-muted)" }}>
          <span><kbd style={{ background: "rgba(0,0,0,0.04)", padding: "1px 4px", borderRadius: 3, fontFamily: "inherit" }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ background: "rgba(0,0,0,0.04)", padding: "1px 4px", borderRadius: 3, fontFamily: "inherit" }}>↵</kbd> Open</span>
          <span><kbd style={{ background: "rgba(0,0,0,0.04)", padding: "1px 4px", borderRadius: 3, fontFamily: "inherit" }}>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
