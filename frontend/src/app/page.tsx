import React from "react";
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
} from "lucide-react";

export default function Home() {
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
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>kalisiadudhamsmpseason2.in</span>
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
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 lg:py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 mb-8 animate-fade-in">
          <Sparkles size={14} className="text-emerald-400" />
          <span>PaperMC Java Dedicated Server • Android Termux Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl leading-[1.1] mb-6 text-white">
          The Ultimate Control Panel for{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Kalisi SMP
          </span>
        </h1>

        <p className="text-base sm:text-lg text-[var(--color-text-secondary)] max-w-2xl mb-10 leading-relaxed">
          Production-grade Minecraft Java management inspired by Pterodactyl and Aternos.
          Direct process control, live console streaming, instant backups, and multi-world exploration running seamlessly on your OPPO phone.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/dashboard"
            className="btn btn-primary text-base px-8 py-3.5 flex items-center gap-2.5 rounded-xl shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transform hover:-translate-y-0.5 transition-all no-underline"
          >
            Launch Dashboard
            <ArrowRight size={18} />
          </Link>

          <Link
            href="/dashboard/console"
            className="btn btn-secondary text-base px-8 py-3.5 flex items-center gap-2.5 rounded-xl transition-all no-underline"
          >
            <Terminal size={18} />
            Open Console
          </Link>
        </div>

        {/* System Specs Pill Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mb-20 text-left">
          <div className="card p-4 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50">
            <span className="text-xs text-[var(--color-text-muted)] block font-medium">Domain</span>
            <span className="text-sm font-bold text-white font-mono break-all">kalisiadudhamsmpseason2.in</span>
          </div>

          <div className="card p-4 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50">
            <span className="text-xs text-[var(--color-text-muted)] block font-medium">Engine</span>
            <span className="text-sm font-bold text-emerald-400">PaperMC 1.20+</span>
          </div>

          <div className="card p-4 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50">
            <span className="text-xs text-[var(--color-text-muted)] block font-medium">Tunneling</span>
            <span className="text-sm font-bold text-amber-400">Playit.gg & Cloudflare</span>
          </div>

          <div className="card p-4 border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50">
            <span className="text-xs text-[var(--color-text-muted)] block font-medium">Host Device</span>
            <span className="text-sm font-bold text-blue-400">Android OPPO (Termux)</span>
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
              <h3 className="text-lg font-bold text-white mb-2">Live WebSocket Console</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Stream server logs with microsecond latency, search outputs, and send Minecraft commands with full history navigation.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
                <FolderOpen size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">In-Browser File Editor</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Full-featured file manager with path traversal sandboxing, code editing, file uploads, and automatic file backups.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-purple-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
                <Puzzle size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Plugin Management</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Install PaperMC plugins via drag-and-drop, toggle plugins on or off without deleting them, and edit config files directly.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-amber-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                <Archive size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Safe Disaster Recovery</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Instant zip snapshots with automatic pre-restore safety snapshots that protect your worlds before any restore operation.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-rose-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
                <Shield size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Moderation & Whitelist</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Control who plays with one-click Kick and Ban tools, OP promotion, and whitelist management with player skin previews.
              </p>
            </div>

            <div className="card p-6 border border-[var(--color-border-primary)] hover:border-cyan-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
                <Cpu size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Device Telemetry</h3>
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
            <Link href="/login" className="hover:text-white transition-colors no-underline">
              Admin Login
            </Link>
            <Link href="/dashboard" className="hover:text-white transition-colors no-underline">
              Dashboard
            </Link>
            <span className="font-mono text-emerald-400">kalisiadudhamsmpseason2.in</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
