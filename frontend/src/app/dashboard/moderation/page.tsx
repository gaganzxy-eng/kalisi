"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Shield,
  AlertTriangle,
  UserX,
  UserCheck,
  Search,
  RefreshCw,
  Clock,
  History,
  CheckCircle,
} from "lucide-react";
import { kickPlayer, banPlayer, unbanPlayer, getModerationHistory } from "@/lib/api";
import { useToast, ConfirmDialog, EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";

interface ModerationRecord {
  id?: number;
  player?: string;
  target?: string;
  action: string;
  reason: string;
  created_at?: string;
  timestamp?: string;
  moderator?: string;
}

export default function ModerationPage() {
  const { addToast } = useToast();
  const [history, setHistory] = useState<ModerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Action form state
  const [actionType, setActionType] = useState<"kick" | "ban" | "unban">("kick");
  const [targetPlayer, setTargetPlayer] = useState("");
  const [reason, setReason] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Unban modal from log
  const [unbanTarget, setUnbanTarget] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getModerationHistory(searchQuery || undefined);
      setHistory((data.history || []) as unknown as ModerationRecord[]);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPlayer.trim()) {
      addToast("Player name is required", "error");
      return;
    }

    setActionSubmitting(true);
    try {
      if (actionType === "kick") {
        await kickPlayer(targetPlayer.trim(), reason.trim() || "Kicked by administrator");
        addToast(`Successfully kicked ${targetPlayer}`, "success");
      } else if (actionType === "ban") {
        await banPlayer(targetPlayer.trim(), reason.trim() || "Banned by administrator");
        addToast(`Successfully banned ${targetPlayer}`, "success");
      } else if (actionType === "unban") {
        await unbanPlayer(targetPlayer.trim(), reason.trim() || "Unbanned by administrator");
        addToast(`Successfully unbanned ${targetPlayer}`, "success");
      }

      setTargetPlayer("");
      setReason("");
      await fetchHistory();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleUnbanFromLog = async () => {
    if (!unbanTarget) return;
    try {
      await unbanPlayer(unbanTarget, "Pardoned via Moderation log");
      addToast(`Unbanned ${unbanTarget}`, "success");
      setUnbanTarget(null);
      await fetchHistory();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const filteredHistory = history.filter((item) => {
    const p = (item.player || item.target || "").toLowerCase();
    const r = (item.reason || "").toLowerCase();
    const q = searchQuery.toLowerCase();
    return p.includes(q) || r.includes(q);
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2.5">
            <Shield className="text-rose-400" size={26} />
            Moderation Center
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Enforce server rules, discipline players, and review moderation history
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="btn btn-secondary btn-icon self-start sm:self-auto"
          title="Refresh history"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Moderation Action Form Card */}
      <div className="card p-6 border border-[var(--color-border-primary)]">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" />
          Execute Moderation Action
        </h2>

        <form onSubmit={handleExecuteAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setActionType("kick")}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-medium text-sm transition-all ${
                actionType === "kick"
                  ? "bg-amber-500/10 border-amber-500 text-amber-300"
                  : "border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              <UserX size={16} />
              Kick Player
            </button>

            <button
              type="button"
              onClick={() => setActionType("ban")}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-medium text-sm transition-all ${
                actionType === "ban"
                  ? "bg-rose-500/10 border-rose-500 text-rose-300"
                  : "border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              <AlertTriangle size={16} />
              Ban Player
            </button>

            <button
              type="button"
              onClick={() => setActionType("unban")}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-medium text-sm transition-all ${
                actionType === "unban"
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                  : "border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              <UserCheck size={16} />
              Unban Player
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Target Username
              </label>
              <input
                type="text"
                placeholder="Minecraft username (e.g. Griefer123)"
                value={targetPlayer}
                onChange={(e) => setTargetPlayer(e.target.value)}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Reason / Note
              </label>
              <input
                type="text"
                placeholder="Reason for punishment..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={actionSubmitting}
              className={`btn ${
                actionType === "ban"
                  ? "btn-danger"
                  : actionType === "kick"
                  ? "btn-secondary"
                  : "btn-primary"
              } flex items-center gap-2`}
            >
              {actionSubmitting && <Spinner size={16} />}
              {actionType === "kick" && "Kick Player from Server"}
              {actionType === "ban" && "Permanently Ban Player"}
              {actionType === "unban" && "Unban Player"}
            </button>
          </div>
        </form>
      </div>

      {/* Moderation History */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <History size={18} className="text-blue-400" />
            Audit & Moderation Logs
          </h2>

          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search by player or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-full text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="card p-12 flex flex-col items-center justify-center gap-3">
            <Spinner size={32} />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Fetching moderation history...
            </p>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchHistory} />
        ) : filteredHistory.length === 0 ? (
          <EmptyState
            title="No Moderation Records"
            description={
              searchQuery
                ? `No moderation records match "${searchQuery}".`
                : "Your server has a clean sheet! No kick or ban actions recorded yet."
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
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-primary)]">
                  {filteredHistory.map((rec, idx) => {
                    const playerName = rec.player || rec.target || "Unknown";
                    const isBan = rec.action?.toLowerCase().includes("ban");
                    const isKick = rec.action?.toLowerCase().includes("kick");
                    const dateStr = rec.created_at || rec.timestamp || "";

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={`https://mc-heads.net/avatar/${playerName}/24`}
                              alt={playerName}
                              className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)]"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <span>{playerName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              isBan ? "error" : isKick ? "warning" : "success"
                            }
                          >
                            {rec.action.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-[var(--color-text-secondary)] max-w-xs truncate">
                          {rec.reason || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                          {dateStr ? new Date(dateStr).toLocaleString() : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isBan && (
                            <button
                              onClick={() => setUnbanTarget(playerName)}
                              className="btn btn-secondary btn-sm text-xs py-1 px-2.5 inline-flex items-center gap-1"
                            >
                              <UserCheck size={12} />
                              Pardon
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Unban Dialog */}
      <ConfirmDialog
        open={!!unbanTarget}
        title="Unban Player"
        message={`Are you sure you want to unban ${unbanTarget}? They will be allowed to rejoin the server.`}
        confirmText="Pardon Player"
        onConfirm={handleUnbanFromLog}
        onCancel={() => setUnbanTarget(null)}
      />
    </div>
  );
}
