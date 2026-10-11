"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Puzzle,
  Upload,
  Search,
  Power,
  FileCode,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  FolderOpen,
} from "lucide-react";
import { listPlugins, togglePlugin, uploadPlugin, deleteFile, Plugin } from "@/lib/api";
import { useToast, ConfirmDialog, EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";
import Link from "next/link";

export default function PluginsPage() {
  const { addToast } = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restartWarning, setRestartWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlugins();
      setPlugins(data.plugins);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handleToggle = async (plugin: Plugin) => {
    setActionLoading(plugin.filename);
    try {
      const res = await togglePlugin(plugin.filename);
      addToast(
        res.message || `Plugin ${res.action === "enabled" ? "enabled" : "disabled"} successfully`,
        "success"
      );
      if (res.restart_required) {
        setRestartWarning(true);
      }
      await fetchPlugins();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".jar")) {
      addToast("Only .jar plugin files are permitted", "error");
      return;
    }

    setActionLoading("upload");
    try {
      const res = await uploadPlugin(file);
      addToast(res.message || `Uploaded ${res.filename} successfully`, "success");
      if (res.restart_required) {
        setRestartWarning(true);
      }
      await fetchPlugins();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setActionLoading(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFile(`plugins/${deleteTarget}`);
      addToast(`Deleted ${deleteTarget}`, "success");
      setDeleteTarget(null);
      setRestartWarning(true);
      await fetchPlugins();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const filteredPlugins = plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const enabledCount = plugins.filter((p) => p.appears_enabled).length;
  const disabledCount = plugins.filter((p) => !p.appears_enabled).length;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2.5">
            <Puzzle className="text-emerald-400" size={26} />
            Plugin Manager
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Install, configure, and manage PaperMC plugins on your server
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept=".jar"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={actionLoading === "upload"}
            className="btn btn-primary flex items-center gap-2"
          >
            {actionLoading === "upload" ? (
              <Spinner size={16} />
            ) : (
              <Upload size={16} />
            )}
            Upload Plugin (.jar)
          </button>

          <button
            onClick={fetchPlugins}
            disabled={loading}
            className="btn btn-secondary btn-icon"
            title="Refresh plugins"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Restart Notice Banner */}
      {restartWarning && (
        <div
          className="p-4 rounded-xl flex items-center justify-between gap-4 border"
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            borderColor: "rgba(245, 158, 11, 0.3)",
          }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Server Restart Required
              </p>
              <p className="text-xs text-amber-300/80">
                Changes to plugins take effect after rebooting your Minecraft server.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="btn btn-secondary text-xs shrink-0 no-underline"
          >
            Go to Dashboard
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Puzzle className="text-purple-400" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {plugins.length}
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Installed Plugins
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="text-emerald-400" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {enabledCount}
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Active / Enabled
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Power className="text-amber-400" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">
              {disabledCount}
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Disabled (.disabled)
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="text"
          placeholder="Search plugins by name or filename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-10 w-full"
        />
      </div>

      {/* Plugins List */}
      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Loading plugins directory...
          </p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPlugins} />
      ) : filteredPlugins.length === 0 ? (
        plugins.length === 0 ? (
          <EmptyState
            title="No Plugins Installed"
            description="Your /plugins directory is currently empty. Upload your first PaperMC plugin jar file to enhance your server."
            action={
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary flex items-center gap-2"
              >
                <Upload size={16} /> Upload Plugin (.jar)
              </button>
            }
          />
        ) : (
          <EmptyState
            title="No Matching Plugins"
            description={`No plugins matched your search query "${searchQuery}".`}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlugins.map((plugin) => (
            <div
              key={plugin.filename}
              className={`card p-5 flex flex-col justify-between transition-all duration-200 border ${
                plugin.appears_enabled
                  ? "border-[var(--color-border-primary)] hover:border-emerald-500/40"
                  : "border-[var(--color-border-primary)] opacity-75 hover:opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      plugin.appears_enabled
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    }`}
                  >
                    <Puzzle size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-[var(--color-text-primary)] flex items-center gap-2">
                      {plugin.name}
                      <Badge
                        variant={plugin.appears_enabled ? "success" : "neutral"}
                      >
                        {plugin.appears_enabled ? "Active" : "Disabled"}
                      </Badge>
                    </h3>
                    <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5 break-all">
                      {plugin.filename}
                    </p>
                  </div>
                </div>

                {/* Status Toggle Switch */}
                <button
                  onClick={() => handleToggle(plugin)}
                  disabled={actionLoading === plugin.filename}
                  title={
                    plugin.appears_enabled
                      ? "Disable plugin (adds .disabled)"
                      : "Enable plugin"
                  }
                  className={`btn btn-sm flex items-center gap-1.5 ${
                    plugin.appears_enabled ? "btn-secondary" : "btn-primary"
                  }`}
                >
                  {actionLoading === plugin.filename ? (
                    <Spinner size={14} />
                  ) : (
                    <Power size={14} />
                  )}
                  {plugin.appears_enabled ? "Disable" : "Enable"}
                </button>
              </div>

              {/* Plugin Details & Links */}
              <div className="mt-5 pt-3 border-t border-[var(--color-border-primary)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <div className="flex items-center gap-3">
                  <span>{plugin.size_mb.toFixed(2)} MB</span>
                  <span>•</span>
                  <span>{new Date(plugin.modified).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  {plugin.has_config && plugin.config_dir && (
                    <Link
                      href={`/dashboard/files?path=plugins/${encodeURIComponent(
                        plugin.config_dir
                      )}`}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors no-underline px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20"
                    >
                      <FolderOpen size={12} />
                      Config
                    </Link>
                  )}

                  <button
                    onClick={() => setDeleteTarget(plugin.filename)}
                    className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
                    title="Delete plugin"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Plugin"
        message={`Are you sure you want to delete ${deleteTarget}? This will permanently remove the jar file from your server.`}
        confirmText="Delete Plugin"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
