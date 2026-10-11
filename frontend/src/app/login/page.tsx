"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sword, Eye, EyeOff, Loader2 } from "lucide-react";
import { login, getToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

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
              className="p-3 rounded-lg text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "#ef4444",
              }}
            >
              {error}
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
              placeholder="admin"
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
