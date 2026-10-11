"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Settings,
  Save,
  RefreshCw,
  AlertTriangle,
  Sliders,
  Shield,
  Server,
  Network,
  Cpu,
  Info,
  CheckCircle2,
  Search,
} from "lucide-react";
import { getServerProperties, updateServerProperty } from "@/lib/api";
import { useToast, ConfirmDialog, EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";

type SettingsTab = "general" | "gameplay" | "network" | "all";

export default function SettingsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [editedProperties, setEditedProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [restartNeeded, setRestartNeeded] = useState(false);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServerProperties();
      setProperties(data.properties || {});
      setEditedProperties(data.properties || {});
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const handleChange = (key: string, value: string) => {
    setEditedProperties((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveSingleProperty = async (key: string) => {
    const val = editedProperties[key];
    if (val === undefined || val === properties[key]) return;

    setSavingKey(key);
    try {
      const res = await updateServerProperty(key, val);
      setProperties((prev) => ({ ...prev, [key]: val }));
      addToast(`Updated ${key} successfully`, "success");
      if (res.needs_restart) {
        setRestartNeeded(true);
      }
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setSavingKey(null);
    }
  };

  const saveAllChanged = async () => {
    const changedKeys = Object.keys(editedProperties).filter(
      (k) => editedProperties[k] !== properties[k]
    );

    if (changedKeys.length === 0) {
      addToast("No changes to save", "info");
      return;
    }

    setSavingAll(true);
    let hadRestartRequirement = false;
    let errorsCount = 0;

    for (const key of changedKeys) {
      try {
        const res = await updateServerProperty(key, editedProperties[key]);
        if (res.needs_restart) hadRestartRequirement = true;
      } catch (err) {
        errorsCount++;
      }
    }

    setProperties({ ...editedProperties });
    setSavingAll(false);

    if (errorsCount > 0) {
      addToast(`Saved with ${errorsCount} errors.`, "warning");
    } else {
      addToast(`Saved ${changedKeys.length} server settings`, "success");
    }

    if (hadRestartRequirement) {
      setRestartNeeded(true);
    }
  };

  const hasUnsavedChanges = Object.keys(editedProperties).some(
    (k) => editedProperties[k] !== properties[k]
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2.5">
            <Settings className="text-blue-400" size={26} />
            Server Settings
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Configure server.properties, player limits, game modes, and network options
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <button
              onClick={saveAllChanged}
              disabled={savingAll}
              className="btn btn-primary flex items-center gap-2 shadow-lg shadow-emerald-500/10"
            >
              {savingAll ? <Spinner size={16} /> : <Save size={16} />}
              Save All Changes
            </button>
          )}

          <button
            onClick={fetchProperties}
            disabled={loading}
            className="btn btn-secondary btn-icon"
            title="Refresh settings"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Restart Notice */}
      {restartNeeded && (
        <div
          className="p-4 rounded-xl flex items-center justify-between gap-4 border"
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            borderColor: "rgba(245, 158, 11, 0.3)",
          }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Restart Server to Apply Settings
              </p>
              <p className="text-xs text-amber-300/80">
                PaperMC only loads modified server.properties when restarting.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRestartNeeded(false)}
            className="text-xs text-amber-400 underline hover:text-amber-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border-primary)] pb-1">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "general"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <Server size={16} />
          General
        </button>

        <button
          onClick={() => setActiveTab("gameplay")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "gameplay"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <Sliders size={16} />
          Gameplay & Rules
        </button>

        <button
          onClick={() => setActiveTab("network")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "network"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <Network size={16} />
          Network & Ports
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "all"
              ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <Search size={16} />
          All Properties ({Object.keys(properties).length})
        </button>
      </div>

      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-[var(--color-text-secondary)]">Reading server.properties...</p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProperties} />
      ) : activeTab === "general" ? (
        /* GENERAL TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Server Message of the Day (MOTD)
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Displayed in the Minecraft multiplayer server list
              </p>
              <input
                type="text"
                value={editedProperties["motd"] ?? ""}
                onChange={(e) => handleChange("motd", e.target.value)}
                className="input w-full"
                placeholder="A Minecraft Server"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("motd")}
                disabled={savingKey === "motd" || editedProperties["motd"] === properties["motd"]}
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "motd" ? <Spinner size={14} /> : "Save MOTD"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Maximum Players
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Maximum concurrent player slots on your phone
              </p>
              <input
                type="number"
                value={editedProperties["max-players"] ?? "20"}
                onChange={(e) => handleChange("max-players", e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("max-players")}
                disabled={
                  savingKey === "max-players" ||
                  editedProperties["max-players"] === properties["max-players"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "max-players" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Enforce Whitelist
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Require players to be explicitly on the whitelist to connect
              </p>
              <select
                value={editedProperties["white-list"] ?? "false"}
                onChange={(e) => handleChange("white-list", e.target.value)}
                className="input w-full"
              >
                <option value="true">Enabled (Restricted Access)</option>
                <option value="false">Disabled (Open to Public)</option>
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("white-list")}
                disabled={
                  savingKey === "white-list" ||
                  editedProperties["white-list"] === properties["white-list"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "white-list" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Online Mode (Cracked vs Premium)
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Turn false to allow offline / cracked accounts to join
              </p>
              <select
                value={editedProperties["online-mode"] ?? "true"}
                onChange={(e) => handleChange("online-mode", e.target.value)}
                className="input w-full"
              >
                <option value="true">True (Mojang Auth Required)</option>
                <option value="false">False (Offline / Cracked Enabled)</option>
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("online-mode")}
                disabled={
                  savingKey === "online-mode" ||
                  editedProperties["online-mode"] === properties["online-mode"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "online-mode" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === "gameplay" ? (
        /* GAMEPLAY TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Default Gamemode
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Starting mode for players joining the server
              </p>
              <select
                value={editedProperties["gamemode"] ?? "survival"}
                onChange={(e) => handleChange("gamemode", e.target.value)}
                className="input w-full"
              >
                <option value="survival">Survival</option>
                <option value="creative">Creative</option>
                <option value="adventure">Adventure</option>
                <option value="spectator">Spectator</option>
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("gamemode")}
                disabled={
                  savingKey === "gamemode" ||
                  editedProperties["gamemode"] === properties["gamemode"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "gamemode" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Game Difficulty
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Mob damage, hunger, and world challenge level
              </p>
              <select
                value={editedProperties["difficulty"] ?? "easy"}
                onChange={(e) => handleChange("difficulty", e.target.value)}
                className="input w-full"
              >
                <option value="peaceful">Peaceful</option>
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("difficulty")}
                disabled={
                  savingKey === "difficulty" ||
                  editedProperties["difficulty"] === properties["difficulty"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "difficulty" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Player vs Player (PvP)
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Allow players to attack and harm each other
              </p>
              <select
                value={editedProperties["pvp"] ?? "true"}
                onChange={(e) => handleChange("pvp", e.target.value)}
                className="input w-full"
              >
                <option value="true">Enabled (Combat Allowed)</option>
                <option value="false">Disabled (Safe)</option>
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("pvp")}
                disabled={savingKey === "pvp" || editedProperties["pvp"] === properties["pvp"]}
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "pvp" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Enable Command Blocks
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Allow execution of commands via in-game command blocks
              </p>
              <select
                value={editedProperties["enable-command-block"] ?? "false"}
                onChange={(e) => handleChange("enable-command-block", e.target.value)}
                className="input w-full"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("enable-command-block")}
                disabled={
                  savingKey === "enable-command-block" ||
                  editedProperties["enable-command-block"] ===
                    properties["enable-command-block"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "enable-command-block" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === "network" ? (
        /* NETWORK TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Minecraft Server Port
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Local listening port (Default: 25565)
              </p>
              <input
                type="number"
                value={editedProperties["server-port"] ?? "25565"}
                onChange={(e) => handleChange("server-port", e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("server-port")}
                disabled={
                  savingKey === "server-port" ||
                  editedProperties["server-port"] === properties["server-port"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "server-port" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] flex flex-col justify-between">
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                View Distance (Chunks)
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
                Chunk render radius (4-8 recommended for phone Termux performance)
              </p>
              <input
                type="number"
                value={editedProperties["view-distance"] ?? "6"}
                onChange={(e) => handleChange("view-distance", e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => saveSingleProperty("view-distance")}
                disabled={
                  savingKey === "view-distance" ||
                  editedProperties["view-distance"] === properties["view-distance"]
                }
                className="btn btn-secondary btn-sm"
              >
                {savingKey === "view-distance" ? <Spinner size={14} /> : "Save"}
              </button>
            </div>
          </div>

          <div className="card p-5 border border-[var(--color-border-primary)] md:col-span-2">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
              <Network size={16} className="text-blue-400" />
              Environment & Playit.gg Information
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Your server uses Playit.gg for game traffic and Cloudflare Tunnel for panel management.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]">
                <span className="text-[var(--color-text-muted)] block">Domain Name</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  kalisiadudhamsmpseason2.in
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]">
                <span className="text-[var(--color-text-muted)] block">Hosting Environment</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  Android OPPO (Termux Python Agent)
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ALL PROPERTIES SEARCHABLE LIST */
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search across all server.properties keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          <div className="card overflow-hidden border border-[var(--color-border-primary)]">
            <div className="divide-y divide-[var(--color-border-primary)] max-h-[600px] overflow-y-auto">
              {Object.keys(editedProperties)
                .filter((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((key) => {
                  const isModified = editedProperties[key] !== properties[key];
                  return (
                    <div
                      key={key}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                          {key}
                        </span>
                        {isModified && <Badge variant="warning">Modified</Badge>}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editedProperties[key] ?? ""}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className="input text-xs py-1.5 px-3 w-64 font-mono"
                        />
                        <button
                          onClick={() => saveSingleProperty(key)}
                          disabled={savingKey === key || !isModified}
                          className="btn btn-secondary btn-sm text-xs py-1.5 px-3"
                        >
                          {savingKey === key ? <Spinner size={12} /> : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
