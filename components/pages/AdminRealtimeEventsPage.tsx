"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, List, Skeleton, Space, Tag, Typography } from "antd";
import { requestAdminData } from "@/lib/admin/http";
import { AdminPageHeader } from "@/components/shared/AdminPageHeader";

type EventFeed = {
  events: Array<{
    type: string;
    module: string;
    entity_type: string;
    entity_id: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>;
  next_since: string;
  server_time: string;
};

export function AdminRealtimeEventsPage() {
  const query = useQuery({
    queryKey: ["admin", "realtime-events"],
    queryFn: () => requestAdminData<EventFeed>("/admin/realtime/events/?limit=40"),
    refetchInterval: 15_000,
  });

  return (
    <div className="admin-page-stack">
      <AdminPageHeader title="Realtime events" eyebrow="Operations" description="Recent changes across your store and connected modules." />
      <Card className="admin-soft-panel" bordered={false}>
      {query.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <List
          dataSource={query.data?.events ?? []}
          renderItem={(event) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Text strong>{event.type}</Typography.Text>
                    <Tag>{event.module}</Tag>
                    <Tag color="blue">{event.entity_type}</Tag>
                  </Space>
                }
                description={
                  <>
                    <Typography.Text type="secondary">
                      {new Date(event.timestamp).toLocaleString()} · {event.entity_id}
                    </Typography.Text>
                    <pre style={{ marginTop: 8 }}>{JSON.stringify(event.payload, null, 2)}</pre>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
      </Card>
    </div>
  );
}
