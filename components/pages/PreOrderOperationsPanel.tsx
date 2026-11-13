"use client";

import { useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { App, Button, Card, DatePicker, Flex, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import type { BaseKey, BaseRecord } from "@refinedev/core";
import { requestAdminData } from "@/lib/admin/http";

type StaffRecord = BaseRecord & { id: string; email: string; first_name?: string; last_name?: string; is_staff?: boolean };

const STATUS_OPTIONS = [
  "draft", "submitted", "under_review", "quoted", "quote_accepted", "quote_rejected",
  "deposit_pending", "deposit_paid", "in_production", "quality_check", "awaiting_approval",
  "revision_requested", "final_payment_pending", "completed", "ready_to_ship", "shipped",
  "delivered", "cancelled", "refunded", "on_hold",
].map((value) => ({ value, label: value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }));

export function PreOrderOperationsPanel({ preorderNumber, onUpdated }: { preorderNumber: BaseKey; onUpdated?: () => Promise<void> | void }) {
  const { message } = App.useApp();
  const [statusForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const staffQuery = useList<StaffRecord>({ resource: "users", pagination: { pageSize: 250 }, filters: [{ field: "is_staff", operator: "eq", value: true }] });
  const staffOptions = useMemo(() => (staffQuery.result.data ?? []).filter((user) => user.is_staff).map((user) => ({
    value: user.id,
    label: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
  })), [staffQuery.result.data]);
  const endpoint = `/admin/preorders/orders/${encodeURIComponent(String(preorderNumber))}`;

  async function submitAction(action: string, values: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await requestAdminData(`${endpoint}/${action}/`, { method: "POST", body: values });
      message.success(success);
      await onUpdated?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="admin-soft-panel" bordered={false} title="Pre-order operations">
      <Flex vertical gap={22}>
        <Form form={statusForm} layout="vertical" onFinish={(values) => submitAction("update_status", values, "Pre-order status updated.")}>
          <Typography.Title level={5}>Update status</Typography.Title>
          <Flex gap={12} wrap="wrap" align="flex-start">
            <Form.Item name="status" label="New status" rules={[{ required: true }]} style={{ minWidth: 240, flex: "1 1 240px" }}>
              <Select showSearch options={STATUS_OPTIONS} placeholder="Select a status" />
            </Form.Item>
            <Form.Item name="notes" label="Internal status note" style={{ minWidth: 280, flex: "2 1 280px" }}>
              <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
            </Form.Item>
          </Flex>
          <Flex justify="flex-end"><Button type="primary" htmlType="submit" loading={busy}>Save status</Button></Flex>
        </Form>

        <Form form={assignForm} layout="vertical" onFinish={(values) => submitAction("assign", values, "Pre-order assigned.")}>
          <Typography.Title level={5}>Assign owner</Typography.Title>
          <Flex gap={12} align="flex-end" wrap="wrap">
            <Form.Item name="staff_id" label="Staff member" rules={[{ required: true }]} style={{ minWidth: 260, flex: 1 }}>
              <Select showSearch optionFilterProp="label" loading={staffQuery.query.isLoading} options={staffOptions} placeholder="Choose a staff member" />
            </Form.Item>
            <Form.Item><Button htmlType="submit" loading={busy}>Assign</Button></Form.Item>
          </Flex>
        </Form>

        <Form form={quoteForm} layout="vertical" onFinish={(values) => {
          const { valid_until, ...amounts } = values;
          return submitAction("create_quote", {
            ...amounts,
            valid_until: valid_until?.toISOString(),
          }, "Quote created.");
        }}>
          <Typography.Title level={5}>Create quote</Typography.Title>
          <Flex gap={12} wrap="wrap">
            {(["base_price", "customization_cost", "rush_fee", "discount", "shipping", "tax"] as const).map((name) => (
              <Form.Item key={name} name={name} label={name.replaceAll("_", " ")} initialValue={0} rules={name === "base_price" ? [{ required: true, message: "Enter a base price." }] : undefined} style={{ minWidth: 155, flex: "1 1 155px" }}>
                <InputNumber min={0} precision={2} step={1} style={{ width: "100%" }} />
              </Form.Item>
            ))}
            <Form.Item name="valid_until" label="Quote expires" style={{ minWidth: 220 }}>
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="estimated_production_days" label="Production days" initialValue={14} style={{ minWidth: 150 }}>
              <InputNumber min={1} max={365} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Flex>
          <Form.Item name="terms" label="Terms"><Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} /></Form.Item>
          <Form.Item name="notes" label="Customer-facing note"><Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} /></Form.Item>
          <Flex justify="flex-end"><Space><Button onClick={() => quoteForm.resetFields()}>Reset</Button><Button type="primary" htmlType="submit" loading={busy}>Create quote</Button></Space></Flex>
        </Form>
      </Flex>
    </Card>
  );
}
