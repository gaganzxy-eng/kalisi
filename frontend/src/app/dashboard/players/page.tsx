"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  Search,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  Send,
  Sliders,
  CheckCircle,
} from "lucide-react";
import {
  getOnlinePlayers,
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  getOps,
  grantOp,
  revokeOp,
  kickPlayer,
  banPlayer,
  changeGamemode,
  sendPrivateMessage,
  getAllPlayers,
} from "@/lib/api";
import { useToast, ConfirmDialog, EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";

type TabType = "online" | "whitelist" | "ops" | "all";

export default function PlayersPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("online");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [onlineData, setOnlineData] = useState<{
    online: string[];
    count: number;
    max: number;
    server_offline?: boolean;
  }>({ online: [], count: 0, max: 20 });
  const [whitelist, setWhitelist] = useState<Record<string, unknown>[]>([]);
  const [ops, setOps] = useState<Record<string, unknown>[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, unknown>[]>([]);

  // Action Dialog States
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"kick" | "ban" | "msg" | "gamemode" | null>(null);
  const [actionValue, setActionValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Add dialogs
  const [showAddWhitelist, setShowAddWhitelist] = useState(false);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [showAddOp, setShowAddOp] = useState(false);
  const [opInput, setOpInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "online") {
        const data = await getOnlinePlayers();
        setOnlineData(data);
      } else if (activeTab === "whitelist") {
        const data = await getWhitelist();
        setWhitelist(data.whitelist || []);
      } else if (activeTab === "ops") {
        const data = await getOps();
        setOps(data.ops || []);
      } else if (activeTab === "all") {
        const data = await getAllPlayers(100, 0, searchQuery);
        setAllPlayers(data.players || []);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tab change handler
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery("");
  };

  // Perform moderation / action
  const handleExecuteAction = async () => {
    if (!actionTarget || !actionType) return;
    setSubmitting(true);
    try {
      if (actionType === "kick") {
        await kickPlayer(actionTarget, actionValue || "Kicked by administrator");
        addToast(`Kicked ${actionTarget}`, "success");
      } else if (actionType === "ban") {
        await banPlayer(actionTarget, actionValue || "Banned by administrator");
        addToast(`Banned ${actionTarget}`, "success");
      } else if (actionType === "msg") {
        await sendPrivateMessage(actionTarget, actionValue);
        addToast(`Message dispatched to ${actionTarget}`, "success");
      } else if (actionType === "gamemode") {
        await changeGamemode(actionTarget, actionValue);
        addToast(`Gamemode set to ${actionValue} for ${actionTarget}`, "success");
      }
      setActionTarget(null);
      setActionType(null);
      setActionValue("");
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Whitelist operations
  const handleAddWhitelist = async () => {
    if (!whitelistInput.trim()) return;
    try {
      await addToWhitelist(whitelistInput.trim());
      addToast(`Added ${whitelistInput} to whitelist`, "success");
      setShowAddWhitelist(false);
      setWhitelistInput("");
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const handleRemoveWhitelist = async (name: string) => {
    try {
      await removeFromWhitelist(name);
      addToast(`Removed ${name} from whitelist`, "success");
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  // OP operations
  const handleAddOp = async () => {
    if (!opInput.trim()) return;
    try {
      await grantOp(opInput.trim());
      addToast(`Granted OP to ${opInput}`, "success");
      setShowAddOp(false);
      setOpInput("");
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const handleRevokeOp = async (name: string) => {
    try {
      await revokeOp(name);
      addToast(`Revoked OP from ${name}`, "success");
      fetchData();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2.5">
            <Users className="text-blue-400" size={26} />
            Player Management
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Monitor online players, handle permissions, whitelist, and player actions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "whitelist" && (
            <button
              onClick={() => setShowAddWhitelist(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Add Whitelist
            </button>
          )}

          {activeTab === "ops" && (
            <button
              onClick={() => setShowAddOp(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Shield size={16} /> Add Operator
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="btn btn-secondary btn-icon"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border-primary)] pb-1">
        <button
          onClick={() => handleTabChange("online")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "online"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <Users size={16} />
          Online ({onlineData.count || 0})
        </button>

        <button
          onClick={() => handleTabChange("whitelist")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "whitelist"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <UserCheck size={16} />
          Whitelist
        </button>

        <button
          onClick={() => handleTabChange("ops")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "ops"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <Shield size={16} />
          Operators (OP)
        </button>

        <button
          onClick={() => handleTabChange("all")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "all"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <Sparkles size={16} />
          Player Directory
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading player details...</p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : activeTab === "online" ? (
        /* ONLINE PLAYERS */
        onlineData.server_offline ? (
          <EmptyState
            title="Minecraft Server is Offline"
            description="Start the Paper Minecraft server from the Dashboard to see connected players."
          />
        ) : onlineData.online.length === 0 ? (
          <EmptyState
            title="No Players Online"
            description="No players are currently logged into the server. Connect to playit.gg to play!"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {onlineData.online.map((player) => (
              <div
                key={player}
                className="card p-5 flex flex-col justify-between border border-[var(--color-border-primary)] hover:border-blue-500/40 transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <img
                      src={`https://mc-heads.net/avatar/${player}/48`}
                      alt={player}
                      className="w-10 h-10 rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-base text-[var(--color-text-primary)] truncate">
                      {player}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-emerald-400 font-medium">Online</span>
                    </div>
                  </div>
                </div>

                {/* Quick Player Actions */}
                <div className="grid grid-cols-4 gap-2 mt-5 pt-3 border-t border-[var(--color-border-primary)]">
                  <button
                    onClick={() => {
                      setActionTarget(player);
                      setActionType("msg");
                      setActionValue("");
                    }}
                    title="Send Private Message"
                    className="btn btn-secondary btn-sm flex items-center justify-center p-2"
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setActionTarget(player);
                      setActionType("gamemode");
                      setActionValue("creative");
                    }}
                    title="Switch Gamemode"
                    className="btn btn-secondary btn-sm flex items-center justify-center p-2"
                  >
                    <Sliders size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setActionTarget(player);
                      setActionType("kick");
                      setActionValue("Kicked by admin");
                    }}
                    title="Kick Player"
                    className="btn btn-secondary btn-sm text-amber-400 hover:text-amber-300 flex items-center justify-center p-2"
                  >
                    <UserX size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setActionTarget(player);
                      setActionType("ban");
                      setActionValue("Banned by admin");
                    }}
                    title="Ban Player"
                    className="btn btn-secondary btn-sm text-rose-400 hover:text-rose-300 flex items-center justify-center p-2"
                  >
                    <AlertTriangle size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === "whitelist" ? (
        /* WHITELIST */
        whitelist.length === 0 ? (
          <EmptyState
            title="Whitelist is Empty"
            description="No players are on the whitelist. Anyone can join if whitelist is not enforced."
            action={
              <button
                onClick={() => setShowAddWhitelist(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus size={16} /> Add Whitelist Player
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {whitelist.map((item, idx) => {
              const name = (item.name || item.username || `Player #${idx}`) as string;
              const uuid = (item.uuid || "") as string;
              return (
                <div
                  key={name + idx}
                  className="card p-4 flex items-center justify-between border border-[var(--color-border-primary)]"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://mc-heads.net/avatar/${name}/36`}
                      alt={name}
                      className="w-9 h-9 rounded-lg bg-[var(--color-bg-tertiary)]"
                    />
                    <div>
                      <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
                        {name}
                      </h4>
                      {uuid && (
                        <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] truncate max-w-[160px]">
                          {uuid}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveWhitelist(name)}
                    className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                    title="Remove from whitelist"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === "ops" ? (
        /* OPERATORS */
        ops.length === 0 ? (
          <EmptyState
            title="No Operators Configured"
            description="There are currently no OP players in ops.json."
            action={
              <button
                onClick={() => setShowAddOp(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Shield size={16} /> Add Operator
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ops.map((item, idx) => {
              const name = (item.name || item.username || `OP #${idx}`) as string;
              const level = (item.level || 4) as number;
              return (
                <div
                  key={name + idx}
                  className="card p-4 flex items-center justify-between border border-amber-500/20"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://mc-heads.net/avatar/${name}/36`}
                      alt={name}
                      className="w-9 h-9 rounded-lg bg-[var(--color-bg-tertiary)]"
                    />
                    <div>
                      <h4 className="font-semibold text-sm text-[var(--color-text-primary)] flex items-center gap-1.5">
                        {name}
                        <Badge variant="warning">OP Lv{level}</Badge>
                      </h4>
                      <p className="text-[0.65rem] text-[var(--color-text-muted)]">
                        Administrator Access
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeOp(name)}
                    className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                    title="Revoke OP status"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ALL PLAYERS DIRECTORY */
        <div>
          <div className="mb-4 relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search historical players by name or UUID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {allPlayers.length === 0 ? (
            <EmptyState
              title="No Directory Records"
              description="No player profiles or historical joins have been recorded yet."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allPlayers.map((player, idx) => {
                const name = (player.name || player.username || `Player #${idx}`) as string;
                const uuid = (player.uuid || "") as string;
                return (
                  <div
                    key={name + idx}
                    className="card p-4 flex items-center justify-between border border-[var(--color-border-primary)]"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://mc-heads.net/avatar/${name}/36`}
                        alt={name}
                        className="w-9 h-9 rounded-lg bg-[var(--color-bg-tertiary)]"
                      />
                      <div>
                        <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
                          {name}
                        </h4>
                        <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] truncate max-w-[180px]">
                          {uuid}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Dialog (Kick / Ban / Msg / Gamemode) */}
      {actionTarget && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-6 border border-[var(--color-border-primary)] shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] capitalize mb-1">
              {actionType === "msg"
                ? "Send Private Message"
                : actionType === "gamemode"
                ? "Change Gamemode"
                : `${actionType} Player`}{" "}
              — {actionTarget}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              {actionType === "msg"
                ? `Send an in-game whisper command /msg to ${actionTarget}.`
                : actionType === "gamemode"
                ? `Update the current player gamemode on the PaperMC server.`
                : `Specify a reason for this moderation action against ${actionTarget}.`}
            </p>

            {actionType === "gamemode" ? (
              <select
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                className="input w-full mb-4"
              >
                <option value="survival">Survival</option>
                <option value="creative">Creative</option>
                <option value="adventure">Adventure</option>
                <option value="spectator">Spectator</option>
              </select>
            ) : (
              <input
                type="text"
                placeholder={
                  actionType === "msg" ? "Enter your message..." : "Reason for moderation..."
                }
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                className="input w-full mb-4"
                autoFocus
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setActionTarget(null);
                  setActionType(null);
                }}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={submitting}
                className={`btn ${
                  actionType === "ban" || actionType === "kick" ? "btn-danger" : "btn-primary"
                } flex items-center gap-1.5`}
              >
                {submitting && <Spinner size={14} />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whitelist Add Modal */}
      {showAddWhitelist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-6 border border-[var(--color-border-primary)] shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
              Add Player to Whitelist
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Enter the exact Minecraft username or player name to add.
            </p>
            <input
              type="text"
              placeholder="Minecraft username (e.g. Steve)"
              value={whitelistInput}
              onChange={(e) => setWhitelistInput(e.target.value)}
              className="input w-full mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddWhitelist(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleAddWhitelist} className="btn btn-primary">
                Add to Whitelist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OP Add Modal */}
      {showAddOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-6 border border-[var(--color-border-primary)] shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
              Grant Operator (OP)
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Enter the Minecraft username. Operators have full administrator control on the server.
            </p>
            <input
              type="text"
              placeholder="Minecraft username (e.g. AdminPlayer)"
              value={opInput}
              onChange={(e) => setOpInput(e.target.value)}
              className="input w-full mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddOp(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleAddOp} className="btn btn-primary">
                Grant OP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
