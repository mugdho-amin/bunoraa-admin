"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Col, Descriptions, Flex, Row, Skeleton, Tag, Typography } from "antd";
import { requestAdminData } from "@/lib/admin/http";

type HealthDetails = {
  status: string;
  service: string;
  timestamp: string;
  checks: Record<string, Record<string, unknown>>;
  services: Record<string, Record<string, unknown>>;
  websocket: Record<string, unknown>;
  workers: Record<string, unknown>;
  module_counts: Record<string, Record<string, number>>;
};

function SectionCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown>;
}) {
  return (
    <Card className="admin-soft-panel" title={title} bordered={false}>
      <Descriptions column={1} size="small">
        {Object.entries(data).map(([key, value]) => (
          <Descriptions.Item key={key} label={key}>
            {typeof value === "object" && value !== null ? (
              <pre>{JSON.stringify(value, null, 2)}</pre>
            ) : (
              String(value)
            )}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
}

export function AdminHealthPage({ detailed = false }: { detailed?: boolean }) {
  const query = useQuery({
    queryKey: ["admin", detailed ? "health-details" : "health"],
    queryFn: () => requestAdminData<HealthDetails>(detailed ? "/admin/health/details/" : "/admin/health/"),
    refetchInterval: 30_000,
  });

  if (query.isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  const data = query.data;
  if (!data) {
    return <Typography.Text type="secondary">No health data available.</Typography.Text>;
  }

  if (!detailed) {
    return (
      <Card className="admin-soft-panel" bordered={false}>
        <Flex vertical gap={16}>
          <Tag color={data.status === "ok" ? "green" : "gold"} style={{ width: "fit-content" }}>
            {data.status}
          </Tag>
          <Descriptions column={{ xs: 1, lg: 2 }}>
            {Object.entries(data.checks || {}).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                <pre>{JSON.stringify(value, null, 2)}</pre>
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex vertical gap={20}>
      <Card className="admin-soft-panel" bordered={false}>
        <Flex align="center" gap={12} wrap="wrap">
          <Tag color={data.status === "healthy" ? "green" : "gold"}>{data.status}</Tag>
          <Typography.Text type="secondary">
            {data.service} · {new Date(data.timestamp).toLocaleString()}
          </Typography.Text>
        </Flex>
      </Card>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <SectionCard title="Core checks" data={data.checks} />
        </Col>
        <Col xs={24} xl={12}>
          <SectionCard title="Platform services" data={data.services} />
        </Col>
        <Col xs={24} xl={12}>
          <SectionCard title="WebSocket status" data={data.websocket} />
        </Col>
        <Col xs={24} xl={12}>
          <SectionCard title="Worker status" data={data.workers} />
        </Col>
      </Row>
      <Card className="admin-soft-panel" title="Module counts" bordered={false}>
        <pre>{JSON.stringify(data.module_counts, null, 2)}</pre>
      </Card>
    </Flex>
  );
}
