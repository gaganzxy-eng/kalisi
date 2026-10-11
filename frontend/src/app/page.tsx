"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sword,
  Terminal,
  Cpu,
  Shield,
  FolderOpen,
  Puzzle,
  Archive,
  Users,
  Activity,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  Wifi,
  Sparkles,
  Copy,
  Check,
  Key,
  Smartphone,
  Radio,
  Server,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { getOnlinePlayers } from "@/lib/api";

export default function Home() {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<{
    online: string[];
    count: number;
    max: number;
    is_online: boolean;
  }>({
    online: [],
    count: 0,
    max: 20,
    is_online: false,
  });

  const updateServerStatus = () => {
    fetch("https://api.mcsrvstat.us/3/fried-jarvis.tun.ply.gg", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.online === "boolean") {
          const isOnline = data.online;
          const count = data.players?.online || 0;
          const max = data.players?.max || 20;
          const list = (data.players?.list || []).map((p: unknown) =>
            typeof p === "string" ? p : (p as { name?: string })?.name || "Player"
          );
          setPlayerData({
            online: list,
            count: isOnline ? count : 0,
            max: max,
            is_online: isOnline,
          });
        }
      })
      .catch(() => {
        getOnlinePlayers()
          .then((data) => {
            if (data && data.count !== undefined) {
              setPlayerData({
                online: data.online || [],
                count: data.count,
                max: data.max || 20,
                is_online: !data.server_offline,
              });
            }
          })
          .catch(() => {});
      });
  };

  useEffect(() => {
    updateServerStatus();
    const interval = setInterval(updateServerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Top Navigation */}
      <header className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sword size={22} className="text-zinc-950" strokeWidth={2.5} />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block">
                KALISI SMP
              </span>
              <span className="text-[0.65rem] font-semibold text-emerald-400 uppercase tracking-widest block">
                Season 2 • Phone Host
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Player Pill in Header */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono ${
              playerData.is_online
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-zinc-800/60 border-zinc-700/40 text-zinc-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${playerData.is_online ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
              <span>
                {playerData.is_online ? `${playerData.count} / ${playerData.max} Players Online` : "Server Offline"}
              </span>
            </div>

            <Link
              href="/login"
              className="btn btn-secondary text-xs sm:text-sm flex items-center gap-2 no-underline"
            >
              Log In
            </Link>

            <Link
              href="/dashboard"
              className="btn btn-primary text-xs sm:text-sm flex items-center gap-2 no-underline shadow-lg shadow-emerald-500/20"
            >
              Control Panel
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 mb-6 animate-fade-in">
          <Sparkles size={14} className="text-emerald-400" />
          <span>PaperMC Java Dedicated Server • Android Termux Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl leading-[1.1] mb-6 text-white">
          The Ultimate Control Panel for{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Kalisi SMP
          </span>
        </h1>

        <p className="text-base sm:text-lg text-[var(--color-text-secondary)] max-w-2xl mb-8 leading-relaxed">
          Production-grade Minecraft Java management running directly on an Android OPPO phone in Termux.
          Real-time process control, console streaming, backups, and live player moderation.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
          <Link
            href="/dashboard"
            className="btn btn-primary text-base px-8 py-3.5 flex items-center gap-2.5 rounded-xl shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transform hover:-translate-y-0.5 transition-all no-underline"
          >
            Launch Dashboard
            <ArrowRight size={18} />
          </Link>

          <Link
            href="/login"
            className="btn btn-secondary text-base px-8 py-3.5 flex items-center gap-2.5 rounded-xl transition-all no-underline"
          >
            <Key size={18} />
            Admin Login
          </Link>
        </div>

        {/* ── LIVE PLAYERS & SERVER STATUS BANNER ── */}
        <div className="w-full max-w-4xl mb-16">
          <div className="card p-6 border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-[var(--color-bg-secondary)] to-teal-950/20 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-left">
              {/* Left: Player Count & Heads */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                  <Users className="text-emerald-400" size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${playerData.is_online ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${playerData.is_online ? "text-emerald-400" : "text-amber-400"}`}>
                      {playerData.is_online ? "Live Server Online" : "Server Offline (Sleeping on Phone)"}
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                    {playerData.is_online ? (
                      <>
                        {playerData.count}{" "}
                        <span className="text-base font-normal text-[var(--color-text-muted)]">
                          / {playerData.max} Players Online
                        </span>
                      </>
                    ) : (
                      <span className="text-lg sm:text-xl font-bold text-zinc-300">
                        0 / {playerData.max} Players (Offline)
                      </span>
                    )}
                  </div>
                  {/* Player Avatars */}
                  {playerData.online.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex -space-x-2">
                        {playerData.online.slice(0, 5).map((player) => (
                          <img
                            key={player}
                            src={`https://mc-heads.net/avatar/${player}/24`}
                            alt={player}
                            title={player}
                            className="w-6 h-6 rounded-md border border-[var(--color-bg-primary)] bg-zinc-800"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {playerData.online.slice(0, 3).join(", ")}
                        {playerData.online.length > 3 ? "..." : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Server Address Box with Copy Button */}
              <div className="bg-[var(--color-bg-primary)]/80 border border-[var(--color-border-primary)] rounded-xl p-3 sm:p-4 flex items-center justify-between gap-4 w-full md:w-auto">
                <div>
                  <span className="text-[0.65rem] uppercase font-semibold text-[var(--color-text-muted)] block">
                    Server Address (Playit.gg Java)
                  </span>
                  <span className="font-mono text-sm font-bold text-emerald-300">
                    fried-jarvis.tun.ply.gg
                  </span>
                  <span className="text-[0.65rem] text-[var(--color-text-muted)] block mt-0.5">
                    or kalisiadudhamsmpseason2.in
                  </span>
                </div>
                <button
                  onClick={() =>
                    handleCopy("fried-jarvis.tun.ply.gg", "ip")
                  }
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs py-1.5 px-3 shrink-0"
                  title="Copy Server IP"
                >
                  {copiedText === "ip" ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copy IP
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: HOW TO LOGIN TO ADMIN PANEL ── */}
        <div className="w-full max-w-4xl mb-16 text-left">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Key size={18} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                How to Log In to the Admin Panel
              </h2>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                Access server controls, console, file editor, and backups
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/60">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-sm mb-3">
                1
              </div>
              <h3 className="font-bold text-white text-base mb-1">
                Open Login Page
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                Click the <strong>Log In</strong> button in the navigation header or open{" "}
                <code className="text-emerald-400 font-mono">/login</code>.
              </p>
              <Link
                href="/login"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                Go to Login Page <ChevronRight size={12} />
              </Link>
            </div>

            <div className="card p-5 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/60">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center text-sm mb-3">
                2
              </div>
              <h3 className="font-bold text-white text-base mb-1">
                Enter Credentials
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                Use your administrator account configured on your phone:
              </p>
              <div className="bg-[var(--color-bg-primary)] p-2.5 rounded-lg border border-[var(--color-border-primary)] text-xs font-mono space-y-1">
                <div>
                  <span className="text-[var(--color-text-muted)]">User: </span>
                  <span className="text-emerald-300 font-bold">admin</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Pass: </span>
                  <span className="text-amber-300">Set in phone .env</span>
                </div>
              </div>
            </div>

            <div className="card p-5 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/60">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center text-sm mb-3">
                3
              </div>
              <h3 className="font-bold text-white text-base mb-1">
                Instant Demo Mode
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                Want to test the panel without turning on your phone? Click the{" "}
                <strong>Explore in Demo Mode</strong> button on the login screen.
              </p>
              <Link
                href="/login"
                className="text-xs text-purple-400 hover:underline flex items-center gap-1"
              >
                Try Demo Preview <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: HOW TO CONNECT TERMUX TO THIS WEBSITE ── */}
        <div className="w-full max-w-4xl mb-20 text-left">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone size={18} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                How to Connect Your Phone (Termux) to This Website
              </h2>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                Connect your OPPO Android phone running PaperMC to the live panel
              </p>
            </div>
          </div>

          <div className="card p-6 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50 divide-y divide-[var(--color-border-primary)]">
            {/* Step 1 */}
            <div className="pb-5">
              <div className="flex items-start gap-3.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </span>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-white">
                    Start the Agent on Your Phone (Termux)
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-3">
                    Open Termux on your OPPO phone and run the start script. This launches the Python FastAPI server on local port 8728 with wake-lock active:
                  </p>
                  <div className="bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-border-primary)] flex items-center justify-between">
                    <code className="text-xs font-mono text-emerald-400">
                      cd ~/craft-agent && ./start.sh
                    </code>
                    <button
                      onClick={() =>
                        handleCopy("cd ~/craft-agent && ./start.sh", "agent-cmd")
                      }
                      className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-white"
                      title="Copy command"
                    >
                      {copiedText === "agent-cmd" ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="py-5">
              <div className="flex items-start gap-3.5">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </span>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-white">
                    Start the Cloudflare Tunnel
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-3">
                    In a second Termux session, start your Cloudflare tunnel to route{" "}
                    <code className="text-blue-300 font-mono">api.kalisiadudhamsmpseason2.in</code> to your phone’s port 8728:
                  </p>
                  <div className="bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-border-primary)] flex items-center justify-between">
                    <code className="text-xs font-mono text-blue-400">
                      cloudflared tunnel run kalisi-tunnel
                    </code>
                    <button
                      onClick={() =>
                        handleCopy("cloudflared tunnel run kalisi-tunnel", "cf-cmd")
                      }
                      className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-white"
                      title="Copy command"
                    >
                      {copiedText === "cf-cmd" ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="pt-5">
              <div className="flex items-start gap-3.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </span>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-white">
                    Start Playit.gg for Game Traffic
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-3">
                    Keep Playit.gg running in Termux so players can connect to <strong className="text-amber-300 font-mono">fried-jarvis.tun.ply.gg</strong>:
                  </p>
                  <div className="bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-border-primary)] flex items-center justify-between">
                    <code className="text-xs font-mono text-amber-400">
                      playit
                    </code>
                    <button
                      onClick={() => handleCopy("playit", "playit-cmd")}
                      className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-white"
                      title="Copy command"
                    >
                      {copiedText === "playit-cmd" ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full text-left">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Full-Throttle Server Administration
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Engineered with zero compromises for maximum uptime and effortless management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-emerald-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                <Terminal size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Live WebSocket Console
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Stream server logs with microsecond latency, search outputs, and send Minecraft commands with full history navigation.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
                <FolderOpen size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                In-Browser File Editor
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Full-featured file manager with path traversal sandboxing, code editing, file uploads, and automatic file backups.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-purple-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
                <Puzzle size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Plugin Management
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Install PaperMC plugins via drag-and-drop, toggle plugins on or off without deleting them, and edit config files directly.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-amber-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                <Archive size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Safe Disaster Recovery
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Instant zip snapshots with automatic pre-restore safety snapshots that protect your worlds before any restore operation.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-rose-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
                <Shield size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Moderation & Whitelist
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Control who plays with one-click Kick and Ban tools, OP promotion, and whitelist management with player skin previews.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-cyan-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
                <Cpu size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Device Telemetry
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Live monitoring of your OPPO phone’s CPU load, RAM allocation, storage capacity, and battery health via Termux API.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-primary)] py-8 bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sword size={16} className="text-emerald-400" />
            <span className="text-[var(--color-text-secondary)] font-semibold">
              Kalisi SMP Season 2
            </span>
            <span>—</span>
            <span>Dedicated Minecraft Java Hosting Panel</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hover:text-white transition-colors no-underline"
            >
              Admin Login
            </Link>
            <Link
              href="/dashboard"
              className="hover:text-white transition-colors no-underline"
            >
              Dashboard
            </Link>
            <span className="font-mono text-emerald-400">
              kalisiadudhamsmpseason2.in
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
