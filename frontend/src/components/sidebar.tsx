"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Terminal,
  FolderOpen,
  Puzzle,
  Users,
  Globe,
  Settings,
  ScrollText,
  Shield,
  Archive,
  Menu,
  X,
  Sword,
  Wifi,
  WifiOff,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { clearToken } from "@/lib/api";
import { StatusIndicator } from "./ui";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Console", href: "/dashboard/console", icon: <Terminal size={20} /> },
  { label: "File Manager", href: "/dashboard/files", icon: <FolderOpen size={20} /> },
  { label: "Plugins", href: "/dashboard/plugins", icon: <Puzzle size={20} /> },
  { label: "Players", href: "/dashboard/players", icon: <Users size={20} /> },
  { label: "Moderation", href: "/dashboard/moderation", icon: <Shield size={20} /> },
  { label: "Worlds", href: "/dashboard/worlds", icon: <Globe size={20} /> },
  { label: "Backups", href: "/dashboard/backups", icon: <Archive size={20} /> },
  { label: "Settings", href: "/dashboard/settings", icon: <Settings size={20} /> },
  { label: "Activity", href: "/dashboard/activity", icon: <ScrollText size={20} /> },
];

export function Sidebar({ agentOnline = false }: { agentOnline?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden btn btn-secondary btn-icon"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "var(--color-bg-overlay)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          transition-all duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static
          ${collapsed ? "w-[72px]" : "w-[260px]"}
        `}
        style={{
          background: "var(--gradient-sidebar)",
          borderRight: "1px solid var(--color-border-primary)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 h-16 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-primary)" }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--gradient-accent)" }}
              >
                <Sword size={18} color="#0f1117" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                  Kalisi SMP
                </h1>
                <p className="text-[0.625rem] font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Hosting Panel
                </p>
              </div>
            </div>
          )}

          {/* Collapse/Close buttons */}
          <div className="flex items-center gap-1">
            <button
              className="md:hidden btn-icon p-1 rounded-md hover:bg-[var(--color-bg-hover)]"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} style={{ color: "var(--color-text-secondary)" }} />
            </button>
            <button
              className="hidden md:flex btn-icon p-1 rounded-md hover:bg-[var(--color-bg-hover)]"
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft
                size={18}
                style={{
                  color: "var(--color-text-secondary)",
                  transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-150 group no-underline
                    ${collapsed ? "justify-center" : ""}
                  `}
                  style={{
                    background: isActive ? "var(--color-accent-dim)" : "transparent",
                    color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <span
                    className="shrink-0 transition-colors"
                    style={{
                      color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          className="shrink-0 p-3"
          style={{ borderTop: "1px solid var(--color-border-primary)" }}
        >
          {/* Agent Status */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-2 ${
              collapsed ? "justify-center" : ""
            }`}
            style={{ background: "var(--color-bg-tertiary)" }}
          >
            {agentOnline ? (
              <Wifi size={16} style={{ color: "var(--color-online)" }} />
            ) : (
              <WifiOff size={16} style={{ color: "var(--color-offline)" }} />
            )}
            {!collapsed && (
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Agent {agentOnline ? "Online" : "Offline"}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg
              transition-colors hover:bg-[var(--color-bg-hover)] ${
                collapsed ? "justify-center" : ""
              }`}
            style={{ color: "var(--color-text-muted)" }}
          >
            <LogOut size={18} />
            {!collapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Bottom Navigation (Mobile) ──────────────────────────

export function BottomNav() {
  const pathname = usePathname();
  const mobileItems = navItems.slice(0, 5);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex justify-around py-2 px-1"
      style={{
        background: "var(--color-bg-secondary)",
        borderTop: "1px solid var(--color-border-primary)",
      }}
    >
      {mobileItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/dashboard" && pathname?.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg no-underline"
            style={{
              color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
          >
            {item.icon}
            <span className="text-[0.625rem] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
