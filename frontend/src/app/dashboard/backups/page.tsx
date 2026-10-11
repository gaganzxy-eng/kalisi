"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Archive,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  RefreshCw,
  HardDrive,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  downloadFile,
  Backup,
} from "@/lib/api";
import { useToast, ConfirmDialog, EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";

export default function BackupsPage() {
  const { addToast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [worldsOnly, setWorldsOnly] = useState(false);

  // Restore states
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBackups();
      setBackups(data.backups || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreate = async () => {
    setCreating(true);
    setShowCreateModal(false);
    try {
      const res = await createBackup(worldsOnly);
      addToast(
        res.filename
          ? `Backup created: ${res.filename} (${res.size_mb?.toFixed(1)} MB)`
          : "Backup created successfully",
        "success"
      );
      await fetchBackups();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await restoreBackup(restoreTarget.filename);
      addToast(
        res.message || `Server restored successfully from ${restoreTarget.filename}`,
        "success"
      );
      setRestoreTarget(null);
      await fetchBackups();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBackup(deleteTarget);
      addToast(`Deleted backup ${deleteTarget}`, "success");
      setDeleteTarget(null);
      await fetchBackups();
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const blob = await downloadFile(`backups/${filename}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast(`Downloaded ${filename}`, "success");
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const totalBackupSizeMb = backups.reduce((acc, curr) => {
    const mb = curr.size_mb || (curr.size_bytes ? curr.size_bytes / (1024 * 1024) : 0);
    return acc + mb;
  }, 0);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2.5">
            <Archive className="text-amber-400" size={26} />
            Backups & Disaster Recovery
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Create snapshots, download archives, and safely restore your Minecraft server
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={creating}
            className="btn btn-primary flex items-center gap-2"
          >
            {creating ? <Spinner size={16} /> : <Plus size={16} />}
            Create Backup
          </button>

          <button
            onClick={fetchBackups}
            disabled={loading}
            className="btn btn-secondary btn-icon"
            title="Refresh backups"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Archive className="text-amber-400" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {backups.length}
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Available Snapshots
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="text-blue-400" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {totalBackupSizeMb.toFixed(1)} MB
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Total Backups Storage
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="text-emerald-400" size={24} />
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-emerald-400">
              Recovery Guard Enabled
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Safety snapshot before restore
            </div>
          </div>
        </div>
      </div>

      {/* Backups List */}
      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading backup catalog...</p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchBackups} />
      ) : backups.length === 0 ? (
        <EmptyState
          title="No Backups Found"
          description="Protect your server from world corruption or accidents. Create your first backup snapshot now."
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Create First Backup
            </button>
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
                  <th className="py-3 px-4">Backup Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-primary)]">
                {backups.map((b) => {
                  const sizeMb =
                    b.size_mb || (b.size_bytes ? b.size_bytes / (1024 * 1024) : 0);
                  const isWorldsOnly =
                    b.backup_type === "worlds" || b.filename.includes("worlds");

                  return (
                    <tr
                      key={b.filename}
                      className="hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-2.5">
                          <Archive size={18} className="text-amber-400 shrink-0" />
                          <span className="font-mono text-xs break-all">{b.filename}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={isWorldsOnly ? "neutral" : "primary"}>
                          {isWorldsOnly ? "Worlds Only" : "Full Server"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-[var(--color-text-secondary)]">
                        {sizeMb.toFixed(1)} MB
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                        {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleDownload(b.filename)}
                            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-blue-400 transition-colors"
                            title="Download backup zip"
                          >
                            <Download size={15} />
                          </button>

                          <button
                            onClick={() => setRestoreTarget(b)}
                            className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors"
                            title="Restore server from backup"
                          >
                            <RotateCcw size={15} />
                          </button>

                          <button
                            onClick={() => setDeleteTarget(b.filename)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Delete backup"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-6 border border-[var(--color-border-primary)] shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
              <Archive className="text-amber-400" size={20} />
              Create Server Backup
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-5">
              Choose the scope of the backup. The backup zip will be saved on your phone and can be downloaded anytime.
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <label
                onClick={() => setWorldsOnly(false)}
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  !worldsOnly
                    ? "bg-amber-500/10 border-amber-500/40 text-[var(--color-text-primary)]"
                    : "border-[var(--color-border-primary)] opacity-70 hover:opacity-100"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={!worldsOnly}
                  onChange={() => setWorldsOnly(false)}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-sm">Full Server Backup</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Includes all worlds, plugins, configuration files, and permissions.
                  </div>
                </div>
              </label>

              <label
                onClick={() => setWorldsOnly(true)}
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  worldsOnly
                    ? "bg-amber-500/10 border-amber-500/40 text-[var(--color-text-primary)]"
                    : "border-[var(--color-border-primary)] opacity-70 hover:opacity-100"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={worldsOnly}
                  onChange={() => setWorldsOnly(true)}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-sm">Worlds Only (Fast)</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Only zips the world directories. Faster and uses less storage.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleCreate} className="btn btn-primary">
                Start Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Warning Dialog */}
      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore Server from Backup"
        message={`WARNING: Restoring will overwrite current files with the contents of ${restoreTarget?.filename}. The agent will automatically stop the server and take a pre-restore safety snapshot before unzipping. Proceed?`}
        confirmText={restoring ? "Restoring..." : "Restore Snapshot"}
        danger
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Backup"
        message={`Are you sure you want to permanently delete ${deleteTarget}? This cannot be undone.`}
        confirmText="Delete Backup"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
