import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

const THEME_STORAGE_KEY = "sai_ajanta_admin_theme";

const THEME_CSS = `
/* Sai Ajantha Architectural Storefront Solid Theme for Medusa Admin */
:root {
  --sa-navy-primary: #102d4d;
  --sa-navy-dark: #0b1f35;
  --sa-navy-darker: #071320;
  --sa-blue-primary: #174b78;
  --sa-teal: #079d9a;
  --sa-teal-light: #24c6d0;
  --sa-teal-soft: #e5f7f6;
  --sa-bg-light: #f4f7fb;
  --sa-grey-blue: #eaf0f6;
  --sa-border-light: #cbd5e1;
  --sa-border-dark: #1e3a5f;
}

/* Light Theme Tokens */
html:not(.dark), body:not(.dark) {
  --theme-bg-page: #f4f7fb;
  --theme-bg-card: #ffffff;
  --theme-bg-elevated: #f8fafc;
  --theme-border: #cbd5e1;
  --theme-text-main: #102d4d;
  --theme-text-muted: #64748b;
  --theme-accent: #079d9a;
  --theme-accent-hover: #068280;
  --theme-header-bg: #ffffff;
  --theme-card-shadow: 0 1px 3px 0 rgba(16, 45, 77, 0.08);
}

/* Dark Theme Tokens */
html.dark, body.dark {
  --theme-bg-page: #071320;
  --theme-bg-card: #0b1f35;
  --theme-bg-elevated: #102d4d;
  --theme-border: #1e3a5f;
  --theme-text-main: #f8fafc;
  --theme-text-muted: #94a3b8;
  --theme-accent: #079d9a;
  --theme-accent-hover: #24c6d0;
  --theme-header-bg: #0b1f35;
  --theme-card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}

/* Custom Architectural Scrollbars (Solid Color - No Gradients) */
::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
::-webkit-scrollbar-track {
  background: var(--theme-bg-page);
}
::-webkit-scrollbar-thumb {
  background: #102d4d;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #079d9a;
}
.dark ::-webkit-scrollbar-thumb {
  background: #174b78;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: #24c6d0;
}

/* Solid Utility Classes */
.sa-glass-card {
  background-color: var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  box-shadow: var(--theme-card-shadow);
  border-radius: 0.75rem;
  transition: all 0.2s ease-in-out;
}

.sa-solid-primary {
  background-color: #102d4d;
  color: #ffffff;
}

.sa-solid-teal {
  background-color: #079d9a;
  color: #ffffff;
}

.sa-badge-teal {
  background-color: rgba(7, 157, 154, 0.12);
  color: #079d9a;
  border: 1px solid rgba(7, 157, 154, 0.25);
}

.dark .sa-badge-teal {
  background-color: rgba(36, 198, 208, 0.15);
  color: #24c6d0;
  border: 1px solid rgba(36, 198, 208, 0.3);
}

.sa-badge-navy {
  background-color: rgba(16, 45, 77, 0.1);
  color: #102d4d;
  border: 1px solid rgba(16, 45, 77, 0.2);
}

.dark .sa-badge-navy {
  background-color: rgba(23, 75, 120, 0.3);
  color: #94a3b8;
  border: 1px solid rgba(30, 58, 95, 0.6);
}

.sa-btn-teal {
  background-color: #079d9a;
  color: #ffffff;
  border: none;
  font-weight: 500;
  transition: background-color 0.15s ease;
}
.sa-btn-teal:hover {
  background-color: #068280;
}

/* =========================================================================
 * 1. SIDEBAR REORGANIZATION
 * ========================================================================= */

/* Pin Sai Ajantha EDMS menu to the very top of sidebar navigation (above search) */
aside nav [data-entry-id="nav:/sai-ajanta"],
aside nav div:has(> a[href="/sai-ajanta"]),
aside nav a[href="/sai-ajanta"] {
  order: -9999 !important;
}

/* Hide raw sidebar searchbar since it is now replaced in the topbar */
aside [data-entry-id="Searchbar"],
aside div:has(> button > div > p:first-child) {
  display: none !important;
}

/* Hide standalone Customers, Price Lists, and Promotions from top-level sidebar
   as they are now consolidated cleanly under the "Advanced" menu */
aside nav [data-entry-id="nav:/customers"],
aside nav div:has(> a[href="/customers"]),
aside nav [data-entry-id="nav:/promotions"],
aside nav div:has(> a[href="/promotions"]),
aside nav [data-entry-id="nav:/price-lists"],
aside nav div:has(> a[href="/price-lists"]) {
  display: none !important;
}

/* =========================================================================
 * 2. REMOVE BACKGROUND & BORDER SHADOW FROM ALL NAVIGATION ICONS
 * ========================================================================= */

/* Strip tile background box and border shadow from all sidebar navigation icons */
aside nav div.bg-ui-bg-base.shadow-borders-base,
aside nav [class*="size-6"] > div,
aside nav a div.bg-ui-bg-base,
aside nav a [class*="shadow-borders-base"],
aside a div.bg-ui-bg-base.shadow-borders-base,
aside a div.h-5.w-5.bg-ui-bg-base,
aside div.bg-ui-bg-base.shadow-borders-base,
aside [class*="shadow-borders-base"].bg-ui-bg-base,
aside div:has(> div > svg),
aside div:has(> svg),
aside a div:has(> div > svg),
aside a div:has(> svg),
[data-sidebar] div.bg-ui-bg-base.shadow-borders-base {
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  border: none !important;
}

/* Ensure the icon container allows the full icon to display cleanly */
aside nav [class*="size-6"] > div > div,
aside a [class*="overflow-hidden"].rounded-sm {
  overflow: visible !important;
  background: transparent !important;
  border-radius: 0 !important;
}

aside nav [class*="size-6"] svg,
aside a svg {
  background: transparent !important;
  background-color: transparent !important;
  color: currentColor !important;
}
`;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const applyTheme = useCallback((mode: ThemeMode) => {
    if (typeof window === "undefined") return;

    if (mode === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }

    let styleEl = document.getElementById("sai-ajanta-theme-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "sai-ajanta-theme-styles";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = THEME_CSS;
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // storage unavailable
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
