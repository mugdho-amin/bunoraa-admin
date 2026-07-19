"use client";

import { Flex, Spin, Typography } from "antd";

export function FullScreenLoader({
  message = "Preparing the admin workspace...",
}: {
  message?: string;
}) {
  return (
    <Flex
      vertical
      align="center"
      justify="center"
      gap={18}
      className="admin-page"
      style={{ minHeight: "100vh", padding: 24 }}
    >
      <div className="admin-glass-card" style={{ padding: 32, minWidth: 280, textAlign: "center" }}>
        <Spin size="large" />
        <Typography.Title level={4} className="admin-display" style={{ marginTop: 18, marginBottom: 8 }}>
          Bunoraa
        </Typography.Title>
        <Typography.Text type="secondary">{message}</Typography.Text>
      </div>
    </Flex>
  );
}
