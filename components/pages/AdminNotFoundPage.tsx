"use client";

import { Button, Card, Typography } from "antd";
import { useRouter } from "next/navigation";

export function AdminNotFoundPage() {
  const router = useRouter();

  return (
    <Card className="admin-soft-panel" bordered={false}>
      <Typography.Title level={3} className="admin-display">
        Route not registered
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        This path does not match the bootstrap metadata the backend exposed for Admin v2.
      </Typography.Paragraph>
      <Button type="primary" onClick={() => router.push("/dashboard")}>
        Go to dashboard
      </Button>
    </Card>
  );
}
