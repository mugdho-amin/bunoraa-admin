"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge, Button, Dropdown, Flex, List, Space, Tag, Typography, Spin, Empty,
} from "antd";
import {
  Bell, CheckCheck, ExternalLink, Circle,
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

function normalizeWsUrl(url: string) {
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  return url;
}

function setupGlobalWebSocket(wsUrlOverride?: string) {
  const token = typeof window !== "undefined" ? getAccessToken() : null;
  if (!token) return;

  const wsUrl = wsUrlOverride || process.env.NEXT_PUBLIC_ADMIN_WS_URL;
  if (!wsUrl) return;
  const normalized = normalizeWsUrl(wsUrl);
  const url = `${normalized}${normalized.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;

  if (globalWs && globalWs.readyState <= WebSocket.OPEN) {
    if (globalWsUrl === normalized) return;
    globalWs.close();
    globalWs = null;
  }
  globalWsUrl = normalized;

  async function fetchLatestCount() {
    try {
      const res = await requestAdminEnvelope<{ count: number }>("/notifications/unread_count/");
      notifyListeners(res.data.count);
    } catch (err) {
      logger.error("Failed to fetch unread count", err);
    }
  }

  function connect() {
    if (globalWs && globalWs.readyState <= WebSocket.OPEN) return;
    try {
      globalWs = new WebSocket(url);
      globalWs.onopen = () => { fetchLatestCount(); };
      globalWs.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          if (["notification", "notification_message", "notification_updated", "notification_deleted", "connection_established"].includes(payload.type)) {
            fetchLatestCount();
          }
          if (payload.type === "unread_count" && typeof payload.count === "number") {
            notifyListeners(payload.count);
          }
        } catch { /* ignore */ }
      };
      globalWs.onerror = () => { logger.warn("WS notification: connection error"); };
      globalWs.onclose = () => {
        globalWs = null;
        setTimeout(connect, 5000);
      };
    } catch { /* ignore */ }
  }
  connect();
}

async function fetchUnreadCount() {
  try {
    const res = await requestAdminEnvelope<{ count: number }>("/notifications/unread_count/");
    notifyListeners(res.data.count);
  } catch (err) {
    logger.error("Failed to fetch unread count", err);
  }
}

export function useUnreadCount(wsUrlOverride?: string) {
  const [count, setCount] = useState(globalUnreadCount);
  useEffect(() => {
    globalListeners.add(setCount);
    fetchUnreadCount();
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
      } catch { /* ignore */ }
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

  const priorityColorMap: Record<string, string> = {
    urgent: "red",
    high: "orange",
    normal: "default",
    low: "default",
  };

  const items = [
    {
      key: "header",
      label: (
        <Flex align="center" justify="space-between" style={{ minWidth: 320, padding: "12px 16px 4px" }}>
          <Flex align="center" gap={8}>
            <Typography.Text strong style={{ fontSize: 15 }}>Notifications</Typography.Text>
            {unreadCount > 0 && (
              <Badge count={unreadCount} size="small" style={{ fontSize: 10, lineHeight: "14px" }} />
            )}
          </Flex>
          <Space size={2}>
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
        <div style={{ maxWidth: "calc(100vw - 32px)", width: 400, maxHeight: "min(420px, calc(100vh - 160px))", overflow: "auto" }}>
          {loading ? (
            <Flex justify="center" style={{ padding: 32 }}><Spin /></Flex>
          ) : notifications.length === 0 ? (
            <Flex vertical align="center" gap={8} style={{ padding: "32px 16px" }}>
              <Bell size={32} style={{ color: "var(--admin-muted-light)", opacity: 0.4 }} />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>No new notifications</Typography.Text>
            </Flex>
          ) : (
            <List
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  className={`admin-notif-item${!item.is_read ? " admin-notif-unread" : ""}`}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    background: item.is_read ? "transparent" : "rgba(15, 118, 110, 0.03)",
                    borderBottom: "1px solid var(--admin-divider)",
                  }}
                  onClick={() => markAsRead(item.id)}
                >
                  <Flex vertical gap={3} style={{ width: "100%" }}>
                    <Flex align="center" justify="space-between">
                      <Space size={6}>
                        {!item.is_read && <Circle size={8} fill="#0f766e" color="#0f766e" style={{ flexShrink: 0 }} />}
                        <Typography.Text strong style={{ fontSize: 13, lineHeight: 1.3 }}>{item.title}</Typography.Text>
                      </Space>
                      <Tag
                        color={priorityColorMap[item.priority] || "default"}
                        style={{ fontSize: 10, lineHeight: "16px", padding: "0 6px", border: "none", flexShrink: 0 }}
                      >
                        {item.type_display}
                      </Tag>
                    </Flex>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", paddingLeft: !item.is_read ? 14 : 0 }}
                    >
                      {item.message}
                    </Typography.Text>
                    <Typography.Text style={{ fontSize: 11, color: "var(--admin-muted-light)", paddingLeft: !item.is_read ? 14 : 0 }}>
                      {formatRelativeTime(item.created_at)}
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
        className="admin-header-btn"
        icon={
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <Bell size={18} />
          </Badge>
        }
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      />
    </Dropdown>
  );
}

function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}
