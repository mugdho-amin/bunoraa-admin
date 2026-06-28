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
import { LogOut, Menu as MenuIcon, RefreshCcw, ShieldEllipsis } from "lucide-react";
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

  const navigationItems = useMemo(
    () =>
      (bootstrap?.navigation ?? []).map((section) => ({
        key: section.group,
        label: section.group,
        type: "group" as const,
        children: section.items.map((item) => ({
          key: item.path,
          icon: getIconNode(item.icon, 16),
          label: item.label,
        })),
      })),
    [bootstrap?.navigation],
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

  const sideMenu = (
    <Flex vertical style={{ height: "100%" }}>
      <div style={{ padding: "24px 20px 18px" }}>
        <Tag color="cyan" bordered={false} style={{ borderRadius: 999, paddingInline: 10 }}>
          Bunoraa
        </Tag>
        <Typography.Title level={3} className="admin-display" style={{ marginTop: 14, marginBottom: 4 }}>
          Admin v2
        </Typography.Title>
        <Typography.Text type="secondary">Refine workspace over your Django admin APIs.</Typography.Text>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        items={navigationItems}
        onClick={(event) => {
          router.push(event.key);
          setMobileNavOpen(false);
        }}
        style={{ borderInlineEnd: "none", background: "transparent", flex: 1, paddingInline: 10 }}
      />
    </Flex>
  );

  const userMenu = {
    items: [
      {
        key: "refresh",
        icon: <RefreshCcw size={16} />,
        label: "Refresh bootstrap",
        onClick: () => {
          void refreshBootstrap();
        },
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

  return (
    <Layout className="admin-page" style={{ background: "transparent" }}>
      {isDesktop ? (
        <Sider
          width={296}
          style={{
            background: "transparent",
            padding: 20,
          }}
        >
          <div className="admin-glass-card" style={{ height: "100%", overflow: "hidden" }}>
            {sideMenu}
          </div>
        </Sider>
      ) : (
        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          placement="left"
          closable={false}
          width={320}
          styles={{ body: { padding: 0, background: "transparent" } }}
        >
          <div className="admin-glass-card" style={{ height: "100%" }}>
            {sideMenu}
          </div>
        </Drawer>
      )}

      <Layout style={{ background: "transparent" }}>
        <Header style={{ padding: isDesktop ? "20px 28px 0 0" : "16px", background: "transparent", height: "auto" }}>
          <div className="admin-glass-card" style={{ padding: "18px 22px" }}>
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
                      {route.type === "resource" ? route.resource.group : route.type === "page" ? route.page.group : "System"}
                    </Tag>
                    <Tag color={bootstrap?.app.environment === "production" ? "green" : "gold"} bordered={false}>
                      {bootstrap?.app.environment ?? "unknown"}
                    </Tag>
                  </Space>
                  <Typography.Title level={3} className="admin-display" style={{ margin: "8px 0 0" }}>
                    {title}
                  </Typography.Title>
                  <Typography.Text type="secondary">{subtitle}</Typography.Text>
                </div>
              </Flex>

              <Space size={16} wrap>
                <NotificationBell />
                <Space size={8}>
                  <ShieldEllipsis size={18} />
                  <Typography.Text type="secondary">MFA protected</Typography.Text>
                </Space>
                <Dropdown menu={userMenu} trigger={["click"]}>
                  <Button type="text" style={{ height: "auto", paddingBlock: 6 }}>
                    <Flex align="center" gap={10}>
                      <Avatar style={{ background: "linear-gradient(135deg, #0f766e, #1d4ed8)" }}>
                        {bootstrap?.identity.full_name?.slice(0, 1).toUpperCase() || "A"}
                      </Avatar>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 600 }}>{bootstrap?.identity.full_name || "Admin"}</div>
                        <Typography.Text type="secondary">{bootstrap?.identity.email}</Typography.Text>
                      </div>
                    </Flex>
                  </Button>
                </Dropdown>
              </Space>
            </Flex>
          </div>
        </Header>

        <Content style={{ padding: isDesktop ? "24px 28px 28px 0" : "0 16px 24px" }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
