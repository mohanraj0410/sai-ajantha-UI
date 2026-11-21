import { useState, useEffect } from "react";
import { defineWidgetConfig } from "@medusajs/admin-sdk";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "sai_ajanta_admin_theme";

const NAV_ICON_STYLES = `
  /* Remove tile background box and border shadow from all sidebar navigation icons */
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

const TopbarSearchWidget = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const styleId = "sai-ajanta-nav-styles";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = NAV_ICON_STYLES;
      document.head.appendChild(styleEl);
    }

    const onExternalTheme = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail && (customEvent.detail === "dark" || customEvent.detail === "light")) {
        setTheme(customEvent.detail);
      }
    };
    window.addEventListener("sai-ajanta-theme-change", onExternalTheme);
    return () => window.removeEventListener("sai-ajanta-theme-change", onExternalTheme);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }

    window.dispatchEvent(
      new CustomEvent<ThemeMode>("sai-ajanta-theme-change", { detail: nextTheme })
    );
  };

  const handleRefresh = (e: React.MouseEvent) => {
    setRefreshing(true);
    // Dispatch refresh event to all active views
    window.dispatchEvent(new CustomEvent("sai-ajanta-refresh"));

    // If shift key held, perform a full hard reload
    if (e.shiftKey) {
      window.location.reload();
      return;
    }

    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const handleOpenSearch = () => {
    const nativeBtn = Array.from(document.querySelectorAll("aside button")).find(
      (btn) => btn.textContent?.includes("Search") || btn.textContent?.includes("⌘K")
    ) as HTMLButtonElement | undefined;

    if (nativeBtn) {
      nativeBtn.click();
      return;
    }

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        keyCode: 75,
        which: 75,
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <style dangerouslySetInnerHTML={{ __html: NAV_ICON_STYLES }} />
      {/* 1. Topbar Search Button */}
      <button
        type="button"
        onClick={handleOpenSearch}
        className="flex h-8 items-center gap-x-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-2.5 text-ui-fg-subtle hover:border-[#079d9a] hover:bg-ui-bg-base hover:text-ui-fg-base transition-all duration-150"
        title="Search catalog, orders, and customers (Cmd+K / Ctrl+K)"
      >
        <svg
          className="h-3.5 w-3.5 text-ui-fg-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline text-xs font-medium">Search...</span>
        <kbd className="hidden sm:inline rounded border border-ui-border-base bg-ui-bg-base px-1.5 py-0.5 text-[10px] font-mono text-ui-fg-muted">
          ⌘K
        </kbd>
      </button>

      {/* 2. Global Topbar Refresh Button */}
      <button
        type="button"
        onClick={handleRefresh}
        className="flex h-8 items-center gap-x-1.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-2.5 text-ui-fg-subtle hover:border-[#079d9a] hover:bg-ui-bg-base hover:text-ui-fg-base transition-all duration-150"
        title="Refresh data across active views (Shift+Click to hard reload)"
      >
        <svg
          className={`h-3.5 w-3.5 text-ui-fg-muted transition-transform duration-500 ${
            refreshing ? "animate-spin text-[#079d9a]" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6" />
          <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" />
        </svg>
        <span className="hidden sm:inline text-xs font-medium">Refresh</span>
      </button>

      {/* 3. Global Topbar Theme Switcher Button */}
      <button
        type="button"
        onClick={handleToggleTheme}
        className="flex h-8 items-center gap-x-1.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-2.5 text-ui-fg-subtle hover:border-[#079d9a] hover:bg-ui-bg-base hover:text-ui-fg-base transition-all duration-150"
        title={`Switch to ${theme === "dark" ? "Light" : "Dark"} theme mode`}
      >
        {theme === "dark" ? (
          <>
            <svg
              className="h-3.5 w-3.5 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
            <span className="hidden sm:inline text-xs font-medium">Light</span>
          </>
        ) : (
          <>
            <svg
              className="h-3.5 w-3.5 text-[#102d4d]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
            <span className="hidden sm:inline text-xs font-medium">Dark</span>
          </>
        )}
      </button>
    </div>
  );
};

export const config = defineWidgetConfig({
  zone: "topbar",
});

export default TopbarSearchWidget;
