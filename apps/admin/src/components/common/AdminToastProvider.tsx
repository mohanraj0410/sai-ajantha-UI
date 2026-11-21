import React, { createContext, useCallback, useContext } from "react";
import { App as AntdApp } from "antd";

export type ToastSeverity = "success" | "error" | "warning" | "info";

interface ToastContextValue {
  showToast: (message: string, severity?: ToastSeverity) => void;
  notify: (message: string, severity?: ToastSeverity) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const InnerToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notification } = AntdApp.useApp();

  const showToast = useCallback(
    (msg: string, severity: ToastSeverity = "info") => {
      const titles: Record<ToastSeverity, string> = {
        success: "Success",
        error: "Action Failed",
        warning: "Notice",
        info: "Information",
      };
      notification[severity]({
        message: titles[severity],
        description: msg,
        placement: "topRight",
        duration: severity === "error" ? 5 : 3.5,
      });
    },
    [notification]
  );

  return (
    <ToastContext.Provider value={{ showToast, notify: showToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const AdminToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AntdApp>
      <InnerToastProvider>{children}</InnerToastProvider>
    </AntdApp>
  );
};

export function useAdminToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useAdminToast must be used within AdminToastProvider");
  }
  return ctx;
}
