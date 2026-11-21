import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { App as AntdApp, Modal } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import React from "react";

export interface UnsavedChangesGuardOptions {
  /** True only when actual unsaved differences exist compared to initial values */
  isDirty: boolean;
  /** Optional callback executed right before discarding and leaving */
  onDiscard?: () => void;
  /** Set false to disable route blocking (e.g., while modal is closed) */
  enabled?: boolean;
}

export interface UnsavedChangesGuardResult {
  /**
   * Use for Cancel buttons, Modal onCancel, Drawer onClose, or in-page tab switches.
   * Shows the standard AntD Unsaved Changes modal only when isDirty is true.
   */
  confirmLeave: (proceedAction: () => void) => void;
  /**
   * Call immediately after a successful API save so programmatic navigate()
   * does not trigger a false Unsaved Changes warning.
   */
  allowNextNavigation: () => void;
  /** Clear any temporary bypass flag (call when opening/resetting a fresh form) */
  resetBypass: () => void;
}

/**
 * Reusable Unsaved Changes Guard across Sai Ajantha Admin Portal (FORM-02 / FORM-03).
 *
 * - Blocks React Router transitions (sidebar, breadcrumb, back/forward, internal links)
 *   when actual unsaved changes exist.
 * - Shows a single consistent Ant Design Modal.confirm dialog:
 *   Title:   "Unsaved Changes"
 *   Message: "You have unsaved changes. Do you want to leave this page?"
 *   Buttons: "Stay Here" | "Leave Without Saving"
 * - Registers native `beforeunload` confirmation for tab close / browser refresh.
 * - Prevents duplicate confirmation modals and clears cleanly after save or discard.
 */
export function useUnsavedChangesGuard({
  isDirty,
  onDiscard,
  enabled = true,
}: UnsavedChangesGuardOptions): UnsavedChangesGuardResult {
  const { modal } = AntdApp.useApp();
  const bypassRef = useRef(false);
  const dialogOpenRef = useRef(false);
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Reset bypass whenever dirty state becomes true again on subsequent edits
  useEffect(() => {
    if (isDirty) {
      bypassRef.current = false;
    }
  }, [isDirty]);

  const openConfirmModal = useCallback(
    (onStay: () => void, onLeave: () => void) => {
      if (dialogOpenRef.current) return;
      dialogOpenRef.current = true;

      const confirmFn = modal?.confirm ?? Modal.confirm;
      confirmFn({
        title: "Unsaved Changes",
        icon: React.createElement(ExclamationCircleFilled, {
          style: { color: "#D97706" },
        }),
        content: "You have unsaved changes. Do you want to leave this page?",
        okText: "Leave Without Saving",
        cancelText: "Stay Here",
        okButtonProps: { danger: true },
        centered: true,
        maskClosable: false,
        keyboard: true,
        onOk: () => {
          dialogOpenRef.current = false;
          bypassRef.current = true;
          onDiscardRef.current?.();
          onLeave();
        },
        onCancel: () => {
          dialogOpenRef.current = false;
          onStay();
        },
      });
    },
    [modal]
  );

  // React Router v6 navigation blocker (sidebar, breadcrumbs, browser Back/Forward, links)
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string; search: string }; nextLocation: { pathname: string; search: string } }) => {
        if (!enabled || !isDirtyRef.current || bypassRef.current) {
          return false;
        }
        return (
          currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search
        );
      },
      [enabled]
    )
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      openConfirmModal(
        () => blocker.reset(),
        () => blocker.proceed()
      );
    }
  }, [blocker, openConfirmModal]);

  // Native browser refresh / tab close warning
  useEffect(() => {
    if (!enabled || !isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassRef.current || !isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, isDirty]);

  const confirmLeave = useCallback(
    (proceedAction: () => void) => {
      if (!isDirtyRef.current || bypassRef.current) {
        proceedAction();
        return;
      }
      openConfirmModal(
        () => {
          /* Stay Here: preserve form state */
        },
        () => {
          proceedAction();
        }
      );
    },
    [openConfirmModal]
  );

  const allowNextNavigation = useCallback(() => {
    bypassRef.current = true;
  }, []);

  const resetBypass = useCallback(() => {
    bypassRef.current = false;
  }, []);

  return {
    confirmLeave,
    allowNextNavigation,
    resetBypass,
  };
}
