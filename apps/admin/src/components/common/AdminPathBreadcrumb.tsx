import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Breadcrumb, Dropdown, Flex, Grid, Typography, theme } from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DollarOutlined,
  EllipsisOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  RightOutlined,
  RollbackOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import {
  resolveBreadcrumbTrail,
  resolveDocumentTitle,
  type AdminNavRouteItem,
} from "../../routes/routeRegistry";
import { BRAND_TOKENS } from "../../theme/antdTheme";

const { useBreakpoint } = Grid;

export function getSectionIcon(k: AdminNavRouteItem["iconKey"]) {
  switch (k) {
    case "dashboard":
      return <DashboardOutlined />;
    case "products":
      return <AppstoreOutlined />;
    case "categories":
      return <DatabaseOutlined />;
    case "import":
      return <CloudUploadOutlined />;
    case "inventory":
      return <DatabaseOutlined />;
    case "orders":
      return <ShoppingCartOutlined />;
    case "quotes":
      return <FileTextOutlined />;
    case "enquiries":
      return <CustomerServiceOutlined />;
    case "customers":
      return <TeamOutlined />;
    case "dealers":
      return <ShopOutlined />;
    case "distributors":
      return <TruckOutlined />;
    case "pricing":
      return <DollarOutlined />;
    case "coverage":
      return <EnvironmentOutlined />;
    case "returns":
      return <RollbackOutlined />;
    case "reports":
      return <BarChartOutlined />;
    case "settings":
      return <SettingOutlined />;
  }
}

export const AdminPathBreadcrumb: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { token } = theme.useToken();
  const isMobile = !screens.sm;

  const { iconKey, trail } = resolveBreadcrumbTrail(location.pathname);

  useEffect(() => {
    document.title = resolveDocumentTitle(location.pathname);
  }, [location.pathname]);

  const items = React.useMemo(() => {
    // On narrow mobile screens, collapse intermediate ancestors cleanly into a dropdown menu
    if (isMobile && trail.length > 2) {
      const first = trail[0];
      const middle = trail.slice(1, -1);
      const last = trail[trail.length - 1];

      const menuItems: MenuProps["items"] = middle.map((m, idx) => ({
        key: String(idx),
        label: m.label,
        onClick: () => m.to && navigate(m.to),
      }));

      return [
        {
          title: first.to ? (
            <Link to={first.to} className="sa-crumb-link" style={{ color: token.colorTextSecondary }}>
              {first.label}
            </Link>
          ) : (
            first.label
          ),
        },
        {
          title: (
            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <button
                type="button"
                aria-label="Show parent pages"
                className="sa-crumb-link"
                style={{
                  cursor: "pointer",
                  color: token.colorTextSecondary,
                  background: "transparent",
                  border: "none",
                  minWidth: 28,
                  minHeight: 28,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "inherit",
                }}
              >
                <EllipsisOutlined />
              </button>
            </Dropdown>
          ),
        },
        {
          title: (
            <Typography.Text
              strong
              aria-current="page"
              style={{ color: token.colorText, fontSize: 13.5 }}
            >
              {last.label}
            </Typography.Text>
          ),
        },
      ];
    }

    return trail.map((node, index) => {
      const isCurrent = index === trail.length - 1;
      if (isCurrent || !node.to) {
        return {
          title: (
            <Typography.Text
              strong
              aria-current="page"
              style={{
                color: token.colorText,
                fontSize: isMobile ? 13.5 : 14,
              }}
            >
              {node.label}
            </Typography.Text>
          ),
        };
      }
      return {
        title: (
          <Link
            to={node.to}
            className="sa-crumb-link"
            style={{ color: token.colorTextSecondary, fontSize: 13, fontWeight: 500 }}
          >
            {node.label}
          </Link>
        ),
      };
    });
  }, [trail, isMobile, navigate, token.colorText, token.colorTextSecondary]);

  return (
    <Flex align="center" gap={10} style={{ minWidth: 0 }}>
      <div
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${BRAND_TOKENS.teal}18`,
          color: BRAND_TOKENS.teal,
          border: `1px solid ${BRAND_TOKENS.teal}30`,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {getSectionIcon(iconKey)}
      </div>
      <nav aria-label="Breadcrumb" style={{ minWidth: 0, overflow: "hidden" }}>
        <Breadcrumb
          separator={<RightOutlined style={{ fontSize: 9, color: "#94A3B8" }} />}
          items={items}
          style={{ whiteSpace: "nowrap" }}
        />
      </nav>
    </Flex>
  );
};
