/**
 * Kalisi SMP Panel — API Client
 *
 * Handles all communication with the phone agent.
 * Includes authentication, error handling, and retry logic.
 */

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("kalisi_agent_url");
    if (custom) return custom.trim().replace(/\/$/, "");
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8728";
}

export function setApiBase(url: string) {
  if (typeof window !== "undefined") {
    if (!url) {
      localStorage.removeItem("kalisi_agent_url");
    } else {
      localStorage.setItem("kalisi_agent_url", url.trim().replace(/\/$/, ""));
    }
  }
}

// ── Token Management ────────────────────────────────────

let accessToken: string | null = null;

export function setToken(token: string | null) {
  accessToken = token;
  if (token) {
    // Store in sessionStorage only (not localStorage for security)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("kalisi_token", token);
    }
  } else {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("kalisi_token");
    }
  }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("kalisi_token");
  }
  return null;
}

export function clearToken() {
  accessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("kalisi_token");
  }
}

// ── Fetch Wrapper ───────────────────────────────────────

interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

class ApiClientError extends Error {
  status: number;
  detail?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.status = error.status;
    this.detail = error.detail;
  }
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  requireAuth = true
): Promise<T> {
  const token = getToken();

  if (requireAuth && !token) {
    throw new ApiClientError({
      status: 401,
      message: "Not authenticated",
    });
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Demo / Preview Mode Fallback
  if (token === "demo-preview-token") {
    if (endpoint === "/api/auth/verify") {
      return { valid: true, username: "admin" } as T;
    }
    if (endpoint === "/api/server/health") {
      return { agent: "online", server_state: "running", timestamp: new Date().toISOString() } as T;
    }
    if (endpoint === "/api/server/status") {
      return {
        state: "running",
        pid: 14209,
        uptime_seconds: 86420,
        start_time: new Date(Date.now() - 86420000).toISOString(),
        restart_count: 0,
        crash_count: 0,
        last_crash: null,
        log_lines: 1280,
        health: { healthy: true, pid: 14209, cpu_percent: 18.4, memory_mb: 1850, status: "running" },
        metrics: { cpu_percent: 24.5, memory_percent: 48.2, memory_used_mb: 1850, memory_total_mb: 4096, disk_percent: 38.6, battery_percent: 92 },
        version: { minecraft: "1.20.4", paper: "git-Paper-498" },
        minecraft_port: 25565,
      } as T;
    }
    if (endpoint === "/api/metrics/current") {
      return { cpu_percent: 24.5, memory_percent: 48.2, memory_used_mb: 1850, memory_total_mb: 4096, disk_percent: 38.6, battery_percent: 92 } as T;
    }
    if (endpoint.startsWith("/api/console/logs")) {
      return {
        logs: [
          "[08:00:01 INFO]: Starting minecraft server version 1.20.4",
          "[08:00:01 INFO]: Loading properties",
          "[08:00:02 INFO]: Default game type: SURVIVAL",
          "[08:00:03 INFO]: Generating keypair",
          "[08:00:04 INFO]: Starting Minecraft server on *:25565",
          "[08:00:05 INFO]: [Playit.gg] Tunnel active: kalisiadudhamsmpseason2.in -> 127.0.0.1:25565",
          "[08:00:06 INFO]: Preparing level \"world\"",
          "[08:00:10 INFO]: Preparing start region for dimension minecraft:overworld",
          "[08:00:12 INFO]: [Vault] Enabling Vault v1.7.3-b131",
          "[08:00:13 INFO]: [LuckPerms] Enabling LuckPerms v5.4.102",
          "[08:00:15 INFO]: [Essentials] Enabling Essentials v2.20.1",
          "[08:00:18 INFO]: Done (17.420s)! For help, type \"help\"",
          "[08:15:32 INFO]: UUID of player KalisiKing is 7a83d4e1-2294-4f28-b0a3-f921e54c9381",
          "[08:15:32 INFO]: KalisiKing joined the game",
          "[08:24:19 INFO]: ShadowCrafter joined the game",
          "[08:42:01 INFO]: DiamondMiner99 joined the game",
          "[09:00:00 INFO]: [AutoSave] Saved the world in 12ms",
        ],
      } as T;
    }
    if (endpoint.startsWith("/api/files/list")) {
      return {
        path: ".",
        items: [
          { name: "plugins", is_dir: true, size: null, modified: "2026-10-11T08:00:00Z", is_text: false, is_plugin: false, is_protected: false },
          { name: "world", is_dir: true, size: null, modified: "2026-10-11T08:00:00Z", is_text: false, is_plugin: false, is_protected: false },
          { name: "world_nether", is_dir: true, size: null, modified: "2026-10-11T08:00:00Z", is_text: false, is_plugin: false, is_protected: false },
          { name: "world_the_end", is_dir: true, size: null, modified: "2026-10-11T08:00:00Z", is_text: false, is_plugin: false, is_protected: false },
          { name: "server.properties", is_dir: false, size: 1420, modified: "2026-10-11T08:00:00Z", is_text: true, is_plugin: false, is_protected: false },
          { name: "paper-global.yml", is_dir: false, size: 4890, modified: "2026-10-11T08:00:00Z", is_text: true, is_plugin: false, is_protected: false },
          { name: "ops.json", is_dir: false, size: 156, modified: "2026-10-11T08:00:00Z", is_text: true, is_plugin: false, is_protected: false },
          { name: "whitelist.json", is_dir: false, size: 284, modified: "2026-10-11T08:00:00Z", is_text: true, is_plugin: false, is_protected: false },
          { name: "paper.jar", is_dir: false, size: 48500000, modified: "2026-10-11T08:00:00Z", is_text: false, is_plugin: true, is_protected: true },
        ],
      } as T;
    }
    if (endpoint === "/api/plugins/list") {
      return {
        plugins: [
          { name: "EssentialsX", filename: "EssentialsX-2.20.1.jar", size_bytes: 3500000, size_mb: 3.34, modified: "2026-10-10T12:00:00Z", has_config: true, config_dir: "Essentials", appears_enabled: true },
          { name: "LuckPerms", filename: "LuckPerms-5.4.102.jar", size_bytes: 4200000, size_mb: 4.01, modified: "2026-10-10T12:00:00Z", has_config: true, config_dir: "LuckPerms", appears_enabled: true },
          { name: "Vault", filename: "Vault-1.7.3.jar", size_bytes: 420000, size_mb: 0.4, modified: "2026-10-10T12:00:00Z", has_config: false, config_dir: null, appears_enabled: true },
          { name: "WorldEdit", filename: "WorldEdit-7.2.15.jar", size_bytes: 5100000, size_mb: 4.86, modified: "2026-10-10T12:00:00Z", has_config: true, config_dir: "WorldEdit", appears_enabled: true },
          { name: "Chunky", filename: "Chunky-1.3.92.jar", size_bytes: 850000, size_mb: 0.81, modified: "2026-10-10T12:00:00Z", has_config: true, config_dir: "Chunky", appears_enabled: false },
        ],
      } as T;
    }
    if (endpoint === "/api/players/online") {
      return { online: ["KalisiKing", "ShadowCrafter", "DiamondMiner99"], count: 3, max: 20 } as T;
    }
    if (endpoint === "/api/whitelist/list") {
      return { whitelist: [{ name: "KalisiKing", uuid: "7a83d4e1-2294-4f28-b0a3-f921e54c9381" }, { name: "ShadowCrafter", uuid: "bb92147f-1329-41aa-8521-39e4a8b7c4d2" }] } as T;
    }
    if (endpoint === "/api/ops/list") {
      return { ops: [{ name: "KalisiKing", level: 4, uuid: "7a83d4e1-2294-4f28-b0a3-f921e54c9381" }] } as T;
    }
    if (endpoint === "/api/worlds/list") {
      return {
        worlds: [
          { name: "world", size_bytes: 420000000, size_mb: 420.5, is_primary: true },
          { name: "world_nether", size_bytes: 180000000, size_mb: 180.2, is_primary: false },
          { name: "world_the_end", size_bytes: 75000000, size_mb: 75.0, is_primary: false },
        ],
        level_name: "world",
      } as T;
    }
    if (endpoint === "/api/backups/list") {
      return {
        backups: [
          { id: 1, filename: "backup_full_2026-10-10_04-00-00.zip", created_at: "2026-10-10T04:00:00Z", size_bytes: 650000000, size_mb: 650.0, backup_type: "full", exists_on_disk: true, status: "completed", worlds: "all", notes: null },
          { id: 2, filename: "backup_worlds_2026-10-11_02-00-00.zip", created_at: "2026-10-11T02:00:00Z", size_bytes: 520000000, size_mb: 520.0, backup_type: "worlds", exists_on_disk: true, status: "completed", worlds: "world", notes: null },
        ],
      } as T;
    }
    if (endpoint === "/api/settings/properties") {
      return {
        properties: {
          "server-port": "25565",
          "motd": "§aKalisi SMP Season 2 §7• §eWelcome to the Adventure!",
          "max-players": "20",
          "difficulty": "normal",
          "gamemode": "survival",
          "pvp": "true",
          "online-mode": "false",
          "white-list": "false",
          "view-distance": "6",
          "simulation-distance": "4",
          "enable-command-block": "true",
        },
      } as T;
    }
    if (endpoint.startsWith("/api/audit/logs")) {
      return {
        logs: [
          { id: 1, action: "server_start", user: "admin", ip: "127.0.0.1", details: "Server started with PID 14209", timestamp: "2026-10-11T08:00:00Z" },
          { id: 2, action: "command_exec", user: "admin", ip: "127.0.0.1", details: "Executed /say Welcome to Kalisi SMP!", timestamp: "2026-10-11T08:15:00Z" },
          { id: 3, action: "plugin_toggle", user: "admin", ip: "127.0.0.1", details: "Toggled Chunky plugin", timestamp: "2026-10-11T08:30:00Z" },
        ],
      } as T;
    }
    if (endpoint.startsWith("/api/moderation/history")) {
      return {
        history: [
          { player: "Griefer_X", action: "ban", reason: "Griefing spawn area", timestamp: "2026-10-10T14:22:00Z" },
          { player: "Spammer12", action: "kick", reason: "Spamming chat", timestamp: "2026-10-10T18:05:00Z" },
        ],
      } as T;
    }
    return { success: true, message: "Demo action executed successfully" } as T;
  }

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new ApiClientError({
        status: 401,
        message: "Session expired",
      });
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiClientError({
        status: res.status,
        message: data.detail || data.error || `Request failed (${res.status})`,
        detail: data.detail,
      });
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof ApiClientError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiClientError({
        status: 408,
        message: "Request timed out. Is the phone agent online?",
      });
    }
    throw new ApiClientError({
      status: 0,
      message: "Connection failed. Phone agent may be offline.",
      detail: (err as Error).message,
    });
  }
}

// ── Auth ────────────────────────────────────────────────

export async function login(username: string, password: string) {
  const data = await apiFetch<{
    access_token: string;
    expires_in: number;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }, false);

  setToken(data.access_token);
  return data;
}

export async function verifyAuth() {
  return apiFetch<{ valid: boolean; username: string }>("/api/auth/verify");
}

// ── Server ──────────────────────────────────────────────

export interface ServerStatus {
  state: string;
  pid: number | null;
  uptime_seconds: number | null;
  start_time: string | null;
  restart_count: number;
  crash_count: number;
  last_crash: string | null;
  log_lines: number;
  health: {
    healthy: boolean;
    pid?: number;
    cpu_percent?: number;
    memory_mb?: number;
    status?: string;
    externally_managed?: boolean;
  };
  metrics: Record<string, number | string | boolean | null>;
  version: { minecraft: string; paper: string };
  minecraft_port: number;
}

export async function getServerStatus() {
  return apiFetch<ServerStatus>("/api/server/status");
}

export async function startServer() {
  return apiFetch<{ success: boolean; pid?: number; message?: string; error?: string }>(
    "/api/server/start",
    { method: "POST" }
  );
}

export async function stopServer() {
  return apiFetch<{ success: boolean; message?: string; error?: string }>(
    "/api/server/stop",
    { method: "POST" }
  );
}

export async function restartServer() {
  return apiFetch<{ success: boolean; message?: string; error?: string }>(
    "/api/server/restart",
    { method: "POST" }
  );
}

export async function healthCheck() {
  return apiFetch<{ agent: string; server_state: string; timestamp: string }>(
    "/api/server/health",
    {},
    false
  );
}

// ── Console ─────────────────────────────────────────────

export async function getConsoleLogs(lines = 200) {
  return apiFetch<{ logs: string[] }>(`/api/console/logs?lines=${lines}`);
}

export async function sendCommand(command: string) {
  return apiFetch<{ success: boolean; message?: string; error?: string; command?: string }>(
    "/api/console/command",
    { method: "POST", body: JSON.stringify({ command }) }
  );
}

export function createConsoleWebSocket(): WebSocket | null {
  const token = getToken();
  if (!token) return null;

  const wsUrl = getApiBase().replace(/^http/, "ws");
  return new WebSocket(`${wsUrl}/api/console/ws?token=${token}`);
}

// ── Metrics ─────────────────────────────────────────────

export async function getCurrentMetrics() {
  return apiFetch<Record<string, number | string | boolean | null>>("/api/metrics/current");
}

export async function getMetricsHistory(limit = 100) {
  return apiFetch<{ metrics: Record<string, unknown>[] }>(`/api/metrics/history?limit=${limit}`);
}

// ── Files ───────────────────────────────────────────────

export interface FileItem {
  name: string;
  is_dir: boolean;
  size: number | null;
  modified: string;
  is_text: boolean;
  is_plugin: boolean;
  is_protected: boolean;
}

export async function listFiles(path = ".") {
  return apiFetch<{ path: string; items: FileItem[] }>(`/api/files/list?path=${encodeURIComponent(path)}`);
}

export async function readFile(path: string) {
  return apiFetch<{ path: string; content: string; size: number }>(`/api/files/read?path=${encodeURIComponent(path)}`);
}

export async function writeFile(path: string, content: string, createBackup = true) {
  return apiFetch<{ success: boolean; path: string }>("/api/files/write", {
    method: "POST",
    body: JSON.stringify({ path, content, create_backup: createBackup }),
  });
}

export async function uploadFile(path: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ success: boolean; path: string; size: number }>(
    `/api/files/upload?path=${encodeURIComponent(path)}`,
    { method: "POST", body: formData }
  );
}

export async function downloadFile(path: string) {
  const token = getToken();
  const res = await fetch(`${getApiBase()}/api/files/download?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Download failed");
  return res.blob();
}

export async function createDirectory(path: string, name: string) {
  return apiFetch<{ success: boolean; path: string }>("/api/files/mkdir", {
    method: "POST",
    body: JSON.stringify({ path, name }),
  });
}

export async function renameFile(path: string, newName: string) {
  return apiFetch<{ success: boolean; new_name: string }>("/api/files/rename", {
    method: "POST",
    body: JSON.stringify({ path, new_name: newName }),
  });
}

export async function deleteFile(path: string) {
  return apiFetch<{ success: boolean }>("/api/files/delete", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

// ── Plugins ─────────────────────────────────────────────

export interface Plugin {
  name: string;
  filename: string;
  size_bytes: number;
  size_mb: number;
  modified: string;
  has_config: boolean;
  config_dir: string | null;
  appears_enabled: boolean;
}

export async function listPlugins() {
  return apiFetch<{ plugins: Plugin[] }>("/api/plugins/list");
}

export async function uploadPlugin(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ success: boolean; filename: string; restart_required: boolean; message: string }>(
    "/api/plugins/upload",
    { method: "POST", body: formData }
  );
}

export async function togglePlugin(filename: string) {
  return apiFetch<{ success: boolean; action: string; new_filename: string; restart_required: boolean; message: string }>(
    "/api/plugins/toggle",
    { method: "POST", body: JSON.stringify({ filename }) }
  );
}

// ── Players ─────────────────────────────────────────────

export async function getOnlinePlayers() {
  return apiFetch<{ online: string[]; count: number; max: number; server_offline?: boolean }>("/api/players/online");
}

export async function getAllPlayers(limit = 100, offset = 0, search?: string) {
  let url = `/api/players/all?limit=${limit}&offset=${offset}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return apiFetch<{ players: Record<string, unknown>[] }>(url);
}

export async function getPlayerInfo(uuid: string) {
  return apiFetch<{ player: Record<string, unknown>; moderation_history: Record<string, unknown>[] }>(`/api/players/${uuid}`);
}

// ── Moderation ──────────────────────────────────────────

export async function kickPlayer(player: string, reason: string) {
  return apiFetch<{ success: boolean; error?: string }>("/api/moderation/kick", {
    method: "POST",
    body: JSON.stringify({ player, reason }),
  });
}

export async function banPlayer(player: string, reason: string) {
  return apiFetch<{ success: boolean; error?: string }>("/api/moderation/ban", {
    method: "POST",
    body: JSON.stringify({ player, reason }),
  });
}

export async function unbanPlayer(player: string, reason: string) {
  return apiFetch<{ success: boolean; error?: string }>("/api/moderation/unban", {
    method: "POST",
    body: JSON.stringify({ player, reason: reason || "Unbanned" }),
  });
}

export async function getModerationHistory(player?: string, limit = 100) {
  let url = `/api/moderation/history?limit=${limit}`;
  if (player) url += `&player=${encodeURIComponent(player)}`;
  return apiFetch<{ history: Record<string, unknown>[] }>(url);
}

// ── Permissions ─────────────────────────────────────────

export async function grantOp(player: string) {
  return apiFetch<{ success: boolean }>("/api/permissions/op", {
    method: "POST",
    body: JSON.stringify({ player }),
  });
}

export async function revokeOp(player: string) {
  return apiFetch<{ success: boolean }>("/api/permissions/deop", {
    method: "POST",
    body: JSON.stringify({ player }),
  });
}

export async function addToWhitelist(player: string) {
  return apiFetch<{ success: boolean }>("/api/whitelist/add", {
    method: "POST",
    body: JSON.stringify({ player }),
  });
}

export async function removeFromWhitelist(player: string) {
  return apiFetch<{ success: boolean }>("/api/whitelist/remove", {
    method: "POST",
    body: JSON.stringify({ player }),
  });
}

export async function getWhitelist() {
  return apiFetch<{ whitelist: Record<string, unknown>[] }>("/api/whitelist/list");
}

export async function getOps() {
  return apiFetch<{ ops: Record<string, unknown>[] }>("/api/ops/list");
}

// ── Worlds ──────────────────────────────────────────────

export async function listWorlds() {
  return apiFetch<{ worlds: { name: string; size_bytes: number; size_mb: number; is_primary: boolean }[]; level_name: string }>("/api/worlds/list");
}

// ── Backups ─────────────────────────────────────────────

export interface Backup {
  id: number;
  filename: string;
  created_at: string;
  size_bytes: number;
  size_mb?: number;
  backup_type: string;
  worlds: string | null;
  status: string;
  notes: string | null;
  exists_on_disk: boolean;
}

export async function listBackups() {
  return apiFetch<{ backups: Backup[] }>("/api/backups/list");
}

export async function createBackup(worldsOnly = false) {
  return apiFetch<{ success: boolean; filename?: string; size_bytes?: number; size_mb?: number; error?: string }>(
    "/api/backups/create",
    { method: "POST", body: JSON.stringify({ worlds_only: worldsOnly }) }
  );
}

export async function restoreBackup(filename: string) {
  return apiFetch<{ success: boolean; message?: string; error?: string; recovery_backup?: string }>(
    "/api/backups/restore",
    { method: "POST", body: JSON.stringify({ filename }) }
  );
}

export async function deleteBackup(filename: string) {
  return apiFetch<{ success: boolean; message?: string; error?: string }>(
    "/api/backups/delete",
    { method: "POST", body: JSON.stringify({ filename }) }
  );
}

// ── Settings ────────────────────────────────────────────

export async function getServerProperties() {
  return apiFetch<{ properties: Record<string, string> }>("/api/settings/properties");
}

export async function updateServerProperty(key: string, value: string) {
  return apiFetch<{ success: boolean; needs_restart?: boolean; message?: string; warning?: boolean; error?: string; requires_confirmation?: boolean }>(
    "/api/settings/properties",
    { method: "POST", body: JSON.stringify({ key, value }) }
  );
}

// ── Audit Logs ──────────────────────────────────────────

export async function getAuditLogs(limit = 100, offset = 0, action?: string) {
  let url = `/api/audit/logs?limit=${limit}&offset=${offset}`;
  if (action) url += `&action=${encodeURIComponent(action)}`;
  return apiFetch<{ logs: Record<string, unknown>[] }>(url);
}

// ── Player Actions ──────────────────────────────────────

export async function changeGamemode(player: string, mode: string) {
  return apiFetch<{ success: boolean }>("/api/actions/gamemode", {
    method: "POST",
    body: JSON.stringify({ player, value: mode }),
  });
}

export async function sendPrivateMessage(player: string, message: string) {
  return apiFetch<{ success: boolean }>("/api/actions/message", {
    method: "POST",
    body: JSON.stringify({ player, value: message }),
  });
}
