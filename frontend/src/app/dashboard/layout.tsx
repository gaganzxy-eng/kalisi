"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, BottomNav } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui";
import { verifyAuth, healthCheck } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agentOnline, setAgentOnline] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      await verifyAuth();
      setLoading(false);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const checkAgent = useCallback(async () => {
    try {
      await healthCheck();
      setAgentOnline(true);
    } catch {
      setAgentOnline(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    checkAgent();
    const interval = setInterval(checkAgent, 30000);
    return () => clearInterval(interval);
  }, [checkAuth, checkAgent]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-bg-primary)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center animate-pulse-glow"
            style={{ background: "var(--gradient-accent)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14.5 12.5-5-3v6l5-3z" />
              <path d="M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Loading Kalisi SMP Panel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen" style={{ background: "var(--color-bg-primary)" }}>
        <Sidebar agentOnline={agentOnline} />
        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          {/* Top bar */}
          <header
            className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 h-14"
            style={{
              background: "rgba(15, 17, 23, 0.85)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid var(--color-border-primary)",
            }}
          >
            <div className="flex items-center gap-3 ml-12 md:ml-0">
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Kalisi SMP Server
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`status-dot ${
                    agentOnline ? "status-online" : "status-offline"
                  }`}
                />
                <span
                  className="text-xs font-medium hidden sm:inline"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {agentOnline ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 md:p-6 animate-fade-in">{children}</div>
        </main>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
