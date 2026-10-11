"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sword, Eye, EyeOff, Loader2, Settings, Wifi, Check } from "lucide-react";
import { login, getToken, getApiBase, setApiBase } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agentUrl, setAgentUrlState] = useState("");
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [agentSaved, setAgentSaved] = useState(false);

  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
    }
    setAgentUrlState(getApiBase());
  }, [router]);

  const handleSaveAgentUrl = () => {
    setApiBase(agentUrl);
    setAgentSaved(true);
    setTimeout(() => setAgentSaved(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError((err as Error).message || "Login failed. Check your credentials.");
      setShowAgentSettings(true); // Automatically expand settings to assist
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-bg-primary)" }}
    >
      {/* Background effects */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(74, 222, 128, 0.06) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative w-full max-w-md p-8 rounded-2xl animate-fade-in"
        style={{
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow"
            style={{ background: "var(--gradient-accent)" }}
          >
            <Sword size={32} color="#0f1117" strokeWidth={2} />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Kalisi SMP
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Server Management Panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="p-3.5 rounded-xl text-xs space-y-1.5"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#f87171",
              }}
            >
              <div className="font-semibold text-red-400">{error}</div>
              <p className="text-[0.75rem] text-zinc-300">
                Target: <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">{agentUrl || "http://localhost:8728"}</code>
              </p>
              <p className="text-[0.7rem] text-zinc-400">
                If logging in from a PC, enter your phone's Wi-Fi IP (e.g. <code>http://192.168.1.X:8728</code>) or Cloudflare Tunnel URL below.
              </p>
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Username
            </label>
            <input
              type="text"
              className="input"
              placeholder="admin or Gagan"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input"
                style={{ paddingRight: "2.5rem" }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
                style={{ color: "var(--color-text-muted)" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full mt-2"
            disabled={loading}
            style={{ padding: "0.75rem" }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin-slow" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.setItem("kalisi_token", "demo-preview-token");
              }
              router.push("/dashboard");
            }}
            className="btn btn-secondary w-full text-xs flex items-center justify-center gap-1.5 py-2.5 mt-2"
          >
            <span>Explore in Demo / Preview Mode</span>
          </button>

          {/* Agent Endpoint Config Accordion */}
          <div className="pt-2 border-t border-zinc-800/60 mt-4">
            <button
              type="button"
              onClick={() => setShowAgentSettings(!showAgentSettings)}
              className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center justify-center gap-1.5 w-full py-1 transition-colors"
            >
              <Settings size={13} />
              <span>{showAgentSettings ? "Hide Agent Settings" : "⚙️ Change Phone Agent URL"}</span>
            </button>

            {showAgentSettings && (
              <div className="mt-3 p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left space-y-2.5 animate-fade-in">
                <label className="block text-[0.7rem] font-semibold uppercase tracking-wider text-zinc-400">
                  Phone Agent API Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={agentUrl}
                    onChange={(e) => setAgentUrlState(e.target.value)}
                    placeholder="http://192.168.1.5:8728"
                    className="input text-xs py-1.5 flex-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAgentUrl}
                    className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    {agentSaved ? <Check size={13} className="text-emerald-400" /> : "Save"}
                  </button>
                </div>
                <div className="text-[0.68rem] text-zinc-400 space-y-1">
                  <p>• <strong>From PC on same Wi-Fi:</strong> Run <code className="text-emerald-300">ifconfig</code> in Termux, enter <code className="text-emerald-300">http://&lt;phone-ip&gt;:8728</code></p>
                  <p>• <strong>Over Internet:</strong> Enter your Cloudflare Tunnel URL</p>
                  <p>• <strong>Direct Phone Browser:</strong> Use <code className="text-emerald-300">http://localhost:8728</code></p>
                </div>
              </div>
            )}
          </div>
        </form>

        <p
          className="text-xs text-center mt-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          Secured by Cloudflare Access + JWT Authentication
        </p>
      </div>
    </div>
  );
}
