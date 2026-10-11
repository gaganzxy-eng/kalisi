"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Play,
  Power,
  RefreshCw,
  Server,
  Users,
  Clock,
  Gauge,
  Timer,
  Puzzle,
  Archive,
  Wifi,
  Zap,
  TrendingUp,
} from "lucide-react";
import { getServerStatus, startServer, stopServer, restartServer, ServerStatus } from "@/lib/api";
import { CardSkeleton, ConfirmDialog, useToast, ErrorState, Badge } from "@/components/ui";

function formatUptime(seconds: number | null): string {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(mb: number | null): string {
  if (mb === null || mb === undefined) return "—";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  accentColor?: string;
  index?: number;
}

function StatCard({ icon, label, value, subtext, accentColor = "var(--color-accent)", index = 0 }: StatCardProps) {
  return (
    <div
      className="card animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2 rounded-lg"
          style={{ background: `${accentColor}15` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold mb-0.5" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </p>
      <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </p>
      {subtext && (
        <p className="text-[0.6875rem] mt-1" style={{ color: "var(--color-text-muted)" }}>
          {subtext}
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { addToast } = useToast();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getServerStatus();
      setStatus(data);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to connect to agent");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      let result;
      switch (action) {
        case "start":
          result = await startServer();
          break;
        case "stop":
          result = await stopServer();
          break;
        case "restart":
          result = await restartServer();
          break;
      }
      if (result?.success) {
        addToast("success", result.message || `Server ${action} successful`);
      } else {
        addToast("error", result?.error || `Failed to ${action} server`);
      }
      setTimeout(fetchStatus, 2000);
    } catch (err: unknown) {
      addToast("error", (err as Error).message || `Failed to ${action} server`);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="skeleton" style={{ width: "200px", height: "1.5rem" }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <ErrorState
        title="Agent Offline"
        message={error}
        onRetry={fetchStatus}
      />
    );
  }

  const m = status?.metrics || {};
  const isRunning = status?.state === "running";
  const isStarting = status?.state === "starting";
  const isStopping = status?.state === "stopping";

  return (
    <div>
      {/* Page Title + Server Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Server overview and quick controls
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Start */}
          <button
            className="btn btn-primary btn-sm"
            disabled={isRunning || isStarting || !!actionLoading}
            onClick={() => handleAction("start")}
          >
            {actionLoading === "start" ? (
              <RefreshCw size={14} className="animate-spin-slow" />
            ) : (
              <Play size={14} />
            )}
            Start
          </button>

          {/* Stop */}
          <button
            className="btn btn-danger btn-sm"
            disabled={!isRunning || !!actionLoading}
            onClick={() => setConfirmAction("stop")}
          >
            {actionLoading === "stop" ? (
              <RefreshCw size={14} className="animate-spin-slow" />
            ) : (
              <Power size={14} />
            )}
            Stop
          </button>

          {/* Restart */}
          <button
            className="btn btn-secondary btn-sm"
            disabled={!isRunning || !!actionLoading}
            onClick={() => setConfirmAction("restart")}
          >
            {actionLoading === "restart" ? (
              <RefreshCw size={14} className="animate-spin-slow" />
            ) : (
              <RefreshCw size={14} />
            )}
            Restart
          </button>
        </div>
      </div>

      {/* Server Status Banner */}
      <div
        className="card card-accent mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        style={{
          borderLeftColor: isRunning ? "var(--color-online)" : "var(--color-offline)",
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div
            className="p-2.5 rounded-xl"
            style={{
              background: isRunning
                ? "rgba(74, 222, 128, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            }}
          >
            <Server
              size={24}
              style={{
                color: isRunning ? "var(--color-online)" : "var(--color-offline)",
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Kalisi SMP Server
              </h3>
              <Badge variant={isRunning ? "success" : isStopping || isStarting ? "warning" : "danger"}>
                {status?.state?.toUpperCase() || "UNKNOWN"}
              </Badge>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {status?.version?.minecraft !== "Unknown"
                ? `Minecraft ${status?.version?.minecraft}`
                : "Version unavailable"}{" "}
              • Port {status?.minecraft_port}
              {status?.health?.externally_managed && " • Externally managed"}
            </p>
          </div>
        </div>
        {status?.pid && (
          <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-muted)" }}>
            PID {status.pid}
          </span>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} />}
          label="Online Players"
          value={m.player_count !== undefined && m.player_count !== null ? String(m.player_count) : "—"}
          subtext={`Peak: ${m.peak_players ?? "—"}`}
          index={0}
        />
        <StatCard
          icon={<Cpu size={20} />}
          label="CPU Usage"
          value={m.cpu_percent != null ? `${Number(m.cpu_percent).toFixed(1)}%` : "Unavailable"}
          subtext={m.java_cpu_percent != null ? `Java: ${Number(m.java_cpu_percent).toFixed(1)}%` : undefined}
          accentColor="#3b82f6"
          index={1}
        />
        <StatCard
          icon={<MemoryStick size={20} />}
          label="RAM Usage"
          value={m.ram_used_mb != null ? formatBytes(Number(m.ram_used_mb)) : "Unavailable"}
          subtext={m.ram_total_mb != null ? `of ${formatBytes(Number(m.ram_total_mb))} (${m.ram_percent ?? "—"}%)` : undefined}
          accentColor="#8b5cf6"
          index={2}
        />
        <StatCard
          icon={<HardDrive size={20} />}
          label="Disk Space"
          value={m.disk_free_gb != null ? `${Number(m.disk_free_gb).toFixed(1)} GB free` : "Unavailable"}
          subtext={m.disk_total_gb != null ? `${Number(m.disk_used_gb).toFixed(1)} / ${Number(m.disk_total_gb).toFixed(1)} GB (${m.disk_percent}%)` : undefined}
          accentColor="#f59e0b"
          index={3}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Server Uptime"
          value={formatUptime(status?.uptime_seconds ?? null)}
          subtext={`Restarts: ${status?.restart_count ?? 0} • Crashes: ${status?.crash_count ?? 0}`}
          accentColor="#06b6d4"
          index={4}
        />
        <StatCard
          icon={<Gauge size={20} />}
          label="TPS"
          value={m.tps != null ? String(Number(m.tps).toFixed(1)) : "Unavailable"}
          subtext="Ticks per second (ideal: 20.0)"
          accentColor="#22c55e"
          index={5}
        />
        <StatCard
          icon={<Timer size={20} />}
          label="MSPT"
          value={m.mspt != null ? `${Number(m.mspt).toFixed(1)}ms` : "Unavailable"}
          subtext="Milliseconds per tick (< 50ms ideal)"
          accentColor="#ec4899"
          index={6}
        />
        <StatCard
          icon={<Wifi size={20} />}
          label="Agent"
          value={error ? "Offline" : "Online"}
          subtext={m.agent_uptime ? `Uptime: ${formatUptime(Number(m.agent_uptime))}` : undefined}
          accentColor={error ? "#ef4444" : "#4ade80"}
          index={7}
        />
        <StatCard
          icon={<Zap size={20} />}
          label="Java Process"
          value={m.java_running ? "Running" : "Stopped"}
          subtext={m.java_memory_mb != null ? `Memory: ${formatBytes(Number(m.java_memory_mb))}` : undefined}
          accentColor={m.java_running ? "#22c55e" : "#6b7280"}
          index={8}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Minecraft Version"
          value={status?.version?.minecraft || "Unknown"}
          subtext={status?.version?.paper !== "Unknown" ? `Paper: ${status?.version?.paper}` : undefined}
          accentColor="#a855f7"
          index={9}
        />
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmAction === "stop"}
        title="Stop Server"
        message="Are you sure you want to stop the Minecraft server? All online players will be disconnected."
        confirmText="Stop Server"
        danger
        onConfirm={() => handleAction("stop")}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "restart"}
        title="Restart Server"
        message="Are you sure you want to restart the server? Players will be temporarily disconnected."
        confirmText="Restart Server"
        onConfirm={() => handleAction("restart")}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
