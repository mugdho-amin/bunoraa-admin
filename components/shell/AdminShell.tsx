"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Flex,
  Grid,
  Layout,
  Menu,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  RefreshCcw,
  ShieldEllipsis,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { clearAuthState } from "@/lib/admin/auth-storage";
import type { ParsedAdminRoute } from "@/lib/admin/types";
import { getIconNode } from "@/lib/admin/utils";

type AdminShellProps = {
  route: ParsedAdminRoute;
  children: React.ReactNode;
};

const { Header, Content, Sider } = Layout;

export function AdminShell({ route, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const { bootstrap, refreshBootstrap } = useAdminBootstrap();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigationItems = useMemo(
    () =>
      (bootstrap?.navigation ?? []).map((section) => ({
        key: section.group,
        label: section.group,
        type: "group" as const,
        children: section.items.map((item) => ({
          key: item.path,
          icon: getIconNode(item.icon, sidebarCollapsed ? 20 : 16),
          label: item.label,
        })),
      })),
    [bootstrap?.navigation, sidebarCollapsed],
  );

  const title =
    route.type === "page"
      ? route.page.label
      : route.type === "resource"
        ? route.resource.label
        : "Not Found";

  const subtitle =
    route.type === "page"
      ? route.page.description
      : route.type === "resource"
        ? route.resource.description
        : "The requested route does not match a registered admin page or resource.";

  const handleMenuClick = (event: { key: string }) => {
    router.push(event.key);
    setMobileNavOpen(false);
  };

  const userMenu = {
    items: [
      {
        key: "refresh",
        icon: <RefreshCcw size={16} />,
        label: "Refresh bootstrap",
        onClick: () => void refreshBootstrap(),
      },
      {
        key: "logout",
        icon: <LogOut size={16} />,
        label: "Sign out",
        onClick: () => {
          clearAuthState();
          window.location.href = "/login";
        },
      },
    ],
  };

  const nameInitial = bootstrap?.identity.full_name?.slice(0, 1).toUpperCase() || "A";
  const userName = bootstrap?.identity.full_name || "Admin";
  const userEmail = bootstrap?.identity.email;

  const sideMenu = (
    <Flex vertical style={{ height: "100%" }}>
      <div
        style={{
          padding: sidebarCollapsed ? "20px 0 18px" : "24px 20px 18px",
          textAlign: sidebarCollapsed ? "center" : "left",
          transition: "padding 0.2s, text-align 0.2s",
        }}
      >
        {sidebarCollapsed ? (
          <Tag
            color="cyan"
            bordered={false}
            style={{ borderRadius: 999, paddingInline: 8, fontSize: 11, lineHeight: "20px" }}
          >
            B
          </Tag>
        ) : (
          <>
            <Tag color="cyan" bordered={false} style={{ borderRadius: 999, paddingInline: 10 }}>
              Bunoraa
            </Tag>
            <Typography.Title
              level={3}
              className="admin-display"
              style={{ marginTop: 14, marginBottom: 4, fontSize: 20 }}
            >
              Admin v2
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Django admin workspace
            </Typography.Text>
          </>
        )}
      </div>

      <div
        className="sidebar-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingInline: sidebarCollapsed ? 4 : 10,
          transition: "padding 0.2s",
        }}
      >
        <Menu
          mode="inline"
          inlineCollapsed={sidebarCollapsed}
          selectedKeys={[pathname]}
          items={navigationItems}
          onClick={handleMenuClick}
          style={{ borderInlineEnd: "none", background: "transparent" }}
        />
      </div>

      <div
        style={{
          borderTop: "1px solid var(--admin-border)",
          padding: sidebarCollapsed ? "12px 0" : "14px 16px",
          transition: "padding 0.2s",
        }}
      >
        {sidebarCollapsed ? (
          <Dropdown menu={userMenu} trigger={["click"]} placement="topRight">
            <Button type="text" style={{ width: "100%", height: "auto", padding: "4px 0" }}>
              <Avatar
                size={32}
                style={{ background: "linear-gradient(135deg, #0f766e, #1d4ed8)" }}
              >
                {nameInitial}
              </Avatar>
            </Button>
          </Dropdown>
        ) : (
          <Flex align="center" gap={10}>
            <Dropdown menu={userMenu} trigger={["click"]}>
              <Avatar
                size={36}
                style={{
                  background: "linear-gradient(135deg, #0f766e, #1d4ed8)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {nameInitial}
              </Avatar>
            </Dropdown>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userName}
              </div>
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: 11,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userEmail}
              </Typography.Text>
            </div>
          </Flex>
        )}
      </div>

      {isDesktop && (
        <Button
          type="text"
          icon={sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            width: "100%",
            height: 40,
            borderRadius: 0,
            borderTop: "1px solid var(--admin-border)",
            color: "var(--admin-muted)",
          }}
        />
      )}
    </Flex>
  );

  return (
    <Layout className="admin-page" style={{ background: "transparent" }}>
      {isDesktop ? (
        <Sider
          width={280}
          collapsedWidth={72}
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          trigger={null}
          style={{
            background: "transparent",
            padding: 16,
          }}
        >
          <div className="admin-glass-card admin-sidebar-glass" style={{ height: "100%", overflow: "hidden" }}>
            {sideMenu}
          </div>
        </Sider>
      ) : (
        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          placement="left"
          closable={false}
          width={300}
          styles={{ body: { padding: 0, background: "transparent" } }}
        >
          <div className="admin-glass-card" style={{ height: "100%", borderRadius: 0 }}>
            {sideMenu}
          </div>
        </Drawer>
      )}

      <Layout style={{ background: "transparent" }}>
        <Header
          style={{
            padding: isDesktop ? "16px 24px 0 0" : "16px",
            background: "transparent",
            height: "auto",
          }}
        >
          <div className="admin-glass-card" style={{ padding: "14px 20px" }}>
            <Flex align="center" justify="space-between" gap={16} wrap="wrap">
              <Flex align="center" gap={14}>
                {!isDesktop ? (
                  <Button
                    type="text"
                    icon={<MenuIcon size={18} />}
                    onClick={() => setMobileNavOpen(true)}
                  />
                ) : null}
                <div>
                  <Space wrap size={[8, 8]}>
                    <Tag color="blue" bordered={false}>
                      {route.type === "resource"
                        ? route.resource.group
                        : route.type === "page"
                          ? route.page.group
                          : "System"}
                    </Tag>
                    <Tag
                      color={bootstrap?.app.environment === "production" ? "green" : "gold"}
                      bordered={false}
                    >
                      {bootstrap?.app.environment ?? "unknown"}
                    </Tag>
                  </Space>
                  <Typography.Title
                    level={4}
                    className="admin-display"
                    style={{ margin: "4px 0 0", fontSize: 18 }}
                  >
                    {title}
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {subtitle}
                  </Typography.Text>
                </div>
              </Flex>

              <Space size={12} wrap>
                <NotificationBell />
                <Space size={6}>
                  <ShieldEllipsis size={16} />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    MFA
                  </Typography.Text>
                </Space>
                <Dropdown menu={userMenu} trigger={["click"]}>
                  <Button type="text" style={{ height: "auto", padding: "4px 8px" }}>
                    <Flex align="center" gap={8}>
                      <Avatar
                        size={28}
                        style={{ background: "linear-gradient(135deg, #0f766e, #1d4ed8)" }}
                      >
                        {nameInitial}
                      </Avatar>
                      <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{userName}</div>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {userEmail}
                        </Typography.Text>
                      </div>
                    </Flex>
                  </Button>
                </Dropdown>
              </Space>
            </Flex>
          </div>
        </Header>

        <Content style={{ padding: isDesktop ? "20px 24px 24px 0" : "0 16px 24px" }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
