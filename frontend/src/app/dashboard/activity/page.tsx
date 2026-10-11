"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollText,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Shield,
  Server,
  FolderOpen,
  Archive,
  Terminal,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getAuditLogs } from "@/lib/api";
import { EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";

interface AuditRecord {
  id?: number;
  action: string;
  user?: string;
  username?: string;
  ip?: string;
  ip_address?: string;
  details?: string | Record<string, unknown>;
  timestamp?: string;
  created_at?: string;
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const actionParam = filterAction === "all" ? undefined : filterAction;
      const data = await getAuditLogs(150, 0, actionParam);
      setLogs((data.logs || []) as unknown as AuditRecord[]);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("start") || act.includes("online")) {
      return { variant: "success" as const, icon: <Server size={14} /> };
    }
    if (act.includes("stop") || act.includes("crash") || act.includes("ban")) {
      return { variant: "error" as const, icon: <Shield size={14} /> };
    }
    if (act.includes("backup")) {
      return { variant: "primary" as const, icon: <Archive size={14} /> };
    }
    if (act.includes("file") || act.includes("write")) {
      return { variant: "neutral" as const, icon: <FolderOpen size={14} /> };
    }
    if (act.includes("command")) {
      return { variant: "warning" as const, icon: <Terminal size={14} /> };
    }
    return { variant: "neutral" as const, icon: <ScrollText size={14} /> };
  };

  const filteredLogs = logs.filter((log) => {
    const act = (log.action || "").toLowerCase();
    const usr = (log.user || log.username || "").toLowerCase();
    const q = searchQuery.toLowerCase();
    return act.includes(q) || usr.includes(q);
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2.5">
            <ScrollText className="text-purple-400" size={26} />
            Activity & Audit Logs
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Immutable log of administrative operations, server commands, and logins
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="btn btn-secondary btn-icon self-start sm:self-auto"
          title="Refresh activity"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="Search activity by action or administrator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-[var(--color-text-muted)] shrink-0" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="input text-sm py-2 px-3 w-full sm:w-48"
          >
            <option value="all">All Activities</option>
            <option value="server">Server Lifecycle</option>
            <option value="command">Commands</option>
            <option value="backup">Backups</option>
            <option value="file">File Changes</option>
            <option value="moderation">Moderation</option>
            <option value="auth">Authentication</option>
          </select>
        </div>
      </div>

      {/* Logs Table / Feed */}
      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-[var(--color-text-secondary)]">Retrieving audit log entries...</p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLogs} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No Activity Found"
          description={
            searchQuery || filterAction !== "all"
              ? "No records matched your search filters."
              : "No administrative activities recorded in the database yet."
          }
        />
      ) : (
        <div className="card overflow-hidden border border-[var(--color-border-primary)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr
                  className="border-b text-xs font-semibold uppercase tracking-wider"
                  style={{
                    borderColor: "var(--color-border-primary)",
                    color: "var(--color-text-muted)",
                    background: "var(--color-bg-secondary)",
                  }}
                >
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-primary)]">
                {filteredLogs.map((log, index) => {
                  const id = log.id ?? index;
                  const isExpanded = expandedId === id;
                  const badge = getActionBadge(log.action);
                  const dateStr = log.timestamp || log.created_at || "";
                  const user = log.user || log.username || "system";
                  const ip = log.ip || log.ip_address || "127.0.0.1";

                  return (
                    <React.Fragment key={id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : id)}
                        className="hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                          <div className="flex items-center gap-2">
                            <Badge variant={badge.variant}>
                              <span className="flex items-center gap-1.5">
                                {badge.icon}
                                {log.action}
                              </span>
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-[var(--color-text-secondary)]">
                          {user}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-[var(--color-text-muted)]">
                          {ip}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                          {dateStr ? new Date(dateStr).toLocaleString() : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            title="Toggle details"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-[var(--color-bg-tertiary)]/40">
                          <td colSpan={5} className="p-4">
                            <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg border border-[var(--color-border-primary)] text-xs font-mono text-[var(--color-text-secondary)] overflow-x-auto">
                              <pre className="whitespace-pre-wrap">
                                {typeof log.details === "object"
                                  ? JSON.stringify(log.details, null, 2)
                                  : log.details || "No additional metadata recorded."}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
