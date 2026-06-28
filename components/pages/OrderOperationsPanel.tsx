"use client";

import { useState } from "react";
import type { BaseKey } from "@refinedev/core";
import { App, Button, Card, Flex, Form, Input, Select, Space, Typography } from "antd";
import { requestAdminData } from "@/lib/admin/http";

type OrderOperationsPanelProps = {
  orderId: BaseKey;
  onUpdated?: () => Promise<void> | void;
};

const STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

async function refreshAfterUpdate(onUpdated?: () => Promise<void> | void) {
  if (!onUpdated) {
    return;
  }
  await onUpdated();
}

export function OrderOperationsPanel({ orderId, onUpdated }: OrderOperationsPanelProps) {
  const { message } = App.useApp();
  const [statusForm] = Form.useForm();
  const [trackingForm] = Form.useForm();
  const [shipForm] = Form.useForm();
  const [statusLoading, setStatusLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [shipLoading, setShipLoading] = useState(false);

  return (
    <Card
      className="admin-soft-panel"
      bordered={false}
      title="Order Operations"
      extra={<Typography.Text type="secondary">Live actions for fulfillment and support</Typography.Text>}
    >
      <Flex vertical gap={24}>
        <Form
          layout="vertical"
          form={statusForm}
          onFinish={async (values) => {
            setStatusLoading(true);
            try {
              await requestAdminData(`/admin/orders/${orderId}/status/`, {
                method: "PATCH",
                body: values,
              });
              message.success("Order status updated.");
              await refreshAfterUpdate(onUpdated);
              statusForm.setFieldValue("notes", "");
            } finally {
              setStatusLoading(false);
            }
          }}
        >
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            Update status
          </Typography.Title>
          <Flex gap={16} wrap="wrap" align="flex-start">
            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: "Select a new status." }]}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            >
              <Select options={STATUS_OPTIONS} placeholder="Choose status" />
            </Form.Item>
            <Form.Item
              label="Notes"
              name="notes"
              style={{ minWidth: 280, flex: "2 1 280px" }}
            >
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Optional operator note" />
            </Form.Item>
          </Flex>
          <Flex justify="flex-end">
            <Button type="primary" htmlType="submit" loading={statusLoading}>
              Save status
            </Button>
          </Flex>
        </Form>

        <Form
          layout="vertical"
          form={trackingForm}
          onFinish={async (values) => {
            setTrackingLoading(true);
            try {
              await requestAdminData(`/admin/orders/${orderId}/tracking/`, {
                method: "POST",
                body: values,
              });
              message.success("Tracking information added.");
              trackingForm.resetFields();
              await refreshAfterUpdate(onUpdated);
            } finally {
              setTrackingLoading(false);
            }
          }}
        >
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            Add tracking
          </Typography.Title>
          <Flex gap={16} wrap="wrap" align="flex-start">
            <Form.Item
              label="Tracking number"
              name="tracking_number"
              rules={[{ required: true, message: "Enter a tracking number." }]}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            >
              <Input placeholder="Courier reference" />
            </Form.Item>
            <Form.Item
              label="Tracking URL"
              name="tracking_url"
              style={{ minWidth: 280, flex: "2 1 280px" }}
            >
              <Input placeholder="https://carrier.example/track/..." />
            </Form.Item>
          </Flex>
          <Flex justify="flex-end">
            <Button htmlType="submit" loading={trackingLoading}>
              Save tracking
            </Button>
          </Flex>
        </Form>

        <Form
          layout="vertical"
          form={shipForm}
          onFinish={async (values) => {
            setShipLoading(true);
            try {
              await requestAdminData(`/admin/orders/${orderId}/ship/`, {
                method: "POST",
                body: values,
              });
              message.success("Order marked as shipped.");
              shipForm.resetFields();
              await refreshAfterUpdate(onUpdated);
            } finally {
              setShipLoading(false);
            }
          }}
        >
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            Mark shipped
          </Typography.Title>
          <Flex gap={16} wrap="wrap" align="flex-start">
            <Form.Item
              label="Tracking number"
              name="tracking_number"
              style={{ minWidth: 220, flex: "1 1 220px" }}
            >
              <Input placeholder="Optional tracking number" />
            </Form.Item>
            <Form.Item
              label="Tracking URL"
              name="tracking_url"
              style={{ minWidth: 280, flex: "2 1 280px" }}
            >
              <Input placeholder="Optional tracking URL" />
            </Form.Item>
          </Flex>
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <Typography.Text type="secondary">
              Use this when fulfillment is complete and the order should move into the shipped state.
            </Typography.Text>
            <Space>
              <Button htmlType="submit" type="primary" loading={shipLoading}>
                Mark shipped
              </Button>
            </Space>
          </Flex>
        </Form>
      </Flex>
    </Card>
  );
}
