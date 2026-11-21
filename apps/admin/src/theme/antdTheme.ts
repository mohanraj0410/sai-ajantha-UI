import { theme as antdTheme, type ThemeConfig } from "antd";

export const BRAND_TOKENS = {
  navy: "#0B1F35",
  navyHover: "#132E4D",
  navyDeep: "#071525",
  teal: "#079D9A",
  tealHover: "#06827F",
  tealSoft: "#E6F7F6",
  cyan: "#24C6D0",
  canvasLight: "#F4F6F9",
  surfaceLight: "#FFFFFF",
  borderLight: "#E5ECF3",
  textPrimaryLight: "#102A43",
  textBodyLight: "#344256",
  textMutedLight: "#64748B",
  canvasDark: "#0B1522",
  surfaceDark: "#122134",
  borderDark: "#22364E",
} as const;

export function buildAntdTheme(mode: "light" | "dark"): ThemeConfig {
  const isDark = mode === "dark";

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: BRAND_TOKENS.teal,
      colorInfo: BRAND_TOKENS.teal,
      colorSuccess: "#16A34A",
      colorWarning: "#D97706",
      colorError: "#DC2626",
      colorBgLayout: isDark ? BRAND_TOKENS.canvasDark : BRAND_TOKENS.canvasLight,
      colorBgContainer: isDark ? BRAND_TOKENS.surfaceDark : BRAND_TOKENS.surfaceLight,
      colorBgElevated: isDark ? "#182B42" : "#FFFFFF",
      colorBorderSecondary: isDark ? BRAND_TOKENS.borderDark : BRAND_TOKENS.borderLight,
      colorBorder: isDark ? "#2C435E" : "#D6E0EA",
      colorText: isDark ? "#F1F5F9" : BRAND_TOKENS.textPrimaryLight,
      colorTextSecondary: isDark ? "#94A3B8" : BRAND_TOKENS.textMutedLight,
      fontFamily:
        "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13.5,
      borderRadius: 9,
      borderRadiusLG: 12,
      borderRadiusSM: 7,
      controlHeight: 36,
      controlHeightLG: 40,
      controlHeightSM: 30,
      motionDurationFast: "0.12s",
      motionDurationMid: "0.18s",
      motionDurationSlow: "0.22s",
      boxShadowTertiary: isDark
        ? "0 2px 10px rgba(0, 0, 0, 0.32)"
        : "0 1px 2px rgba(11, 31, 53, 0.04), 0 3px 10px rgba(11, 31, 53, 0.03)",
    },
    components: {
      Layout: {
        headerBg: isDark ? BRAND_TOKENS.surfaceDark : "#FFFFFF",
        headerHeight: 58,
        headerPadding: "0 20px",
        siderBg: BRAND_TOKENS.navy,
        bodyBg: isDark ? BRAND_TOKENS.canvasDark : BRAND_TOKENS.canvasLight,
      },
      Menu: {
        darkItemBg: BRAND_TOKENS.navy,
        darkSubMenuItemBg: BRAND_TOKENS.navyDeep,
        darkItemSelectedBg: "rgba(7, 157, 154, 0.24)",
        darkItemSelectedColor: "#FFFFFF",
        darkItemHoverBg: "rgba(255, 255, 255, 0.08)",
        darkItemColor: "rgba(226, 232, 240, 0.86)",
        darkGroupTitleColor: "rgba(148, 163, 184, 0.68)",
        itemBorderRadius: 8,
        itemHeight: 34,
        itemMarginInline: 8,
        itemMarginBlock: 2,
      },
      Card: {
        paddingLG: 16,
        headerFontSize: 14.5,
        headerHeight: 46,
        borderRadiusLG: 12,
      },
      Table: {
        headerBg: isDark ? "#172A42" : "#F8FAFC",
        headerColor: isDark ? "#CBD5E1" : "#344256",
        headerSplitColor: isDark ? BRAND_TOKENS.borderDark : "#E5ECF3",
        rowHoverBg: isDark ? "rgba(7, 157, 154, 0.1)" : "#F2FBFA",
        borderColor: isDark ? BRAND_TOKENS.borderDark : "#EDF2F7",
        cellPaddingBlock: 10,
        cellPaddingInline: 12,
        headerBorderRadius: 8,
      },
      Button: {
        fontWeight: 600,
        borderRadius: 8,
        primaryShadow: "0 2px 5px rgba(7, 157, 154, 0.22)",
      },
      Input: {
        borderRadius: 8,
        activeShadow: "0 0 0 2px rgba(7, 157, 154, 0.16)",
      },
      Select: {
        borderRadius: 8,
      },
      Tag: {
        borderRadiusSM: 6,
      },
      Tabs: {
        inkBarColor: BRAND_TOKENS.teal,
        itemSelectedColor: BRAND_TOKENS.teal,
        itemHoverColor: BRAND_TOKENS.teal,
        titleFontSize: 13.5,
        horizontalMargin: "0 0 12px 0",
      },
      Steps: {
        colorPrimary: BRAND_TOKENS.teal,
      },
    },
  };
}
