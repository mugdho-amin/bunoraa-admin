"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Col, Flex, List, Row, Skeleton, Tag, Typography, Grid,
} from "antd";
import {
  Users, Package, ShoppingCart, DollarSign,
  AlertCircle, Activity, Zap, BarChart3, RefreshCcw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
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
    conversion_rate: number;
    avg_order_value: string;
  };
};

type RevenueDataPoint = {
  date: string;
  revenue: string;
  orders: number;
};

type CategoryStat = {
  id: string;
  category: string;
  views: number;
  revenue: string;
  orders_count: number;
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

const CHART_COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed", "#0891b2", "#059669"];

function formatCurrency(value: string | number | undefined): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function formatNumber(value: number | undefined | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | string | undefined | null): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `${num.toFixed(1)}%`;
}

export function AdminDashboardPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = Boolean(screens.xs) || Boolean(screens.sm);

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => requestAdminData<DashboardData>("/admin/dashboard/"),
    staleTime: 30_000,
  });

  const revenueQuery = useQuery({
    queryKey: ["admin", "analytics", "revenue", 7],
    queryFn: () => requestAdminData<RevenueDataPoint[]>("/admin/analytics/dashboard/revenue/?days=7"),
    staleTime: 60_000,
  });

  const categoryQuery = useQuery({
    queryKey: ["admin", "analytics", "category-stats"],
    queryFn: () => requestAdminData<CategoryStat[]>("/admin/analytics/category-stats/"),
    staleTime: 60_000,
  });

  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => requestAdminData<HealthData>("/admin/health/"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["admin", "events", 8],
    queryFn: () => requestAdminData<EventFeed>("/admin/realtime/events/?limit=8"),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const checks = useMemo(() => Object.entries(healthQuery.data?.checks ?? {}), [healthQuery.data?.checks]);
  const d = dashboardQuery.data?.totals;

  const chartData = useMemo(() => {
    const data = revenueQuery.data;
    if (!data || data.length === 0) return [];
    return data.map((p) => ({
      name: new Date(p.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      revenue: parseFloat(p.revenue),
      orders: p.orders,
    }));
  }, [revenueQuery.data]);

  const pieData = useMemo(() => {
    const data = categoryQuery.data;
    if (!data || data.length === 0) return [];
    const total = data.reduce((sum, c) => sum + c.views, 0) || 1;
    return data.slice(0, 7).map((c) => ({
      name: c.category,
      value: Math.round((c.views / total) * 100),
    }));
  }, [categoryQuery.data]);

  const kpiCards = useMemo(() => [
    { key: "revenue_30d" as const, title: "Revenue (30d)", icon: <DollarSign size={18} />, color: "#0f766e", value: d?.revenue_30d != null ? formatCurrency(d.revenue_30d) : null },
    { key: "orders" as const, title: "Orders", icon: <ShoppingCart size={18} />, color: "#1d4ed8", value: formatNumber(d?.orders) },
    { key: "users" as const, title: "Users", icon: <Users size={18} />, color: "#7c3aed", value: formatNumber(d?.users) },
    { key: "orders_pending" as const, title: "Pending", icon: <AlertCircle size={18} />, color: "#b45309", value: formatNumber(d?.orders_pending) },
    { key: "products" as const, title: "Products", icon: <Package size={18} />, color: "#0891b2", value: formatNumber(d?.products) },
    { key: "conversion_rate" as const, title: "Conversion", icon: <Activity size={18} />, color: "#be123c", value: formatPercent(d?.conversion_rate) },
  ], [d]);

  return (
    <Flex vertical gap={isMobile ? 16 : 24}>
      {/* ── KPI Grid ── */}
      <div style={{
        display: "grid",
        gap: isMobile ? 12 : 16,
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)",
      }}>
        {dashboardQuery.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bento-cell kpi-card" style={{ padding: isMobile ? 14 : 18 }}>
                <Skeleton active paragraph={{ rows: 1 }} title={{ width: "60%" }} />
              </div>
            ))
          : kpiCards.map((card) => (
              <div key={card.key} className="bento-cell kpi-card" style={{ padding: isMobile ? 14 : 18 }}>
                <Flex vertical gap={6}>
                  <Flex align="center" justify="space-between">
                    <div className="kpi-icon" style={{ background: `${card.color}18`, color: card.color, width: 34, height: 34, borderRadius: 10 }}>
                      {card.icon}
                    </div>
                  </Flex>
                  <Typography.Text style={{ fontSize: 11, color: "var(--admin-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {card.title}
                  </Typography.Text>
                  <Typography.Title level={isMobile ? 5 : 4} className="admin-display" style={{ margin: 0, fontSize: isMobile ? 16 : 22 }}>
                    {card.value}
                  </Typography.Title>
                </Flex>
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
              {revenueQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : chartData.length === 0 ? (
                <Flex align="center" justify="center" style={{ height: "100%" }}>
                  <Typography.Text type="secondary">No revenue data available for the selected period.</Typography.Text>
                </Flex>
              ) : (
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
                    <Area type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
                    <Area type="monotone" dataKey="orders" stroke="#1d4ed8" strokeWidth={2} fill="none" strokeDasharray="4 4" name="Orders" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="bento-cell" style={{ padding: isMobile ? 14 : 20 }}>
            <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
              <BarChart3 size={16} style={{ color: "var(--admin-muted)" }} />
              <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Category Views
              </Typography.Text>
            </Flex>
            <div style={{ width: "100%", height: isMobile ? 180 : 240 }}>
              {categoryQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : pieData.length === 0 ? (
                <Flex align="center" justify="center" style={{ height: "100%" }}>
                  <Typography.Text type="secondary">No category data available.</Typography.Text>
                </Flex>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={isMobile ? 60 : 80} innerRadius={isMobile ? 30 : 45} dataKey="value" paddingAngle={3}>
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}
                      formatter={(value: number, name: string) => [`${value}%`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {pieData.length > 0 && (
              <Flex wrap="wrap" gap={8} justify="center" style={{ marginTop: 8 }}>
                {pieData.map((item, idx) => (
                  <Flex key={item.name} align="center" gap={4}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    <Typography.Text style={{ fontSize: 10, color: "var(--admin-muted)" }}>{item.name}</Typography.Text>
                  </Flex>
                ))}
              </Flex>
            )}
          </div>
        </Col>
      </Row>

      {/* ── Health + Events ── */}
      <Row gutter={[isMobile ? 12 : 20, isMobile ? 12 : 20]}>
        <Col xs={24} lg={12}>
          <div className="bento-cell" style={{ padding: isMobile ? 14 : 20 }}>
            <Flex align="center" gap={8} style={{ marginBottom: 12 }}>
              <Activity size={16} style={{ color: "var(--admin-muted)" }} />
              <Typography.Text strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                System Pulse
              </Typography.Text>
            </Flex>
            {healthQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : !healthQuery.data ? (
              <Typography.Text type="secondary">Health data unavailable.</Typography.Text>
            ) : (
              <Flex vertical gap={10}>
                <Flex align="center" gap={8}>
                  <span className={`status-dot ${healthQuery.data.status === "ok" ? "online" : "error"}`} />
                  <Tag color={healthQuery.data.status === "ok" ? "green" : "gold"} bordered={false} style={{ margin: 0 }}>
                    {healthQuery.data.status}
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
        <Col xs={24} lg={12}>
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
            ) : !eventsQuery.data?.events?.length ? (
              <Typography.Text type="secondary">No recent events.</Typography.Text>
            ) : (
              <List
                dataSource={eventsQuery.data.events}
                size="small"
                split={false}
                renderItem={(event, idx) => (
                  <List.Item style={{ padding: "6px 0", borderBottom: idx < eventsQuery.data.events.length - 1 ? "1px solid var(--admin-border)" : "none" }}>
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
    </Flex>
  );
}
