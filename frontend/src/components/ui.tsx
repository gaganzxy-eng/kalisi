"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { CheckCircle, XCircle, AlertTriangle, X, Info } from "lucide-react";

// ── Toast System ────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (a: string, b?: ToastType | string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (a: string, b?: ToastType | string, duration = 4000) => {
      let type: ToastType = "info";
      let message = a;

      if (["success", "error", "warning", "info"].includes(a)) {
        type = a as ToastType;
        message = (b as string) || "";
      } else if (b && ["success", "error", "warning", "info"].includes(b)) {
        type = b as ToastType;
        message = a;
      }

      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[400px]" style={{ bottom: "1.5rem", right: "1.5rem" }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type} flex items-center gap-3`}
            style={{ position: "relative" }}
          >
            {icons[toast.type]}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Confirmation Dialog ─────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h3>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────

export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: width || "100%", height: height || "1rem" }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <Skeleton height="0.75rem" width="40%" className="mb-3" />
      <Skeleton height="2rem" width="60%" className="mb-2" />
      <Skeleton height="0.625rem" width="80%" />
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div
          className="mb-4 p-4 rounded-full"
          style={{ background: "var(--color-bg-tertiary)" }}
        >
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm max-w-md" style={{ color: "var(--color-text-muted)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Error State ─────────────────────────────────────────

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div
        className="mb-4 p-4 rounded-full"
        style={{ background: "rgba(239, 68, 68, 0.15)" }}
      >
        <XCircle size={32} color="#ef4444" />
      </div>
      <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      {message && (
        <p className="text-sm max-w-md mb-4" style={{ color: "var(--color-text-muted)" }}>
          {message}
        </p>
      )}
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

// ── Status Indicator ────────────────────────────────────

export function StatusIndicator({
  status,
  label,
  size = "sm",
}: {
  status: "online" | "offline" | "warning" | "unknown";
  label?: string;
  size?: "sm" | "md";
}) {
  const dotSize = size === "md" ? "10px" : "8px";
  const statusClass = {
    online: "status-online",
    offline: "status-offline",
    warning: "status-warning",
    unknown: "",
  }[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`status-dot ${statusClass}`}
        style={{ width: dotSize, height: dotSize }}
      />
      {label && (
        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────

export function Badge({
  variant = "info",
  children,
}: {
  variant?: "success" | "danger" | "warning" | "info" | "primary" | "neutral" | "error";
  children: ReactNode;
}) {
  const norm =
    variant === "error"
      ? "danger"
      : variant === "primary"
      ? "info"
      : variant === "neutral"
      ? "info"
      : variant;
  return <span className={`badge badge-${norm}`}>{children}</span>;
}

// ── Spinner ─────────────────────────────────────────────

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="animate-spin-slow"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
