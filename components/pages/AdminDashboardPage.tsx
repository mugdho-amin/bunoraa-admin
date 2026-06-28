"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, Flex, List, Row, Skeleton, Statistic, Tag, Typography } from "antd";
import { requestAdminData } from "@/lib/admin/http";

type DashboardData = {
  generated_at: string;
  window_days: number;
  totals: {
    users: number;
    products: number;
    orders: number;
    orders_pending: number;
    revenue_30d: string;
  };
};

type HealthData = {
  status: string;
  checks: Record<string, { status?: string; [key: string]: unknown }>;
};

type EventFeed = {
  events: Array<{
    type: string;
    module: string;
    entity_type: string;
    entity_id: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>;
};

const statCards = [
  { key: "users", title: "Users" },
  { key: "products", title: "Products" },
  { key: "orders", title: "Orders" },
  { key: "orders_pending", title: "Pending Orders" },
] as const;

export function AdminDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => requestAdminData<DashboardData>("/admin/dashboard/"),
  });

  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => requestAdminData<HealthData>("/admin/health/"),
  });

  const eventsQuery = useQuery({
    queryKey: ["admin", "events", 8],
    queryFn: () => requestAdminData<EventFeed>("/admin/realtime/events/?limit=8"),
    refetchInterval: 20_000,
  });

  const checks = useMemo(() => Object.entries(healthQuery.data?.checks ?? {}), [healthQuery.data?.checks]);

  return (
    <Flex vertical gap={20}>
      <Row gutter={[20, 20]}>
        {statCards.map((card) => (
          <Col xs={24} md={12} xl={6} key={card.key}>
            <Card className="admin-soft-panel" variant="borderless">
              {dashboardQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 1 }} />
              ) : (
                <Statistic
                  title={card.title}
                  value={dashboardQuery.data?.totals?.[card.key] ?? 0}
                  valueStyle={{ fontFamily: "var(--font-display), Space Grotesk, sans-serif" }}
                />
              )}
            </Card>
          </Col>
        ))}
        <Col xs={24} md={12} xl={12}>
          <Card className="admin-soft-panel" variant="borderless">
            {dashboardQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Typography.Text type="secondary">Revenue window</Typography.Text>
                <Typography.Title level={2} className="admin-display" style={{ marginTop: 6 }}>
                  {dashboardQuery.data?.totals.revenue_30d ?? "0"}
                </Typography.Title>
                <Typography.Text type="secondary">
                  Rolling {dashboardQuery.data?.window_days ?? 30}-day revenue snapshot generated at{" "}
                  {dashboardQuery.data?.generated_at
                    ? new Date(dashboardQuery.data.generated_at).toLocaleString()
                    : "unknown"}
                  .
                </Typography.Text>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <Card className="admin-soft-panel" title="System pulse" variant="borderless">
            {healthQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <Flex vertical gap={14}>
                <Tag color={healthQuery.data?.status === "ok" ? "green" : "gold"} style={{ width: "fit-content" }}>
                  {healthQuery.data?.status ?? "unknown"}
                </Tag>
                {checks.map(([name, value]) => (
                  <Flex key={name} justify="space-between" align="center">
                    <Typography.Text>{name}</Typography.Text>
                    <Tag color={value.status === "ok" ? "green" : value.status === "degraded" ? "gold" : "red"}>
                      {value.status ?? "unknown"}
                    </Tag>
                  </Flex>
                ))}
              </Flex>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card className="admin-soft-panel" title="Realtime event stream" variant="borderless">
            {eventsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <List
                dataSource={eventsQuery.data?.events ?? []}
                renderItem={(event) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Flex align="center" gap={10} wrap="wrap">
                          <Typography.Text strong>{event.type}</Typography.Text>
                          <Tag>{event.module}</Tag>
                          <Tag color="blue">{event.entity_type}</Tag>
                        </Flex>
                      }
                      description={
                        <Typography.Text type="secondary">
                          {new Date(event.timestamp).toLocaleString()} · {event.entity_id}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
