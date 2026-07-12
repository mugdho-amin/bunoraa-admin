"use client";

import { useCallback, useMemo, useState } from "react";
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
  Tooltip,
  Typography,
} from "antd";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  Moon,
  RefreshCcw,
  Sun,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { clearAuthState } from "@/lib/admin/auth-storage";
import type { ParsedAdminRoute } from "@/lib/admin/types";
import { getIconNode } from "@/lib/admin/utils";
import { useThemeStore, type ThemeMode } from "@/lib/admin/theme-store";
import { CommandPalette } from "@/components/shared/CommandPalette";

type AdminShellProps = {
  route: ParsedAdminRoute;
  children: React.ReactNode;
};

const { Header, Content, Sider } = Layout;

function MobileBottomNav({ items, pathname, onNavigate }: {
  items: Array<{ key: string; icon: React.ReactNode; label: string }>;
  pathname: string;
  onNavigate: (key: string) => void;
}) {
  const topItems = items.slice(0, 5);
  return (
    <nav className="admin-mobile-bottom-nav">
      {topItems.map((item) => (
        <button
          key={item.key}
          className={`admin-mobile-nav-item${pathname === item.key ? " active" : ""}`}
          onClick={() => onNavigate(item.key)}
          aria-label={item.label}
        >
          {item.icon}
          <span className="admin-mobile-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function AdminShell({ route, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  const isMobile = Boolean(screens.xs) || (!isDesktop && Boolean(screens.sm));
  const { bootstrap, refreshBootstrap } = useAdminBootstrap();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { mode, setMode } = useThemeStore();

  const toggleTheme = useCallback(() => {
    const next: Record<string, ThemeMode> = { light: "dark", dark: "system", system: "light" };
    setMode(next[mode] as ThemeMode);
  }, [mode, setMode]);

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

  const flatNavItems = useMemo(
    () =>
      (bootstrap?.navigation ?? []).flatMap((section) =>
        section.items.map((item) => ({
          key: item.path,
          icon: getIconNode(item.icon, 18),
          label: item.label,
        })),
      ),
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

  const handleMenuClick = (event: { key: string }) => {
    router.push(event.key);
    setMobileNavOpen(false);
  };

  const handleMobileNav = (key: string) => {
    router.push(key);
  };

  const userMenu = {
    items: [
      {
        key: "theme",
        icon: mode === "dark" ? <Sun size={16} /> : <Moon size={16} />,
        label: mode === "dark" ? "Light mode" : mode === "system" ? "System theme" : "Dark mode",
        onClick: toggleTheme,
      },
      {
        key: "command",
        icon: <Search size={16} />,
        label: "Command palette",
        onClick: () => setCommandOpen(true),
      },
      { type: "divider" as const },
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
          padding: sidebarCollapsed ? "16px 0" : "16px 16px",
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
          <Flex align="center" gap={8} justify="space-between">
            <Flex align="center" gap={8}>
              <Tag color="cyan" bordered={false} style={{ borderRadius: 999, paddingInline: 8 }}>
                Bunoraa
              </Tag>
              <Typography.Text strong style={{ fontSize: 15 }}>
                Admin v2
              </Typography.Text>
            </Flex>
            <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </Tooltip>
          </Flex>
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
                style={{ fontSize: 11, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {userEmail}
      </Typography.Text>
            </div>
          </Flex>
        )}
      </div>
    </Flex>
  );

  return (
    <>
      <Layout className="admin-page" style={{ background: "transparent", paddingBottom: isMobile ? 64 : 0 }}>
        {isDesktop ? (
          <Sider
            width={280}
            collapsedWidth={72}
            collapsible
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            trigger={null}
            style={{ background: "transparent", padding: 16 }}
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
            width="min(300px, 85vw)"
            styles={{ body: { padding: 0, background: "transparent" } }}
            extra={
              <Button
                type="text"
                icon={<ChevronLeft size={18} />}
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                style={{ color: "var(--admin-muted)" }}
              />
            }
          >
            <div className="admin-glass-card" style={{ height: "100%", borderRadius: 0 }}>
              {sideMenu}
            </div>
          </Drawer>
        )}

        <Layout style={{ background: "transparent", overflow: "hidden" }}>
          <Header
            style={{
              padding: isDesktop ? "16px 24px 0 0" : "12px",
              background: "transparent",
              height: "auto",
              lineHeight: "inherit",
              flexShrink: 0,
            }}
          >
            <Flex align="center" justify="space-between" gap={12}>
              <Flex align="center" gap={10} style={{ minWidth: 0 }}>
                {isDesktop ? (
                  <Button
                    type="text"
                    icon={sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    style={{ color: "var(--admin-muted)", flexShrink: 0, marginLeft: -4 }}
                  />
                ) : (
                  <Button
                    type="text"
                    icon={<MenuIcon size={18} />}
                    onClick={() => setMobileNavOpen(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44 }}
                  />
                )}
                <Flex vertical gap={0} style={{ minWidth: 0 }}>
                  {isDesktop ? (
                    <Space size={6} wrap>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Tag
                          color="blue"
                          bordered={false}
                          style={{ fontSize: 11, lineHeight: "18px", paddingInline: 6 }}
                        >
                          {route.type === "resource"
                            ? route.resource.group
                            : route.type === "page"
                              ? route.page.group
                              : "System"}
                        </Tag>
                        <span style={{ color: "var(--admin-muted)", opacity: 0.5, userSelect: "none" }}>/</span>
                        <span style={{ color: "var(--admin-muted)", opacity: 0.6 }}>{title}</span>
                      </Typography.Text>
                      <Tag
                        color={bootstrap?.app.environment === "production" ? "green" : "gold"}
                        bordered={false}
                        style={{ fontSize: 10, lineHeight: "16px", paddingInline: 5 }}
                      >
                        {bootstrap?.app.environment ?? "unknown"}
                      </Tag>
                    </Space>
                  ) : null}
                  <Typography.Title
                    level={4}
                    className="admin-display"
                    style={{ margin: 0, fontSize: 18, lineHeight: 1.3 }}
                  >
                    {title}
                  </Typography.Title>
                </Flex>
              </Flex>

              <Space size={8} wrap>
                <NotificationBell />
                <Dropdown menu={userMenu} trigger={["click"]}>
                  <Button
                    type="text"
                    style={{ height: 44, width: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Avatar
                      size={26}
                      style={{ background: "linear-gradient(135deg, #0f766e, #1d4ed8)" }}
                    >
                      {nameInitial}
                    </Avatar>
                  </Button>
                </Dropdown>
              </Space>
            </Flex>
          </Header>

          <Content
            className="admin-page-scroll"
            style={{
              padding: isDesktop ? "20px 24px 24px 0" : "12px 16px 24px",
              height: "100%",
              overflow: "auto",
            }}
          >
            <div className="animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>

      {/* Mobile Bottom Navigation */}
      {isMobile && flatNavItems.length > 0 && (
        <MobileBottomNav
          items={flatNavItems}
          pathname={pathname}
          onNavigate={handleMobileNav}
        />
      )}

      {/* Command Palette */}
      {commandOpen && (
        <CommandPalette
          items={flatNavItems}
          onClose={() => setCommandOpen(false)}
          onNavigate={(key) => {
            router.push(key);
            setCommandOpen(false);
          }}
        />
      )}
    </>
  );
}
