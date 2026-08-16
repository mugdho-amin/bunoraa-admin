"use client";

import { useState } from "react";
import { Alert, Button, Flex, Input, Modal, Select, Space, Tag, Typography } from "antd";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import { humanizeLabel } from "@/lib/admin/utils";
import type { AiReviewDecision, ProductAiSuggestion } from "@/lib/productAi";

const LONG_FIELDS = new Set(["description", "short_description", "meta_description", "meta_keywords"]);
const READONLY_FIELDS = new Set(["tags"]);
const AUTOFILL_FIELDS = new Set([
  "name",
  "short_description",
  "description",
  "tags",
  "meta_title",
  "meta_description",
  "meta_keywords",
]);
const REVIEW_FIELD_ORDER = [
  "name",
  "short_description",
  "description",
  "tags",
  "meta_title",
  "meta_description",
  "meta_keywords",
];
const REVIEW_FIELD_RANK = new Map(REVIEW_FIELD_ORDER.map((field, index) => [field, index]));

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

function suggestedText(suggestion: ProductAiSuggestion): string {
  if (suggestion.field_name === "tags") {
    const names = suggestion.metadata?.names;
    if (Array.isArray(names) && names.length > 0) {
      return names.map(String).filter(Boolean).join(", ");
    }
  }
  const display = suggestion.display_value;
  if (display !== null && display !== undefined && String(display).trim() !== "") {
    return String(display);
  }
  return displayValue(suggestion.value);
}

type AiReviewModalProps = {
  open: boolean;
  jobId: string;
  suggestions: ProductAiSuggestion[];
  currentValues: Record<string, unknown>;
  regenerating: boolean;
  modelInfo: string;
  drafts: Array<{ jobId: string; createdAt: string }>;
  activeDraftId: string;
  onSelectDraft: (jobId: string) => void;
  onApply: (decisions: AiReviewDecision[]) => void;
  onRegenerate: () => void;
  onCancel: () => void;
};

function buildItems(suggestions: ProductAiSuggestion[]): ReviewItem[] {
  return suggestions
    .filter((s) => (
      AUTOFILL_FIELDS.has(s.field_name)
      && !s.is_null
      && s.value !== null
      && s.value !== undefined
    ))
    .sort((a, b) => (
      (REVIEW_FIELD_RANK.get(a.field_name) ?? Number.MAX_SAFE_INTEGER)
      - (REVIEW_FIELD_RANK.get(b.field_name) ?? Number.MAX_SAFE_INTEGER)
      || a.field_name.localeCompare(b.field_name)
    ))
    .map((suggestion) => ({
      suggestion,
      decision: "pending" as const,
      editedValue: suggestedText(suggestion),
    }));
}

export default function AiReviewModal({
  open,
  suggestions,
  currentValues,
  regenerating,
  modelInfo,
  drafts,
  activeDraftId,
  onSelectDraft,
  onApply,
  onRegenerate,
  onCancel,
}: AiReviewModalProps) {
  const [items, setItems] = useState<ReviewItem[]>(() => buildItems(suggestions));
  const [prevProps, setPrevProps] = useState({ open, suggestions });

  if (open && (open !== prevProps.open || suggestions !== prevProps.suggestions)) {
    setPrevProps({ open, suggestions });
    setItems(buildItems(suggestions));
  }

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

  const buildDecisions = (applyAll = false): AiReviewDecision[] => {
    return items
      .filter((item) => applyAll || item.decision !== "pending")
      .map((item) => {
        const { suggestion } = item;
        if (!applyAll && item.decision === "rejected") {
          return { field_name: suggestion.field_name, action: "rejected" as const };
        }
        if (READONLY_FIELDS.has(suggestion.field_name)) {
          // Taxonomy fields apply server-side from value_json (IDs); keep the
          // raw value so the recorded feedback matches the applied data.
          return {
            field_name: suggestion.field_name,
            action: "applied" as const,
            final_value: suggestion.value,
          };
        }
        const edited = item.editedValue.trim() !== suggestedText(suggestion).trim();
        return {
          field_name: suggestion.field_name,
          action: edited ? ("edited" as const) : ("applied" as const),
          final_value: item.editedValue,
        };
      });
  };

  const handleApply = () => {
    onApply(buildDecisions());
  };

  const handleApplyAll = () => {
    onApply(buildDecisions(true));
  };

  const reviewedCount = acceptedCount + rejectedCount;

  const renderValueInput = (item: ReviewItem, index: number) => {
    const field = item.suggestion.field_name;
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
      return <Typography.Text type="secondary">{suggestedText(item.suggestion)}</Typography.Text>;
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
      title={
        <Flex align="center" gap={10} wrap="wrap">
          <span>Review AI suggestions</span>
          {drafts.length > 1 && (
            <Select
              size="small"
              value={activeDraftId}
              onChange={onSelectDraft}
              style={{ minWidth: 180 }}
              options={drafts.map((draft, index) => ({
                value: draft.jobId,
                label: `Draft ${index + 1}${draft.jobId === activeDraftId ? " — current" : ""}`,
              }))}
            />
          )}
        </Flex>
      }
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
            <Button disabled={items.length === 0} onClick={handleApplyAll}>
              Apply all ({items.length})
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
        description="Confirm product claims and SEO wording against your product before applying."
      />
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Generated by: {modelInfo}
      </Typography.Text>
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
          const differs = currentText !== null && currentText !== suggestedText(suggestion);
          return (
            <Flex
              key={suggestion.field_name}
              vertical
              gap={8}
              style={{
                border: item.decision === "accepted"
                  ? "1px solid var(--admin-success)"
                  : item.decision === "rejected"
                    ? "1px solid var(--admin-danger)"
                    : "1px solid var(--admin-border)",
                borderRadius: 8,
                padding: 12,
                backgroundColor: item.decision === "accepted" ? "var(--admin-success-light)" : "var(--admin-surface)",
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
