import React, { Suspense, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  App as AntdApp,
  Avatar,
  Badge,
  Alert,
  Button,
  Drawer,
  Dropdown,
  Flex,
  Grid,
  Layout,
  Menu,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import {
  BulbOutlined,
  ExclamationCircleOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { usePortalData, useTradeQuotes } from "../api/adminQueries";
import {
  computeActionQueueMetrics,
  getSidebarActionBadge,
} from "../utils/actionQueueCounts";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ROUTES,
  resolveRouteKey,
} from "../routes/routeRegistry";
import { AdminPathBreadcrumb, getSectionIcon } from "../components/common/AdminPathBreadcrumb";
import { AdminLoadingState } from "../components/common/AdminStateView";
import { BRAND_TOKENS } from "../theme/antdTheme";
import businessLogo from "../../assets/logo.png";
import faviconLogo from "../../assets/favicon.png";

const { Sider, Header, Content } = Layout;
const { useBreakpoint } = Grid;

const SIDER_EXPANDED = 256;
const SIDER_COLLAPSED = 72;

export const AdminAppLayout: React.FC = () => {
  const { staff, hasPermission, signOut, themeMode, toggleTheme } = useAuth();
  const { modal } = AntdApp.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const screens = useBreakpoint();
  const { token } = theme.useToken();

  const isDesktop = Boolean(screens.lg);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const actorKey = staff?.email || "anon";
  const portal = usePortalData(actorKey, Boolean(staff));
  const quotesQuery = useTradeQuotes(
    actorKey,
    Boolean(staff) && hasPermission("ENQUIRIES_MANAGE")
  );

  const actionMetrics = useMemo(
    () => computeActionQueueMetrics(portal.data, quotesQuery.data?.quotes),
    [portal.data, quotesQuery.data?.quotes]
  );

  const visibleRoutes = useMemo(
    () => ADMIN_NAV_ROUTES.filter((r) => hasPermission(r.permission)),
    [hasPermission]
  );

  const selectedKey = resolveRouteKey(location.pathname);

  const buildMenuItems = (isCollapsedMode: boolean): MenuProps["items"] => {
    return ADMIN_NAV_GROUPS.map((groupName) => {
      const items = visibleRoutes.filter((r) => r.group === groupName);
      if (!items.length) return null;
      return {
        type: "group" as const,
        key: `grp-${groupName}`,
        label: isCollapsedMode ? "" : groupName,
        children: items.map((item) => {
          const ready = item.path === "/quotes" ? quotesQuery.data && !quotesQuery.isError : portal.data && !portal.isError;
          const badge = ready ? getSidebarActionBadge(item.path, actionMetrics) : null;
          const rawIcon = getSectionIcon(item.iconKey);
          const tooltipText = badge ? `${item.label}: ${badge.count} ${badge.label}` : item.label;

          const countBadgeNode = badge ? (
            <Tooltip title={tooltipText} placement="right" mouseEnterDelay={0.15}>
              <span
                className={`sa-nav-count sa-nav-count--${badge.tone}`}
                data-testid={`sidebar-count-${item.path.replace(/^\//, "")}`}
                aria-label={`${badge.count} ${badge.label}`}
              >
                {badge.count > 99 ? "99+" : badge.count}
              </span>
            </Tooltip>
          ) : null;

          const iconNode = (
            <span className="sa-sider-icon">
              {isCollapsedMode && badge && badge.count > 0 ? (
                <Badge
                  dot
                  size="small"
                  color={
                    badge.tone === "error"
                      ? "#EF4444"
                      : badge.tone === "warning"
                      ? "#F59E0B"
                      : BRAND_TOKENS.cyan
                  }
                  offset={[0, 1]}
                  style={{ boxShadow: "0 0 0 1.5px #0B1F35" }}
                >
                  {rawIcon}
                </Badge>
              ) : (
                rawIcon
              )}
            </span>
          );

          // Ant Design uses the collapsed label for its tooltip when no native title is set.
          const labelNode = isCollapsedMode ? (
            tooltipText
          ) : badge ? (
            <span className="sa-nav-item-row">
              <span className="sa-nav-item-text">{item.label}</span>
              {countBadgeNode}
            </span>
          ) : (
            item.label
          );

          return {
            key: item.path,
            icon: iconNode,
            label: labelNode,
            "aria-label": isCollapsedMode ? tooltipText : undefined,
          };
        }),
      };
    }).filter(Boolean) as MenuProps["items"];
  };

  const desktopMenuItems = useMemo(
    () => buildMenuItems(collapsed && isDesktop),
    [visibleRoutes, collapsed, isDesktop, actionMetrics, hasPermission, portal.data, portal.isError, quotesQuery.data, quotesQuery.isError]
  );

  const drawerMenuItems = useMemo(
    () => buildMenuItems(false),
    [visibleRoutes, actionMetrics, hasPermission, portal.data, portal.isError, quotesQuery.data, quotesQuery.isError]
  );

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(key);
    setMobileOpen(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  const staffName =
    [staff?.firstName, staff?.lastName].filter(Boolean).join(" ").trim() ||
    staff?.email?.split("@")[0] ||
    "Admin";

  const roleLabel = staff?.isFullAdmin
    ? "Super Admin"
    : (staff?.role || "Staff").replace(/_/g, " ");

  const accountMenuItems: MenuProps["items"] = [
    {
      key: "profile-info",
      disabled: true,
      label: (
        <div style={{ padding: "2px 2px" }}>
          <Typography.Text strong style={{ display: "block", fontSize: 13 }}>
            {staffName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            {staff?.email}
          </Typography.Text>
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "theme",
      icon: themeMode === "light" ? <MoonOutlined /> : <BulbOutlined />,
      label: themeMode === "light" ? "Dark Mode" : "Light Mode",
      onClick: toggleTheme,
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
      disabled: !hasPermission("SETTINGS_MANAGE"),
      onClick: () => navigate("/settings"),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Sign Out",
      danger: true,
      onClick: () => {
        modal.confirm({
          title: "Confirm Sign Out",
          icon: <ExclamationCircleOutlined style={{ color: "#EF4444" }} />,
          content: "Are you sure you want to sign out of the Sai Ajantha Admin Portal?",
          okText: "Yes, Sign Out",
          okButtonProps: { danger: true },
          cancelText: "Cancel",
          centered: true,
          maskClosable: true,
          onOk() {
            signOut();
            navigate("/login", { replace: true });
          },
        });
      },
    },
  ];

  const renderBrandHeader = (isCollapsed: boolean) => (
    <div
      data-testid="sidebar-brand-header"
      className="sa-admin-sider-header"
      onClick={() => {
        navigate("/dashboard");
        setMobileOpen(false);
      }}
      role="button"
      tabIndex={0}
      title="Sai Ajantha Admin Portal"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          navigate("/dashboard");
          setMobileOpen(false);
        }
      }}
      style={{
        height: 64,
        padding: isCollapsed ? "0 8px" : "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        background: BRAND_TOKENS.navyDeep,
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 8,
          padding: isCollapsed ? "6px" : "5px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
          transition: "all 0.2s ease",
        }}
      >
        {isCollapsed ? (
          <Tooltip title="Sai Ajantha Admin Portal" placement="right">
            <img
              src={faviconLogo}
              alt="Sai Ajantha Favicon"
              style={{
                height: 26,
                width: 26,
                objectFit: "contain",
                display: "block",
              }}
            />
          </Tooltip>
        ) : (
          <img
            src={businessLogo}
            alt="Sai Ajantha"
            style={{
              height: 28,
              width: "auto",
              maxWidth: 178,
              objectFit: "contain",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );

  const siderWidth = collapsed ? SIDER_COLLAPSED : SIDER_EXPANDED;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      {isDesktop && (
        <Sider
          className="sa-admin-sider"
          width={SIDER_EXPANDED}
          collapsedWidth={SIDER_COLLAPSED}
          collapsed={collapsed}
          trigger={null}
          style={{
            background: BRAND_TOKENS.navy,
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            overflow: "hidden",
            boxShadow: "2px 0 10px rgba(11, 31, 53, 0.14)",
          }}
        >
          {renderBrandHeader(collapsed)}
          <nav
            className="sa-admin-sider-scroll"
            aria-label="Admin navigation"
            tabIndex={0}
          >
            <Menu
              theme="dark"
              mode="inline"
              inlineCollapsed={collapsed}
              selectedKeys={[selectedKey]}
              items={desktopMenuItems}
              onClick={handleMenuClick}
              style={{ background: "transparent", borderInlineEnd: "none" }}
            />
          </nav>
        </Sider>
      )}

      {/* Mobile / Tablet Navigation Drawer */}
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={280}
        closable={false}
        styles={{
          body: { padding: 0, overflow: "hidden", background: BRAND_TOKENS.navy },
        }}
      >
        <div className="sa-admin-sider sa-mobile-sider">
          {renderBrandHeader(false)}
          <nav
            className="sa-admin-sider-scroll"
            aria-label="Admin navigation"
            tabIndex={0}
          >
            <Menu
              theme="dark"
              mode="inline"
              inlineCollapsed={false}
              selectedKeys={[selectedKey]}
              items={drawerMenuItems}
              onClick={handleMenuClick}
              style={{ background: "transparent", borderInlineEnd: "none" }}
            />
          </nav>
        </div>
      </Drawer>

      {/* Main Content Area */}
      <Layout
        style={{
          marginLeft: isDesktop ? siderWidth : 0,
          transition: "margin-left 0.18s ease",
          minHeight: "100vh",
          minWidth: 0,
        }}
      >
        <Header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 90,
            height: 58,
            padding: screens.sm ? "0 20px" : "0 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: "0 1px 3px rgba(11, 31, 53, 0.04)",
          }}
        >
          {/* Left: Collapse Toggle + Unique Route-Driven Breadcrumb */}
          <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
            <Button
              type="text"
              aria-label={isDesktop ? "Toggle sidebar" : "Open menu"}
              icon={
                isDesktop ? (
                  collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
                ) : (
                  <MenuOutlined />
                )
              }
              onClick={() => (isDesktop ? setCollapsed((c) => !c) : setMobileOpen(true))}
              style={{
                fontSize: 16,
                width: isDesktop ? 34 : 44,
                height: isDesktop ? 34 : 44,
                flexShrink: 0,
              }}
            />
            <AdminPathBreadcrumb />
          </Flex>

          {/* Right: Quick Module Jump + Refresh + Theme + Account */}
          <Space size={screens.sm ? 8 : 4} align="center" style={{ flexShrink: 0 }}>
            {screens.xl && (
              <Select
                showSearch
                value={null}
                placeholder="Jump to page..."
                suffixIcon={<SearchOutlined style={{ color: "#94A3B8" }} />}
                style={{ width: 185 }}
                size="middle"
                optionFilterProp="label"
                onSelect={(val) => {
                  if (typeof val === "string") navigate(val);
                }}
                options={visibleRoutes.map((r) => ({
                  label: r.label,
                  value: r.path,
                }))}
              />
            )}

            <Tooltip title="Refresh data">
              <Button
                type="text"
                shape="circle"
                aria-label="Refresh data"
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={() => void handleRefresh()}
              />
            </Tooltip>

            {screens.sm && (
              <Tooltip title={themeMode === "light" ? "Dark Mode" : "Light Mode"}>
                <Button
                  type="text"
                  shape="circle"
                  aria-label="Toggle theme"
                  icon={themeMode === "light" ? <MoonOutlined /> : <BulbOutlined />}
                  onClick={toggleTheme}
                />
              </Tooltip>
            )}

            <Dropdown menu={{ items: accountMenuItems }} trigger={["click"]} placement="bottomRight">
              <Button
                type="text"
                style={{
                  height: 38,
                  padding: screens.sm ? "3px 8px 3px 5px" : "3px",
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Avatar
                  size={29}
                  icon={<UserOutlined />}
                  style={{
                    background: BRAND_TOKENS.teal,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {staffName.charAt(0).toUpperCase()}
                </Avatar>
                {screens.md && (
                  <div style={{ textAlign: "left", lineHeight: 1.15 }}>
                    <Typography.Text strong style={{ fontSize: 12.5, display: "block" }}>
                      {staffName}
                    </Typography.Text>
                    <Tag
                      color="cyan"
                      style={{
                        margin: 0,
                        fontSize: 9.5,
                        lineHeight: "14px",
                        padding: "0 5px",
                        fontWeight: 600,
                      }}
                    >
                      {roleLabel}
                    </Tag>
                  </div>
                )}
              </Button>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            padding: screens.lg ? "16px 22px 28px" : screens.sm ? "14px 16px 24px" : "12px 10px 20px",
            width: "100%",
            maxWidth: 1680,
            margin: "0 auto",
            minWidth: 0,
          }}
        >
          {(portal.isError || quotesQuery.isError) && <Alert type="error" showIcon message="Some admin counts could not be refreshed."
            action={<Button size="small" onClick={() => { if (portal.isError) void portal.refetch(); if (quotesQuery.isError) void quotesQuery.refetch(); }}>Retry</Button>} style={{ marginBottom: 12 }} />}
          <Suspense fallback={<AdminLoadingState title="Loading section..." rows={5} />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
};
