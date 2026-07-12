"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge, Button, Dropdown, Flex, List, Space, Tag, Typography, Spin, Empty, Grid,
} from "antd";
import {
  Bell, CheckCheck, ExternalLink, Circle, BellOff,
} from "lucide-react";
import { requestAdminEnvelope } from "@/lib/admin/http";
import { logger } from "@/lib/admin/logger";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { getAccessToken } from "@/lib/admin/auth-storage";

type NotificationItem = {
  id: string;
  type: string;
  type_display: string;
  title: string;
  message: string;
  url?: string;
  is_read: boolean;
  created_at: string;
  priority: string;
  category: string;
};

let globalUnreadCount = 0;
const globalListeners = new Set<(count: number) => void>();

function notifyListeners(count: number) {
  globalUnreadCount = count;
  globalListeners.forEach((fn) => fn(count));
}

let globalWs: WebSocket | null = null;
let globalWsUrl: string | null = null;

function setupGlobalWebSocket(wsUrlOverride?: string) {
  const token = typeof window !== "undefined" ? getAccessToken() : null;
  if (!token) return;

  const wsUrl = wsUrlOverride || process.env.NEXT_PUBLIC_ADMIN_WS_URL || "ws://127.0.0.1:8000/ws/admin/updates/";
  const url = `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;

  if (globalWs && globalWs.readyState <= WebSocket.OPEN) {
    if (globalWsUrl === wsUrl) return;
    globalWs.close();
    globalWs = null;
  }
  globalWsUrl = wsUrl;

  function connect() {
    if (globalWs && globalWs.readyState <= WebSocket.OPEN) return;
    try {
      globalWs = new WebSocket(url);
      globalWs.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          if (["notification", "notification_message", "notification_updated", "notification_deleted", "connection_established"].includes(payload.type)) {
            fetchLatestCount();
          }
          if (payload.type === "unread_count" && typeof payload.count === "number") {
            notifyListeners(payload.count);
          }
        } catch (err) {
          logger.warn("WS notification: parse error", err);
        }
      };
      globalWs.onclose = () => {
        globalWs = null;
        setTimeout(connect, 5000);
      };
    } catch (err) {
      logger.warn("WS notification: connection error", err);
    }
  }

  async function fetchLatestCount() {
    try {
      const res = await requestAdminEnvelope<{ count: number }>("/notifications/unread_count/");
      notifyListeners(res.data.count);
    } catch (err) {
      logger.error("Failed to fetch unread count", err);
    }
  }

  connect();
}

export function useUnreadCount(wsUrlOverride?: string) {
  const [count, setCount] = useState(globalUnreadCount);
  useEffect(() => {
    globalListeners.add(setCount);
    setupGlobalWebSocket(wsUrlOverride);
    return () => { globalListeners.delete(setCount); };
  }, [wsUrlOverride]);
  return count;
}

export function NotificationBell() {
  const router = useRouter();
  const { bootstrap } = useAdminBootstrap();
  const wsUrl = bootstrap?.realtime?.websocket_url;
  const unreadCount = useUnreadCount(wsUrl);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = Boolean(screens.xs) || Boolean(screens.sm);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestAdminEnvelope<NotificationItem[]>("/notifications/?unread=true&limit=5");
      setNotifications(res.data || []);
    } catch (err) {
      logger.error("Failed to fetch notifications", err);
    }
    setLoading(false);
  }, []);

  const handleOpenChange = useCallback((visible: boolean) => {
    setOpen(visible);
    if (visible) fetchRecent();
  }, [fetchRecent]);

  function fetchLatestCountAfter() {
    setTimeout(async () => {
      try {
        const res = await requestAdminEnvelope<{ count: number }>("/notifications/unread_count/");
        notifyListeners(res.data.count);
      } catch (err) {
        logger.error("Failed to fetch latest unread count", err);
      }
    }, 500);
  }

  const markAsRead = useCallback(async (id: string) => {
    try {
      await requestAdminEnvelope("/notifications/mark_read/", {
        method: "POST",
        body: { notification_ids: [id] },
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      fetchLatestCountAfter();
    } catch (err) {
      logger.error("Failed to mark notification as read", err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await requestAdminEnvelope("/notifications/mark_all_read/", { method: "POST" });
      setNotifications([]);
      fetchLatestCountAfter();
    } catch (err) {
      logger.error("Failed to mark all notifications as read", err);
    }
  }, []);

  const dropdownWidth = isMobile ? "calc(100vw - 32px)" : "380px";

  const items = [
    {
      key: "header",
      label: (
        <Flex align="center" justify="space-between" style={{ width: dropdownWidth, padding: "8px 4px 4px" }}>
          <Typography.Text strong style={{ fontSize: 15 }}>Notifications</Typography.Text>
          <Space size={4}>
            {unreadCount > 0 && (
              <Button type="text" size="small" icon={<CheckCheck size={14} />} onClick={(e) => { e.stopPropagation(); markAllRead(); }}>
                Mark all read
              </Button>
            )}
            <Button type="text" size="small" icon={<ExternalLink size={14} />} onClick={(e) => { e.stopPropagation(); router.push("/notifications"); setOpen(false); }}>
              View all
            </Button>
          </Space>
        </Flex>
      ),
    },
    { key: "divider", type: "divider" as const, style: { margin: "4px 0" } },
    {
      key: "list",
      label: (
        <div style={{ width: dropdownWidth, maxHeight: 400, overflow: "auto" }}>
          {loading ? (
            <Flex justify="center" style={{ padding: 24 }}><Spin size="small" /></Flex>
          ) : notifications.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No new notifications" style={{ margin: "16px 0" }} />
          ) : (
            <List
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: item.is_read ? "transparent" : "rgba(15, 118, 110, 0.04)",
                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                    transition: "background 0.15s",
                  }}
                  onClick={() => markAsRead(item.id)}
                  onMouseEnter={(e) => { if (item.is_read) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = item.is_read ? "transparent" : "rgba(15, 118, 110, 0.04)"; }}
                >
                  <Flex vertical gap={2} style={{ width: "100%" }}>
                    <Flex align="center" justify="space-between">
                      <Space size={6}>
                        {!item.is_read && <Circle size={8} fill="#0f766e" color="#0f766e" />}
                        <Typography.Text strong style={{ fontSize: 13 }}>{item.title}</Typography.Text>
                      </Space>
                      <Tag
                        color={item.priority === "urgent" ? "red" : item.priority === "high" ? "orange" : "default"}
                        style={{ fontSize: 10, lineHeight: "16px", padding: "0 6px", border: "none", flexShrink: 0 }}
                      >
                        {item.type_display}
                      </Tag>
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.message}
                    </Typography.Text>
                    <Typography.Text style={{ fontSize: 11, color: "rgba(0,0,0,0.35)" }}>
                      {new Date(item.created_at).toLocaleString()}
                    </Typography.Text>
                  </Flex>
                </List.Item>
              )}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={["click"]} open={open} onOpenChange={handleOpenChange} placement="bottomRight">
      <Button
        type="text"
        icon={
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <Bell size={18} />
          </Badge>
        }
        style={{ height: 44, width: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      />
    </Dropdown>
  );
}
