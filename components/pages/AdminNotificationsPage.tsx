"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Flex,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  Empty,
  Spin,
  message,
  Popconfirm,
  Tooltip,
  Statistic,
  Row,
  Col,
  Table,
} from "antd";
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Filter,
  RefreshCcw,
  Clock,
  Inbox,
} from "lucide-react";
import { requestAdminEnvelope } from "@/lib/admin/http";
import { logger } from "@/lib/admin/logger";

type NotificationItem = {
  id: string;
  type: string;
  type_display: string;
  category: string;
  category_display: string;
  priority: string;
  priority_display: string;
  status: string;
  title: string;
  message: string;
  url?: string;
  reference_type?: string;
  reference_id?: string;
  is_read: boolean;
  read_at?: string;
  channels_requested: string[];
  channels_sent: string[];
  metadata: Record<string, unknown>;
  created_at: string;
};

type GroupedItem = {
  type: string;
  type_display: string;
  count: number;
  unread_count: number;
  latest: NotificationItem | null;
};

const PAGE_SIZE = 20;

const categoryColors: Record<string, string> = {
  transactional: "blue",
  marketing: "purple",
  system: "cyan",
};

const priorityColors: Record<string, string> = {
  urgent: "red",
  high: "orange",
  normal: "default",
  low: "default",
};

export function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "grouped">("list");
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [grouped, setGrouped] = useState<GroupedItem[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      if (filterType) params.set("type", filterType);
      if (filterUnread) params.set("unread", "true");

      const res = await requestAdminEnvelope<NotificationItem[]>(
        `/notifications/?${params.toString()}`
      );
      setNotifications(res.data || []);
      setTotal(Number(res.meta?.count) || 0);
      setUnreadCount(Number(res.meta?.unread_count) || 0);
    } catch (err) {
      logger.error("Failed to fetch notifications", err);
    }
    setLoading(false);
  }, [page, filterType, filterUnread]);

  const fetchGrouped = useCallback(async () => {
    try {
      const res = await requestAdminEnvelope<GroupedItem[]>(
        "/notifications/grouped/"
      );
      setGrouped(res.data || []);
      if (res.meta?.total_unread !== undefined) {
        setUnreadCount(Number(res.meta.total_unread) || 0);
      }
    } catch (err) {
      logger.error("Failed to fetch grouped notifications", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (view === "grouped") {
        fetchGrouped();
      } else {
        fetchNotifications();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [view, fetchNotifications, fetchGrouped]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        await requestAdminEnvelope("/notifications/mark_read/", {
          method: "POST",
          body: { notification_ids: [id] },
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        logger.error("Failed to mark notification as read", err);
      }
    },
    []
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      await requestAdminEnvelope("/notifications/mark_all_read/", {
        method: "POST",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      message.success("All notifications marked as read");
    } catch (err) {
      logger.error("Failed to mark all notifications as read", err);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await requestAdminEnvelope(`/notifications/${id}/`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => t - 1);
      message.success("Notification deleted");
    } catch (err) {
      logger.error("Failed to delete notification", err);
    }
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await requestAdminEnvelope("/notifications/bulk_delete/", {
        method: "POST",
        body: { notification_ids: Array.from(selectedIds) },
      });
      message.success(`${selectedIds.size} notifications deleted`);
      setSelectedIds(new Set());
      fetchNotifications();
    } catch (err) {
      logger.error("Failed to bulk delete notifications", err);
    }
  }, [selectedIds, fetchNotifications]);

  const handleBulkMarkRead = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await requestAdminEnvelope("/notifications/mark_read/", {
        method: "POST",
        body: { notification_ids: Array.from(selectedIds) },
      });
      message.success("Marked as read");
      setSelectedIds(new Set());
      fetchNotifications();
    } catch (err) {
      logger.error("Failed to bulk mark notifications as read", err);
    }
  }, [selectedIds, fetchNotifications]);

  const typeOptions = useMemo(
    () => [
      { value: undefined, label: "All types" },
      ...Array.from(
        new Set(notifications.map((n) => n.type))
      ).map((t) => ({
        value: t,
        label: notifications.find((n) => n.type === t)?.type_display || t,
      })),
    ],
    [notifications]
  );

  const columns = [
    {
      title: "Status",
      dataIndex: "is_read",
      key: "is_read",
      width: 60,
      render: (is_read: boolean) =>
        is_read ? (
          <BellOff size={16} style={{ color: "var(--admin-muted-light)" }} />
        ) : (
          <Badge dot offset={[-2, 2]}>
            <Bell size={16} style={{ color: "var(--admin-brand)" }} />
          </Badge>
        ),
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: NotificationItem) => (
        <Flex vertical gap={2}>
          <Typography.Text strong={!record.is_read} style={{ fontSize: 14 }}>
            {title}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            style={{
              fontSize: 12,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {record.message}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Type",
      dataIndex: "type_display",
      key: "type",
      width: 130,
      render: (type_display: string, record: NotificationItem) => (
        <Tag
          color={categoryColors[record.category] || "default"}
          style={{ border: "none", fontSize: 11 }}
        >
          {type_display}
        </Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 90,
      render: (priority: string) => (
        <Tag color={priorityColors[priority] || "default"} style={{ border: "none" }}>
          {priority}
        </Tag>
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <Space size={4}>
            <Clock size={12} />
            <Typography.Text style={{ fontSize: 12 }}>
              {new Date(date).toLocaleDateString()}{" "}
              {new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Typography.Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: NotificationItem) => (
        <Space size={4}>
          {!record.is_read && (
            <Tooltip title="Mark as read">
              <Button
                type="text"
                size="small"
                icon={<CheckCheck size={14} />}
                onClick={() => handleMarkRead(record.id)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete this notification?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 size={14} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      {/* Stats Summary */}
      <Row gutter={16}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14 }}>
            <Statistic
              title="Total"
              value={total}
              prefix={<Inbox size={16} />}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14 }}>
            <Statistic
              title="Unread"
              value={unreadCount}
              prefix={<Bell size={16} />}
              valueStyle={{ fontSize: 22, color: "var(--admin-brand)" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14 }}>
            <Statistic
              title="Read"
              value={total - unreadCount}
              prefix={<BellOff size={16} />}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14 }}>
            <Statistic
              title="Categories"
              value={Object.keys(categoryColors).length}
              prefix={<Filter size={16} />}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Toolbar */}
      <Card size="small" style={{ borderRadius: 14 }} styles={{ body: { padding: "12px 16px" } }}>
        <Flex align="center" justify="space-between" wrap gap={8}>
          <Space size={12}>
            <Segmented
              value={view}
              onChange={(v) => {
                setLoading(true);
                setView(v as "list" | "grouped");
              }}
              options={[
                { value: "list", label: "List View" },
                { value: "grouped", label: "Grouped by Type" },
              ]}
            />
            {view === "list" && (
              <>
                <Select
                  value={filterType}
                  onChange={(value) => {
                    setLoading(true);
                    setFilterType(value);
                  }}
                  options={[
                    { value: undefined, label: "All Types" },
                    ...typeOptions.filter((o) => o.value !== undefined),
                  ] as { value?: string; label: string }[]}
                  style={{ width: 150 }}
                  size="small"
                  allowClear
                />
                <Button
                  type={filterUnread ? "primary" : "default"}
                  size="small"
                  icon={<Bell size={14} />}
                  onClick={() => {
                    setLoading(true);
                    setFilterUnread((v) => !v);
                  }}
                >
                  Unread only
                </Button>
              </>
            )}
          </Space>

          <Space size={8}>
            {selectedIds.size > 0 && (
              <>
                <Button
                  size="small"
                  icon={<CheckCheck size={14} />}
                  onClick={handleBulkMarkRead}
                >
                  Mark read ({selectedIds.size})
                </Button>
                <Popconfirm
                  title={`Delete ${selectedIds.size} notifications?`}
                  onConfirm={handleBulkDelete}
                >
                  <Button size="small" danger icon={<Trash2 size={14} />}>
                    Delete ({selectedIds.size})
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button
              size="small"
              icon={<RefreshCcw size={14} />}
              onClick={() => {
                if (view === "grouped") fetchGrouped();
                else fetchNotifications();
              }}
            >
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                size="small"
                icon={<CheckCheck size={14} />}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </Button>
            )}
          </Space>
        </Flex>
      </Card>

      {/* Content */}
      {view === "grouped" ? (
        loading ? (
          <Flex justify="center" style={{ padding: 48 }}>
            <Spin size="large" />
          </Flex>
        ) : grouped.length === 0 ? (
          <Card style={{ borderRadius: 14 }}>
            <Empty description="No notifications found" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {grouped.map((group) => (
              <Col xs={24} sm={12} lg={8} key={group.type}>
                <Card
                  size="small"
                  style={{ borderRadius: 14 }}
                  title={
                    <Flex align="center" justify="space-between">
                      <Space size={8}>
                        {group.unread_count > 0 ? (
                          <Bell size={16} style={{ color: "var(--admin-brand)" }} />
                        ) : (
                          <BellOff size={16} style={{ color: "var(--admin-muted-light)" }} />
                        )}
                        <Typography.Text strong>{group.type_display}</Typography.Text>
                      </Space>
                      <Space size={8}>
                        <Tag color="blue" style={{ border: "none" }}>
                          {group.count} total
                        </Tag>
                        {group.unread_count > 0 && (
                          <Tag color="green" style={{ border: "none" }}>
                            {group.unread_count} unread
                          </Tag>
                        )}
                      </Space>
                    </Flex>
                  }
                >
                  {group.latest && (
                    <Flex vertical gap={8}>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {group.latest.title}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {group.latest.message}
                      </Typography.Text>
                      <Typography.Text
                        style={{ fontSize: 11, color: "var(--admin-muted-light)" }}
                      >
                        {new Date(group.latest.created_at).toLocaleString()}
                      </Typography.Text>
                    </Flex>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )
      ) : (
        <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={notifications}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              onChange: (newPage) => {
                setLoading(true);
                setPage(newPage);
              },
              showSizeChanger: false,
              showTotal: (t) => `${t} notifications`,
            }}
            rowSelection={{
              selectedRowKeys: Array.from(selectedIds),
              onChange: (keys) => setSelectedIds(new Set(keys as string[])),
            }}
            locale={{ emptyText: <Empty description="No notifications" /> }}
            size="middle"
          />
        </Card>
      )}
    </Flex>
  );
}
