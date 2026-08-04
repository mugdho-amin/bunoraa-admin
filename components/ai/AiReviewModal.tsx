"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Flex, Input, InputNumber, Modal, Space, Tag, Typography } from "antd";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import { humanizeLabel } from "@/lib/admin/utils";
import type { AiReviewDecision, ProductAiSuggestion } from "@/lib/productAi";

const LONG_FIELDS = new Set(["description", "short_description", "meta_description", "meta_keywords"]);
const NUMERIC_FIELDS = new Set([
  "price",
  "sale_price",
  "compare_at_price",
  "cost",
  "stock_quantity",
  "low_stock_threshold",
  "weight",
  "length",
  "width",
  "height",
]);
const READONLY_FIELDS = new Set(["primary_category", "categories", "tags"]);

type Decision = "pending" | "accepted" | "rejected";

type ReviewItem = {
  suggestion: ProductAiSuggestion;
  decision: Decision;
  editedValue: string;
};

function confidenceTier(confidence: number) {
  if (confidence >= 0.8) return { label: "High", color: "green" };
  if (confidence >= 0.6) return { label: "Medium", color: "orange" };
  return { label: "Low", color: "red" };
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "(no value)";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type AiReviewModalProps = {
  open: boolean;
  jobId: string;
  suggestions: ProductAiSuggestion[];
  currentValues: Record<string, unknown>;
  regenerating: boolean;
  onApply: (decisions: AiReviewDecision[]) => void;
  onRegenerate: () => void;
  onCancel: () => void;
};

function buildItems(suggestions: ProductAiSuggestion[]): ReviewItem[] {
  return suggestions
    .filter((s) => !s.is_null && s.value !== null && s.value !== undefined)
    .map((suggestion) => ({
      suggestion,
      decision: "pending" as const,
      editedValue: displayValue(suggestion.value),
    }));
}

export default function AiReviewModal({
  open,
  suggestions,
  currentValues,
  regenerating,
  onApply,
  onRegenerate,
  onCancel,
}: AiReviewModalProps) {
  const [items, setItems] = useState<ReviewItem[]>(() => buildItems(suggestions));

  useEffect(() => {
    if (open) setItems(buildItems(suggestions));
  }, [open, suggestions]);

  const acceptedCount = items.filter((i) => i.decision === "accepted").length;
  const rejectedCount = items.filter((i) => i.decision === "rejected").length;

  const toggleDecision = (index: number, decision: Decision) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, decision: item.decision === decision ? "pending" : decision } : item,
      ),
    );
  };

  const setEditedValue = (index: number, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, editedValue: value } : item)));
  };

  const handleApply = () => {
    const decisions: AiReviewDecision[] = items
      .filter((item) => item.decision !== "pending")
      .map((item) => {
        const { suggestion } = item;
        if (item.decision === "rejected") {
          return { field_name: suggestion.field_name, action: "rejected" as const };
        }
        const edited = !READONLY_FIELDS.has(suggestion.field_name)
          && item.editedValue.trim() !== String(suggestion.display_value ?? "").trim();
        const finalValue = NUMERIC_FIELDS.has(suggestion.field_name)
          ? Number(item.editedValue)
          : item.editedValue;
        return {
          field_name: suggestion.field_name,
          action: edited ? ("edited" as const) : ("applied" as const),
          final_value: finalValue,
        };
      });
    onApply(decisions);
  };

  const reviewedCount = acceptedCount + rejectedCount;

  const renderValueInput = (item: ReviewItem, index: number) => {
    const field = item.suggestion.field_name;
    if (NUMERIC_FIELDS.has(field)) {
      return (
        <InputNumber
          value={item.editedValue === "" ? null : Number(item.editedValue)}
          onChange={(value) => setEditedValue(index, value === null ? "" : String(value))}
          style={{ width: "100%" }}
          precision={2}
        />
      );
    }
    if (LONG_FIELDS.has(field)) {
      return (
        <Input.TextArea
          value={item.editedValue}
          onChange={(event) => setEditedValue(index, event.target.value)}
          rows={2}
          autoSize={{ minRows: 2, maxRows: 8 }}
        />
      );
    }
    if (READONLY_FIELDS.has(field)) {
      return <Typography.Text type="secondary">{displayValue(item.suggestion.value)}</Typography.Text>;
    }
    return (
      <Input
        value={item.editedValue}
        onChange={(event) => setEditedValue(index, event.target.value)}
      />
    );
  };

  return (
    <Modal
      open={open}
      title="Review AI suggestions"
      width={760}
      onCancel={onCancel}
      footer={
        <Flex justify="space-between" align="center">
          <Typography.Text type="secondary">
            {items.length > 0
              ? `${reviewedCount} of ${items.length} reviewed`
              : "No suggestions"}
          </Typography.Text>
          <Space>
            <Button onClick={onCancel}>Cancel</Button>
            <Button icon={<RefreshCw size={14} />} onClick={onRegenerate} loading={regenerating}>
              Regenerate
            </Button>
            <Button type="primary" disabled={acceptedCount === 0} onClick={handleApply}>
              Apply changes ({acceptedCount})
            </Button>
          </Space>
        </Flex>
      }
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 8 }}
        message="AI suggestions are drafts, not verified facts"
        description="Confirm material, dimensions, claims, prices, and SEO wording against your product before applying."
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Nothing is applied automatically. Review each suggestion, then apply the ones you want. Changes are only saved to the product when you save the product."
      />
      {items.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="AI found no new suggestions for this product."
        />
      )}
      <Flex vertical gap={12}>
        {items.map((item, index) => {
          const { suggestion } = item;
          const tier = confidenceTier(suggestion.confidence);
          const current = currentValues[suggestion.field_name];
          const currentText = current === undefined || current === null || current === ""
            ? null
            : displayValue(current);
          const differs = currentText !== null && currentText !== displayValue(suggestion.value);
          return (
            <Flex
              key={suggestion.field_name}
              vertical
              gap={8}
              style={{
                border: item.decision === "accepted"
                  ? "1px solid #52c41a"
                  : item.decision === "rejected"
                    ? "1px solid #ff4d4f"
                    : "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
                backgroundColor: item.decision === "accepted" ? "#f6ffed" : "#fff",
              }}
            >
              <Flex justify="space-between" align="center" gap={8} wrap>
                <Space size={8} wrap>
                  <Typography.Text strong>{humanizeLabel(suggestion.field_name)}</Typography.Text>
                  <Tag color={tier.color}>{tier.label} confidence</Tag>
                  {differs && (
                    <Tag color="warning" icon={<X size={12} />}>
                      Overwrites current value
                    </Tag>
                  )}
                </Space>
                <Space size={8}>
                  <Button
                    size="small"
                    type={item.decision === "accepted" ? "primary" : "default"}
                    icon={<Check size={12} />}
                    onClick={() => toggleDecision(index, "accepted")}
                  >
                    Apply
                  </Button>
                  <Button
                    size="small"
                    danger={item.decision === "rejected"}
                    icon={<X size={12} />}
                    onClick={() => toggleDecision(index, "rejected")}
                  >
                    Reject
                  </Button>
                </Space>
              </Flex>
              <Flex vertical gap={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Suggested value
                </Typography.Text>
                {renderValueInput(item, index)}
                {currentText !== null && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Current value: <Typography.Text delete={differs}>{currentText}</Typography.Text>
                  </Typography.Text>
                )}
              </Flex>
              {suggestion.rationale && (
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 0, fontSize: 12 }}
                  ellipsis={{ rows: 2, expandable: true, symbol: "more" }}
                >
                  {suggestion.rationale}
                </Typography.Paragraph>
              )}
              {suggestion.source_urls.length > 0 && (
                <Space size={4} wrap>
                  {suggestion.source_urls.slice(0, 3).map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      <ExternalLink size={12} /> {new URL(url).hostname}
                    </a>
                  ))}
                </Space>
              )}
            </Flex>
          );
        })}
      </Flex>
    </Modal>
  );
}
