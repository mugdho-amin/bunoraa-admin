"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Col, Flex, List, Row, Skeleton, Statistic, Tag, Typography, Grid, Tooltip, Space,
} from "antd";
import {
  TrendingUp, TrendingDown, Users, Package, ShoppingCart, DollarSign,
  AlertCircle, Activity, Zap, BarChart3, Clock, RefreshCcw,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip, PieChart, Pie, Cell,
} from "recharts";
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
    revenue_today: string;
    orders_today: number;
    new_users_today: number;
    conversion_rate: number;
    avg_order_value: string;
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

const COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed", "#0891b2"];

const kpiCards = [
  { key: "revenue_30d", title: "Revenue (30d)", icon: <DollarSign size={18} />, color: "#0f766e", trend: "up", trendValue: "+12.5%", prefix: "" },
  { key: "orders", title: "Orders", icon: <ShoppingCart size={18} />, color: "#1d4ed8", trend: "up", trendValue: "+8.3%", prefix: "" },
  { key: "users", title: "Users", icon: <Users size={18} />, color: "#7c3aed", trend: "up", trendValue: "+5.7%", prefix: "" },
  { key: "orders_pending", title: "Pending", icon: <AlertCircle size={18} />, color: "#b45309", trend: "down", trendValue: "-3.1%", prefix: "" },
  { key: "products", title: "Products", icon: <Package size={18} />, color: "#0891b2", trend: "up", trendValue: "+2.4%", prefix: "" },
  { key: "conversion_rate", title: "Conversion", icon: <Activity size={18} />, color: "#be123c", trend: "up", trendValue: "+0.8%", suffix: "%" },
];

const chartData = [
  { name: "Mon", revenue: 4200, orders: 24, users: 18 },
  { name: "Tue", revenue: 3800, orders: 21, users: 15 },
  { name: "Wed", revenue: 5100, orders: 28, users: 22 },
  { name: "Thu", revenue: 4600, orders: 26, users: 20 },
  { name: "Fri", revenue: 5900, orders: 32, users: 25 },
  { name: "Sat", revenue: 4800, orders: 27, users: 19 },
  { name: "Sun", revenue: 5300, orders: 30, users: 23 },
];

const pieData = [
  { name: "Electronics", value: 35 },
  { name: "Clothing", value: 25 },
  { name: "Home", value: 20 },
  { name: "Sports", value: 12 },
  { name: "Other", value: 8 },
];

const recentActivity = [
  { action: "Order #1042 shipped", time: "2 min ago", type: "success" },
  { action: "New user registered", time: "5 min ago", type: "info" },
  { action: "Payment received — $245.00", time: "12 min ago", type: "success" },
  { action: "Product 'Silk Dress' out of stock", time: "18 min ago", type: "warning" },
  { action: "Refund processed — $89.00", time: "25 min ago", type: "error" },
  { action: "Support ticket #892 resolved", time: "34 min ago", type: "info" },
];

const statusColor: Record<string, string> = {
  success: "#047857",
  info: "#1d4ed8",
  warning: "#b45309",
  error: "#be123c",
};

export function AdminDashboardPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = Boolean(screens.xs) || Boolean(screens.sm);

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => requestAdminData<DashboardData>("/admin/dashboard/"),
  });

  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => requestAdminData<HealthData>("/admin/health/"),
    refetchInterval: 30_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["admin", "events", 8],
    queryFn: () => requestAdminData<EventFeed>("/admin/realtime/events/?limit=8"),
    refetchInterval: 20_000,
  });

  const checks = useMemo(() => Object.entries(healthQuery.data?.checks ?? {}), [healthQuery.data?.checks]);
  const d = dashboardQuery.data?.totals;

  return (
    <Flex vertical gap={isMobile ? 16 : 24}>
      {/* ── KPI Bento Grid ── */}
      <div style={{
        display: "grid",
        gap: isMobile ? 12 : 16,
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)",
      }}>
        {kpiCards.map((card) => (
          <div key={card.key} className="bento-cell kpi-card" style={{ padding: isMobile ? 14 : 18 }}>
            {dashboardQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: "60%" }} />
            ) : (
              <Flex vertical gap={6}>
                <Flex align="center" justify="space-between">
                  <div className="kpi-icon" style={{ background: `${card.color}18`, color: card.color, width: 34, height: 34, borderRadius: 10 }}>
                    {card.icon}
                  </div>
                  <span className={`kpi-trend ${card.trend}`}>
                    {card.trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {card.trendValue}
                  </span>
                </Flex>
                <Typography.Text style={{ fontSize: 11, color: "var(--admin-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {card.title}
                </Typography.Text>
                <Typography.Title level={isMobile ? 5 : 4} className="admin-display" style={{ margin: 0, fontSize: isMobile ? 16 : 22 }}>
                  {d?.[card.key as keyof typeof d] ?? "—"}{card.suffix ?? ""}
                </Typography.Title>
              </Flex>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <Row gutter={[isMobile ? 12 : 20, isMobile ? 12 : 20]}>
        <Col xs={24} lg={16}>
          <div className="bento-cell" style={{ padding: isMobile ? 14 : 20 }}>
            <Flex align="center" justify="space-between" style={{ marginBottom: 16 }}>
              <Flex align="center" gap={8}>
                <BarChart3 size={16} style={{ color: "var(--admin-muted)" }} />
                <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Revenue & Orders
                </Typography.Text>
              </Flex>
              <Tag bordered={false} style={{ fontSize: 10 }}>Last 7 days</Tag>
            </Flex>
            <div style={{ width: "100%", height: isMobile ? 200 : 280 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} fill="url(#revGrad)" />
                  <Area type="monotone" dataKey="orders" stroke="#1d4ed8" strokeWidth={2} fill="none" strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="bento-cell" style={{ padding: isMobile ? 14 : 20 }}>
            <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
              <BarChart3 size={16} style={{ color: "var(--admin-muted)" }} />
              <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Categories
              </Typography.Text>
            </Flex>
            <div style={{ width: "100%", height: isMobile ? 180 : 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={isMobile ? 60 : 80} innerRadius={isMobile ? 30 : 45} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}
                    formatter={(value, name) => [`${value}%`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Flex wrap="wrap" gap={8} justify="center" style={{ marginTop: 8 }}>
              {pieData.map((item, idx) => (
                <Flex key={item.name} align="center" gap={4}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[idx % COLORS.length] }} />
                  <Typography.Text style={{ fontSize: 10, color: "var(--admin-muted)" }}>{item.name}</Typography.Text>
                </Flex>
              ))}
            </Flex>
          </div>
        </Col>
      </Row>

      {/* ── Activity + Health + Events ── */}
      <Row gutter={[isMobile ? 12 : 20, isMobile ? 12 : 20]}>
        <Col xs={24} lg={8}>
          <div className="bento-cell" style={{ padding: isMobile ? 14 : 20 }}>
            <Flex align="center" gap={8} style={{ marginBottom: 12 }}>
              <Zap size={16} style={{ color: "var(--admin-muted)" }} />
              <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Recent Activity
              </Typography.Text>
            </Flex>
            <Flex vertical gap={0}>
              {recentActivity.map((item, idx) => (
                <Flex key={idx} align="center" gap={10} style={{ padding: "8px 0", borderBottom: idx < recentActivity.length - 1 ? "1px solid var(--admin-border)" : "none" }}>
                  <span className={`status-dot ${item.type}`} style={{ flexShrink: 0 }} />
                  <Flex vertical gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text style={{ fontSize: 13, lineHeight: 1.3 }}>{item.action}</Typography.Text>
                    <Typography.Text style={{ fontSize: 11, color: "var(--admin-muted)" }}>{item.time}</Typography.Text>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="bento-cell" style={{ padding: isMobile ? 14 : 20 }}>
            <Flex align="center" gap={8} style={{ marginBottom: 12 }}>
              <Activity size={16} style={{ color: "var(--admin-muted)" }} />
              <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                System Pulse
              </Typography.Text>
            </Flex>
            {healthQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <Flex vertical gap={10}>
                <Flex align="center" gap={8}>
                  <span className={`status-dot ${healthQuery.data?.status === "ok" ? "online" : "error"}`} />
                  <Tag color={healthQuery.data?.status === "ok" ? "green" : "gold"} bordered={false} style={{ margin: 0 }}>
                    {healthQuery.data?.status ?? "unknown"}
                  </Tag>
                </Flex>
                {checks.slice(0, 6).map(([name, value]) => (
                  <Flex key={name} justify="space-between" align="center">
                    <Typography.Text style={{ fontSize: 12, color: "var(--admin-muted)" }}>{name}</Typography.Text>
                    <Flex align="center" gap={6}>
                      <span className={`status-dot ${value.status === "ok" ? "online" : value.status === "degraded" ? "away" : "error"}`} />
                      <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>{value.status ?? "unknown"}</Typography.Text>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            )}
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="bento-cell" style={{ padding: isMobile ? 14 : 20 }}>
            <Flex align="center" gap={8} style={{ marginBottom: 12 }}>
              <RefreshCcw size={16} style={{ color: "var(--admin-muted)" }} />
              <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Live Events
              </Typography.Text>
              <Tag color="green" bordered={false} style={{ fontSize: 9, marginLeft: "auto" }}>Auto-refresh</Tag>
            </Flex>
            {eventsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <List
                dataSource={eventsQuery.data?.events ?? []}
                size="small"
                split={false}
                renderItem={(event, idx) => (
                  <List.Item style={{ padding: "6px 0", borderBottom: idx < (eventsQuery.data?.events?.length ?? 0) - 1 ? "1px solid var(--admin-border)" : "none" }}>
                    <Flex vertical gap={2} style={{ width: "100%" }}>
                      <Flex align="center" gap={6}>
                        <span className="status-dot online" style={{ width: 6, height: 6 }} />
                        <Typography.Text strong style={{ fontSize: 12 }}>{event.type}</Typography.Text>
                        <Tag bordered={false} style={{ fontSize: 9, lineHeight: "14px", paddingInline: 4 }}>{event.module}</Tag>
                      </Flex>
                      <Typography.Text style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                        {new Date(event.timestamp).toLocaleString()} · {event.entity_id}
                      </Typography.Text>
                    </Flex>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Col>
      </Row>

      {/* ── AI Insights Panel ── */}
      <div className="bento-cell" style={{
        padding: isMobile ? 14 : 20,
        borderLeft: "3px solid #0f766e",
        background: "linear-gradient(135deg, rgba(15,118,110,0.04), rgba(29,78,216,0.04))",
      }}>
        <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
          <Zap size={16} style={{ color: "#0f766e" }} />
          <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "#0f766e" }}>
            AI Insights
          </Typography.Text>
        </Flex>
        <Typography.Text style={{ fontSize: 14, color: "var(--admin-ink)", lineHeight: 1.6 }}>
          Revenue is trending <strong style={{ color: "#047857" }}>12.5% higher</strong> than last month. 
          Orders from repeat customers increased <strong style={{ color: "#047857" }}>18%</strong>. 
          Consider restocking Electronics &mdash; inventory is at <strong style={{ color: "#b45309" }}>22% capacity</strong>.
        </Typography.Text>
      </div>
    </Flex>
  );
}
