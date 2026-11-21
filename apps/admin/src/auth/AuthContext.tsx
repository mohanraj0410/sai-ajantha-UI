import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  fetchCurrentStaffProfile,
  getStoredAdminToken,
  getStoredStaffProfile,
  loginStaff,
  logoutStaff,
  StaffPermission,
  StaffProfile,
} from "../api/adminClient";
import { adminQueryClient } from "../api/adminQueries";

interface AuthContextValue {
  staff: StaffProfile | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  hasPermission: (perm?: StaffPermission) => boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<StaffProfile>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staff, setStaff] = useState<StaffProfile | null>(() =>
    getStoredAdminToken() ? getStoredStaffProfile() : null
  );
  const [authLoading, setAuthLoading] = useState<boolean>(() =>
    Boolean(getStoredAdminToken())
  );
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("sai_ajanta_admin_theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem("sai_ajanta_admin_theme", next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const token = getStoredAdminToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    const stored = getStoredStaffProfile();
    fetchCurrentStaffProfile(stored?.email || "admin@sai-ajanta.com")
      .then((profile) => setStaff(profile))
      .catch(() => setStaff(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setStaff(null);
      adminQueryClient.clear();
    };
    const onLogout = () => {
      setStaff(null);
      adminQueryClient.clear();
    };
    window.addEventListener("admin:unauthorized", onUnauthorized);
    window.addEventListener("admin:logout", onLogout);
    return () => {
      window.removeEventListener("admin:unauthorized", onUnauthorized);
      window.removeEventListener("admin:logout", onLogout);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember = true) => {
    const profile = await loginStaff(email, password, remember);
    setStaff(profile);
    return profile;
  }, []);

  const signOut = useCallback(() => {
    logoutStaff();
    setStaff(null);
    adminQueryClient.clear();
  }, []);

  const hasPermission = useCallback(
    (perm?: StaffPermission) => {
      if (!staff) return false;
      if (!perm || staff.isFullAdmin) return true;
      return staff.permissions.includes(perm);
    },
    [staff]
  );

  return (
    <AuthContext.Provider
      value={{
        staff,
        isAuthenticated: Boolean(staff),
        authLoading,
        themeMode,
        toggleTheme,
        hasPermission,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
