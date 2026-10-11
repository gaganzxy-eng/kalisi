"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Send,
  Trash2,
  ArrowDown,
  ArrowUp,
  Search,
  Wifi,
  WifiOff,
  History,
  RefreshCw,
} from "lucide-react";
import { getConsoleLogs, sendCommand, createConsoleWebSocket } from "@/lib/api";
import { useToast, Badge } from "@/components/ui";

function classifyLogLine(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes("error") || lower.includes("exception") || lower.includes("fatal"))
    return "console-line-error";
  if (lower.includes("warn")) return "console-line-warn";
  if (lower.includes("[panel]") || lower.includes("[panel/admin]"))
    return "console-line-command";
  if (lower.includes("info")) return "console-line-info";
  return "";
}

export default function ConsolePage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchLogs = useCallback(async (showToast = false) => {
    try {
      setRefreshing(true);
      const data = await getConsoleLogs(500);
      if (data?.logs?.length) {
        setLogs(data.logs);
      }
      if (showToast) {
        addToast("success", `Fetched ${data?.logs?.length || 0} log lines`);
      }
    } catch (e) {
      if (showToast) {
        addToast("error", "Failed to fetch logs from phone agent");
      }
    } finally {
      setRefreshing(false);
    }
  }, [addToast]);

  // Initial and periodic polling fallback
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      // Keep pulling recent logs every 3 seconds if websocket is not active
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // WebSocket connection for real-time push
  useEffect(() => {
    const connectWs = () => {
      try {
        const ws = createConsoleWebSocket();
        if (!ws) return;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          setTimeout(connectWs, 5000);
        };
        ws.onerror = () => setConnected(false);
        ws.onmessage = (event) => {
          if (event.data) {
            setLogs((prev) => {
              const newLogs = [...prev, event.data];
              if (newLogs.length > 2000) return newLogs.slice(-1500);
              return newLogs;
            });
          }
        };

        wsRef.current = ws;
      } catch {
        setConnected(false);
      }
    };

    connectWs();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = async () => {
    if (!command.trim()) return;
    setSending(true);

    try {
      const result = await sendCommand(command.trim());
      if (result.success) {
        setCommandHistory((prev) => [command.trim(), ...prev].slice(0, 50));
        setCommand("");
        setHistoryIndex(-1);
      } else {
        addToast("error", result.error || "Failed to send command");
      }
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  const filteredLogs = searchQuery
    ? logs.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : logs;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Console
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Live server logs and command interface
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "success" : "info"}>
            {connected ? (
              <><Wifi size={12} className="mr-1" /> Live (WS)</>
            ) : (
              <><RefreshCw size={12} className={`mr-1 ${refreshing ? "animate-spin-slow" : ""}`} /> Polling (HTTP)</>
            )}
          </Badge>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-2 p-3 rounded-t-xl"
        style={{
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderBottom: "none",
        }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            className="input text-sm"
            style={{ paddingLeft: "2rem", height: "2rem" }}
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin-slow" : ""} />
          Refresh
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setAutoScroll(!autoScroll)}
        >
          {autoScroll ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setLogs([])}
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>

      {/* Console Output */}
      <div
        ref={consoleRef}
        className="console-output"
        style={{
          borderRadius: "0",
          border: "1px solid var(--color-border-primary)",
          height: "55vh",
          minHeight: "300px",
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ color: "var(--color-text-muted)" }}>
            {searchQuery ? "No matching log lines" : "No logs yet. Start the server to see output."}
          </div>
        ) : (
          filteredLogs.map((line, i) => (
            <div key={i} className={`console-line ${classifyLogLine(line)}`}>
              {line}
            </div>
          ))
        )}
      </div>

      {/* Command Input */}
      <div
        className="flex items-center gap-2 p-3 rounded-b-xl"
        style={{
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderTop: "none",
        }}
      >
        <span className="text-sm font-mono font-bold" style={{ color: "var(--color-accent)" }}>
          $
        </span>
        <input
          ref={inputRef}
          className="input flex-1"
          style={{ background: "transparent", border: "none", padding: "0.25rem" }}
          placeholder="Enter a Minecraft command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSendCommand}
          disabled={!command.trim() || sending}
        >
          {sending ? <RefreshCw size={14} className="animate-spin-slow" /> : <Send size={14} />}
          Send
        </button>
      </div>
    </div>
  );
}
