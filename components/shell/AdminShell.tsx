"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Avatar,
  Button,
  Drawer,
  Flex,
  Grid,
  Layout,
  Menu,
  Space,
  Tooltip,
  Typography,
} from "antd";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Command,
  Sun,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { clearAuthState } from "@/lib/admin/auth-storage";
import type { ParsedAdminRoute } from "@/lib/admin/types";
import { getIconNode } from "@/lib/admin/utils";
import { useThemeStore, type ThemeMode } from "@/lib/admin/theme-store";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { InstallAppBanner } from "@/components/common/InstallAppBanner";
import { BrandMark } from "@/components/common/BrandMark";

type AdminShellProps = {
  route: ParsedAdminRoute;
  children: React.ReactNode;
};

const { Header, Content, Sider } = Layout;

const MOBILE_PRIORITY_NAMES = new Set([
  "dashboard",
  "orders",
  "catalog/products",
  "catalog/categories",
  "users",
]);

function MobileBottomNav({ items, pathname, onNavigate, onMore }: {
  items: Array<{ key: string; icon: React.ReactNode; label: string }>;
  pathname: string;
  onNavigate: (key: string) => void;
  onMore: () => void;
}) {
  const topItems = items.slice(0, 4);
  const isMoreActive = !topItems.some((item) => pathname === item.key || pathname.startsWith(`${item.key}/`));
  return (
    <nav className="admin-mobile-bottom-nav">
      {topItems.map((item) => {
        const isActive = pathname === item.key || pathname.startsWith(`${item.key}/`);
        return (
          <button
            key={item.key}
            className={`admin-mobile-nav-item${isActive ? " active" : ""}`}
            onClick={() => onNavigate(item.key)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon}
            <span className="admin-mobile-nav-label">{item.label}</span>
          </button>
        );
      })}
      <button
        className={`admin-mobile-nav-item${isMoreActive ? " active" : ""}`}
        onClick={onMore}
        aria-label="More sections"
        aria-haspopup="dialog"
      >
        <MoreHorizontal size={20} />
        <span className="admin-mobile-nav-label">More</span>
      </button>
    </nav>
  );
}

export function AdminShell({ route, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  // Keep the full navigation rail for laptop/desktop widths. Tablets use the
  // same compact drawer and bottom tabs as phones to preserve content space.
  const isDesktop = Boolean(screens.xl);
  const isMobile = !isDesktop;
  const { bootstrap, refreshBootstrap } = useAdminBootstrap();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerAccountMenuOpen, setHeaderAccountMenuOpen] = useState(false);
  const [sidebarAccountMenuOpen, setSidebarAccountMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarIsCollapsed = isDesktop && sidebarCollapsed;
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { mode, setMode } = useThemeStore();

  // Read the persisted preference after hydration to keep server/client markup aligned.
  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("admin_sidebar_collapsed") === "true");
    } catch {
      // Keep the expanded default when browser storage is unavailable.
    } finally {
      setSidebarPreferenceLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!sidebarPreferenceLoaded) return;
    try {
      localStorage.setItem('admin_sidebar_collapsed', String(sidebarCollapsed));
    } catch {
      // The sidebar remains usable for this session if persistence is blocked.
    }
  }, [sidebarCollapsed, sidebarPreferenceLoaded]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".admin-account-menu-anchor")) return;
      setHeaderAccountMenuOpen(false);
      setSidebarAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHeaderAccountMenuOpen(false);
      setSidebarAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

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
          icon: getIconNode(item.icon, sidebarIsCollapsed ? 20 : 16),
          label: item.label,
        })),
      })),
    [bootstrap?.navigation, sidebarIsCollapsed],
  );

  const flatNavItems = useMemo(
    () => {
      const all = (bootstrap?.navigation ?? []).flatMap((section) =>
        section.items.map((item) => ({
          key: item.path,
          icon: getIconNode(item.icon, 18),
          label: item.label,
          name: item.name,
        })),
      );
      const priority: typeof all = [];
      const rest: typeof all = [];
      for (const item of all) {
        if (MOBILE_PRIORITY_NAMES.has(item.name)) {
          priority.push(item);
        } else {
          rest.push(item);
        }
      }
      priority.sort((a, b) => itemPriority(a.name) - itemPriority(b.name));
      return [...priority, ...rest];
    },
    [bootstrap?.navigation],
  );

  const selectedNavKey = useMemo(() => {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    return flatNavItems
      .filter((item) => {
        const itemPath = item.key.replace(/\/+$/, "") || "/";
        return normalizedPath === itemPath || normalizedPath.startsWith(`${itemPath}/`);
      })
      .sort((a, b) => b.key.length - a.key.length)[0]?.key;
  }, [flatNavItems, pathname]);

  const currentSection = useMemo(() => {
    for (const section of bootstrap?.navigation ?? []) {
      if (section.items.some((item) => item.path === selectedNavKey)) return section.group;
    }
    return "Workspace";
  }, [bootstrap?.navigation, selectedNavKey]);

  function itemPriority(name: string): number {
    const order = ["dashboard", "orders", "catalog/products", "catalog/categories", "users"];
    const idx = order.indexOf(name);
    return idx === -1 ? 999 : idx;
  }

  const handleMenuClick = (event: { key: string }) => {
    router.push(event.key);
    setMobileNavOpen(false);
  };

  const handleMobileNav = (key: string) => {
    router.push(key);
  };

  const nameInitial = bootstrap?.identity.full_name?.slice(0, 1).toUpperCase() || "A";
  const userName = bootstrap?.identity.full_name || "Admin";
  const userEmail = bootstrap?.identity.email;
  const closeAccountMenus = () => {
    setHeaderAccountMenuOpen(false);
    setSidebarAccountMenuOpen(false);
  };
  const onHeaderAccountMenuChange = (open: boolean) => {
    setHeaderAccountMenuOpen(open);
    if (open) setSidebarAccountMenuOpen(false);
  };
  const onSidebarAccountMenuChange = (open: boolean) => {
    setSidebarAccountMenuOpen(open);
    if (open) setHeaderAccountMenuOpen(false);
  };

  const accountMenuContent = (
    <div className="admin-account-menu" role="menu" aria-label="Account menu">
      <div className="admin-account-menu-identity">
        <Avatar size={38} style={{ background: "var(--admin-brand)", flexShrink: 0 }}>{nameInitial}</Avatar>
        <div style={{ minWidth: 0 }}>
          <div className="admin-account-menu-name">{userName}</div>
          {userEmail && <div className="admin-account-menu-email">{userEmail}</div>}
        </div>
      </div>
      <div className="admin-account-menu-divider" />
      <button type="button" className="admin-account-menu-action" role="menuitem" onClick={() => { closeAccountMenus(); setCommandOpen(true); }}>
        <Search size={16} /> <span>Command palette</span>
      </button>
      <button type="button" className="admin-account-menu-action" role="menuitem" onClick={() => { closeAccountMenus(); void refreshBootstrap(); }}>
        <RefreshCcw size={16} /> <span>Refresh data</span>
      </button>
      <div className="admin-account-menu-divider" />
      <button type="button" className="admin-account-menu-action danger" role="menuitem" onClick={() => { clearAuthState(); window.location.href = "/login"; }}>
        <LogOut size={16} /> <span>Sign out</span>
      </button>
    </div>
  );

  const accountMenuPopover = (open: boolean, placement: "below" | "above" = "below") =>
    open ? <div className={`admin-account-menu-popover is-${placement}`}>{accountMenuContent}</div> : null;

  const sideMenu = (
    <Flex vertical style={{ height: "100%", minHeight: 0, minWidth: 0 }}>
      <div
        style={{
          padding: sidebarIsCollapsed ? "16px 0" : "16px 16px",
          textAlign: sidebarIsCollapsed ? "center" : "left",
          transition: "padding 0.2s, text-align 0.2s",
        }}
      >
        {sidebarIsCollapsed ? (
          <Tooltip title="Expand sidebar" placement="right">
            <Button
              type="text"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand sidebar"
              style={{ color: "var(--admin-muted)", width: "100%", height: 48, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            ><Flex align="center" gap={4}><BrandMark size={30} /><ChevronRight size={16} /></Flex></Button>
          </Tooltip>
        ) : (
          <Flex align="center" gap={8} justify={isDesktop ? "space-between" : "center"}>
            <Flex align="center" gap={8}>
              <BrandMark size={30} />
              <Typography.Text strong style={{ fontSize: 15 }}>Bunoraa</Typography.Text>
              <Typography.Text strong style={{ fontSize: 15 }}>
                Admin
              </Typography.Text>
            </Flex>
            {isDesktop && (
              <Button
                type="text"
                icon={<ChevronLeft size={16} />}
                onClick={() => setSidebarCollapsed(true)}
                style={{ color: "var(--admin-muted)", flexShrink: 0 }}
              />
            )}
          </Flex>
        )}
      </div>

      <div
        className="sidebar-scroll"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          paddingInline: sidebarIsCollapsed ? 4 : 10,
          transition: "padding 0.2s",
        }}
      >
        <Menu
          mode="inline"
          inlineCollapsed={sidebarIsCollapsed}
          selectedKeys={selectedNavKey ? [selectedNavKey] : []}
          items={navigationItems}
          onClick={handleMenuClick}
          style={{ borderInlineEnd: "none", background: "transparent" }}
        />
      </div>

      <div
        style={{
          borderTop: "1px solid var(--admin-border)",
          padding: sidebarIsCollapsed ? "12px 0" : "14px 16px",
          transition: "padding 0.2s",
        }}
      >
        {sidebarIsCollapsed ? (
          <div className="admin-account-menu-anchor is-above">
            <Button type="text" aria-label={`Open account menu for ${userName}`} aria-haspopup="menu" aria-expanded={sidebarAccountMenuOpen} onClick={() => {
              setSidebarCollapsed(false);
              onSidebarAccountMenuChange(!sidebarAccountMenuOpen);
            }} style={{ width: "100%", height: "auto", padding: "4px 0" }}>
              <Avatar
                size={32}
                shape="circle"
                style={{ background: "linear-gradient(135deg, var(--admin-brand), var(--admin-accent))" }}
              >
                {nameInitial}
              </Avatar>
            </Button>
            {accountMenuPopover(sidebarAccountMenuOpen, "above")}
          </div>
        ) : (
          <div className="admin-account-menu-anchor is-above">
            <Button
              type="text"
              block
              aria-label={`Open account menu for ${userName}`}
              aria-haspopup="menu"
              aria-expanded={sidebarAccountMenuOpen}
              onClick={() => onSidebarAccountMenuChange(!sidebarAccountMenuOpen)}
              style={{ height: "auto", padding: "4px 0", textAlign: "left" }}
            >
              <Flex align="center" gap={10} style={{ minWidth: 0, width: "100%" }}>
                <Avatar
                  size={36}
                  shape="circle"
                  style={{
                    background: "linear-gradient(135deg, var(--admin-brand), var(--admin-accent))",
                    flexShrink: 0,
                    lineHeight: "36px", fontSize: 15, fontWeight: 700,
                  }}
                >
                  {nameInitial}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
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
            </Button>
            {accountMenuPopover(sidebarAccountMenuOpen, "above")}
          </div>
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
            collapsed={sidebarIsCollapsed}
            onCollapse={(v) => isDesktop && setSidebarCollapsed(v)}
            trigger={null}
            style={{ background: "transparent", padding: sidebarIsCollapsed ? "16px 8px" : 16 }}
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

        <Layout className="admin-main-layout" style={{ background: "transparent", overflow: "hidden" }}>
          <Header
            className="admin-app-header"
            style={{
              padding: isDesktop ? "16px 24px 0 0" : "10px 14px 8px",
              background: "transparent",
              height: "auto",
              lineHeight: "inherit",
              flexShrink: 0,
              borderBottom: isMobile ? "1px solid var(--admin-divider)" : "none",
            }}
          >
            <Flex align="center" justify="space-between" gap={8}>
              <Flex align="center" gap={isMobile ? 8 : 14} style={{ minWidth: 0, flex: 1 }}>
                {isMobile && (
                  <Button
                    type="text"
                    icon={<MenuIcon size={20} />}
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open navigation"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, flexShrink: 0 }}
                  />
                )}
                {isMobile ? (
                  <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                    <BrandMark size={26} />
                    <Typography.Text strong className="admin-display">Bunoraa Admin</Typography.Text>
                  </Flex>
                ) : (
                  <span className="admin-header-context">{currentSection} <span>/</span> Workspace</span>
                )}
              </Flex>

              <Space size={isMobile ? 2 : 7} className="admin-header-actions">
                {!isMobile && (
                  <Button className="admin-command-trigger" icon={<Search size={15} />} onClick={() => setCommandOpen(true)}>
                    <span>Search pages</span><kbd><Command size={10} /> K</kbd>
                  </Button>
                )}
                <Tooltip title={
                  mode === "light" ? "Switch to dark mode" :
                  mode === "dark" ? "Switch to system theme" :
                  "Switch to light mode"
                }>
                  <Button
                    type="text"
                    icon={mode === "light" ? <Sun size={isMobile ? 16 : 18} /> : mode === "dark" ? <Moon size={isMobile ? 16 : 18} /> : <Monitor size={isMobile ? 16 : 18} />}
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                    className="admin-header-btn"
                    style={{ minWidth: isMobile ? 36 : 40, minHeight: isMobile ? 36 : 40 }}
                  />
                </Tooltip>
                <NotificationBell />
                <div className="admin-account-menu-anchor is-below">
                  <Button
                    type="text"
                    className="admin-header-btn admin-user-trigger"
                    aria-label={`Open account menu for ${userName}`}
                    aria-haspopup="menu"
                    aria-expanded={headerAccountMenuOpen}
                    onClick={() => onHeaderAccountMenuChange(!headerAccountMenuOpen)}
                    style={{ gap: 6, width: "auto", paddingInline: isMobile ? 4 : 8, minWidth: isMobile ? 36 : 40, minHeight: isMobile ? 36 : 40 }}
                  >
                    <Avatar
                      size={isMobile ? 24 : 26}
                      shape="circle"
                      style={{
                        background: "linear-gradient(135deg, var(--admin-brand), var(--admin-accent))",
                        lineHeight: isMobile ? "24px" : "26px", fontSize: isMobile ? 12 : 13, fontWeight: 700, flexShrink: 0,
                      }}
                    >
                      {nameInitial}
                    </Avatar>
                    {isDesktop && (
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--admin-ink-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {userName}
                      </span>
                    )}
                  </Button>
                  {accountMenuPopover(headerAccountMenuOpen, "below")}
                </div>
              </Space>
            </Flex>
          </Header>

          <Content
            className="admin-page-scroll"
            style={{
              padding: isDesktop ? "20px 24px 24px 0" : undefined,
              minWidth: 0,
              minHeight: 0,
              flex: "1 1 auto",
              overflow: "auto",
            }}
          >
            <div className="animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
              {isMobile ? <InstallAppBanner /> : null}
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
          onMore={() => setMobileNavOpen(true)}
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
