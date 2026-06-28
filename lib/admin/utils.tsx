"use client";

import * as LucideIcons from "lucide-react";
import type { AdminFieldSchema } from "@/lib/admin/types";

export function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getIconNode(name?: string, size = 18) {
  const candidate = name
    ? (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[name]
    : undefined;
  const Icon = candidate ?? LucideIcons.SquareTerminal;
  return <Icon size={size} />;
}

export function isProbablyDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}(?:[tT ][\d:.+-Z]*)?$/.test(value);
}

export function formatValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "rgba(82, 96, 122, 0.86)" }}>Empty</span>;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    if (isProbablyDate(value)) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
    if (/^https?:\/\//.test(value)) {
      return (
        <a href={value} target="_blank" rel="noreferrer">
          {value}
        </a>
      );
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    if (value.every((item) => typeof item !== "object")) {
      return value.join(", ");
    }
    return <pre>{JSON.stringify(value, null, 2)}</pre>;
  }

  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export function pickVisibleKeys(record: Record<string, unknown>) {
  return Object.keys(record).filter((key) => {
    const value = record[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
  });
}

export function schemaFieldLabel(name: string, field?: AdminFieldSchema) {
  return field?.label || humanizeLabel(name);
}
