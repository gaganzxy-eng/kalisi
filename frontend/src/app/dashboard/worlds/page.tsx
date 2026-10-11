"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Globe,
  Compass,
  Flame,
  Moon,
  FolderOpen,
  Archive,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { listWorlds, createBackup } from "@/lib/api";
import { useToast, EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";
import Link from "next/link";

interface WorldItem {
  name: string;
  size_bytes: number;
  size_mb: number;
  is_primary: boolean;
}

export default function WorldsPage() {
  const { addToast } = useToast();
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [levelName, setLevelName] = useState<string>("world");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState<string | null>(null);

  const fetchWorlds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listWorlds();
      setWorlds(data.worlds || []);
      if (data.level_name) setLevelName(data.level_name);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorlds();
  }, [fetchWorlds]);

  const handleWorldBackup = async (worldName: string) => {
    setBackingUp(worldName);
    try {
      const res = await createBackup(true); // worlds only
      addToast(
        res.filename
          ? `Created worlds backup: ${res.filename} (${res.size_mb?.toFixed(1)} MB)`
          : "Backup created successfully",
        "success"
      );
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    } finally {
      setBackingUp(null);
    }
  };

  const getWorldType = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("nether")) {
      return {
        type: "The Nether",
        icon: <Flame size={20} className="text-rose-400" />,
        badgeColor: "error",
        colorClass: "from-rose-950/20 to-orange-950/10 border-rose-500/20",
      };
    }
    if (lower.includes("the_end") || lower.includes("end")) {
      return {
        type: "The End",
        icon: <Moon size={20} className="text-purple-400" />,
        badgeColor: "warning",
        colorClass: "from-purple-950/20 to-indigo-950/10 border-purple-500/20",
      };
    }
    return {
      type: "Overworld",
      icon: <Compass size={20} className="text-emerald-400" />,
      badgeColor: "success",
      colorClass: "from-emerald-950/20 to-teal-950/10 border-emerald-500/20",
    };
  };

  const totalSizeMb = worlds.reduce((acc, curr) => acc + (curr.size_mb || 0), 0);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2.5">
            <Globe className="text-emerald-400" size={26} />
            World Explorer
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Explore server world folders, storage footprint, and dimension data
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleWorldBackup("all")}
            disabled={backingUp !== null}
            className="btn btn-primary flex items-center gap-2"
          >
            {backingUp !== null ? (
              <Spinner size={16} />
            ) : (
              <Archive size={16} />
            )}
            Backup Worlds
          </button>

          <button
            onClick={fetchWorlds}
            disabled={loading}
            className="btn btn-secondary btn-icon"
            title="Refresh worlds"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Globe className="text-emerald-400" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {worlds.length}
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Total Dimensions / Worlds
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="text-blue-400" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {totalSizeMb.toFixed(1)} MB
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              World Storage Size
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Compass className="text-purple-400" size={24} />
          </div>
          <div className="overflow-hidden">
            <div className="text-lg font-bold text-purple-400 truncate">
              {levelName}
            </div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)]">
              Primary Level (level-name)
            </div>
          </div>
        </div>
      </div>

      {/* Worlds List */}
      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Scanning world directories...
          </p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchWorlds} />
      ) : worlds.length === 0 ? (
        <EmptyState
          title="No Worlds Found"
          description="Could not locate world directories. Make sure the Paper server has run at least once."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {worlds.map((world) => {
            const info = getWorldType(world.name);
            return (
              <div
                key={world.name}
                className={`card p-5 flex flex-col justify-between bg-gradient-to-br ${info.colorClass} border transition-all duration-200 hover:scale-[1.01]`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center">
                      {info.icon}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {world.is_primary && (
                        <Badge variant="success">Primary</Badge>
                      )}
                      <Badge variant="neutral">{info.type}</Badge>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-[var(--color-text-primary)] break-all mb-1">
                    {world.name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Dimensions & chunk files on disk
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--color-border-primary)] flex items-center justify-between">
                  <div className="text-xs font-mono text-[var(--color-text-secondary)]">
                    {world.size_mb.toFixed(1)} MB
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/files?path=${encodeURIComponent(world.name)}`}
                      className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs no-underline"
                    >
                      <FolderOpen size={13} />
                      Files
                    </Link>

                    <button
                      onClick={() => handleWorldBackup(world.name)}
                      disabled={backingUp !== null}
                      title="Create backup"
                      className="btn btn-secondary btn-sm flex items-center gap-1 text-xs"
                    >
                      <Archive size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
