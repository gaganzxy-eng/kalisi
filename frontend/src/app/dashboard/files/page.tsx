"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FolderOpen,
  FileText,
  File,
  ChevronRight,
  Home,
  Upload,
  FolderPlus,
  Download,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  ArrowLeft,
  RefreshCw,
  Shield,
  AlertTriangle,
} from "lucide-react";
import {
  listFiles,
  readFile,
  writeFile,
  uploadFile,
  downloadFile,
  createDirectory,
  renameFile,
  deleteFile,
  FileItem,
} from "@/lib/api";
import { useToast, ConfirmDialog, EmptyState, ErrorState, Spinner, Badge } from "@/components/ui";

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(item: FileItem) {
  if (item.is_dir) return <FolderOpen size={18} style={{ color: "#f59e0b" }} />;
  if (item.is_plugin) return <File size={18} style={{ color: "#a855f7" }} />;
  if (item.is_text) return <FileText size={18} style={{ color: "#3b82f6" }} />;
  return <File size={18} style={{ color: "var(--color-text-muted)" }} />;
}

export default function FileManagerPage() {
  const { addToast } = useToast();
  const [currentPath, setCurrentPath] = useState(".");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Editor state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFiles(path);
      setItems(data.items);
      setCurrentPath(path);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(".");
  }, [fetchFiles]);

  const navigateTo = (path: string) => {
    setEditingFile(null);
    fetchFiles(path);
  };

  const navigateUp = () => {
    if (currentPath === ".") return;
    const parts = currentPath.split("/");
    parts.pop();
    navigateTo(parts.length === 0 ? "." : parts.join("/"));
  };

  const handleOpenFile = async (item: FileItem) => {
    if (item.is_dir) {
      const newPath = currentPath === "." ? item.name : `${currentPath}/${item.name}`;
      navigateTo(newPath);
      return;
    }

    if (!item.is_text) {
      addToast("info", "Use the download button for binary files");
      return;
    }

    setEditorLoading(true);
    const filePath = currentPath === "." ? item.name : `${currentPath}/${item.name}`;
    try {
      const data = await readFile(filePath);
      setEditorContent(data.content);
      setEditingFile(filePath);
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await writeFile(editingFile, editorContent);
      addToast("success", "File saved successfully");
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(currentPath, file);
      addToast("success", `Uploaded ${file.name}`);
      fetchFiles(currentPath);
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    }
    e.target.value = "";
  };

  const handleDownload = async (item: FileItem) => {
    const filePath = currentPath === "." ? item.name : `${currentPath}/${item.name}`;
    try {
      const blob = await downloadFile(filePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFile(deleteTarget);
      addToast("success", "Deleted successfully");
      fetchFiles(currentPath);
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    }
    setDeleteTarget(null);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createDirectory(currentPath, newFolderName.trim());
      addToast("success", `Created folder: ${newFolderName}`);
      setShowNewFolder(false);
      setNewFolderName("");
      fetchFiles(currentPath);
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameFile(renameTarget, renameValue.trim());
      addToast("success", "Renamed successfully");
      setRenameTarget(null);
      setRenameValue("");
      fetchFiles(currentPath);
    } catch (err: unknown) {
      addToast("error", (err as Error).message);
    }
  };

  // Breadcrumbs
  const pathParts = currentPath === "." ? [] : currentPath.split("/");

  const filteredItems = searchQuery
    ? items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  // Editor view
  if (editingFile) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingFile(null)}>
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
              {editingFile.split("/").pop()}
            </h2>
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{editingFile}</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSaveFile} disabled={saving}>
            {saving ? <RefreshCw size={14} className="animate-spin-slow" /> : <Save size={14} />}
            Save
          </button>
        </div>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-border-primary)" }}
        >
          <textarea
            className="w-full p-4 font-mono text-sm resize-none outline-none"
            style={{
              background: "#0a0c10",
              color: "var(--color-text-primary)",
              minHeight: "65vh",
              lineHeight: "1.6",
              tabSize: 2,
            }}
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            File Manager
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Manage server files and configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn btn-primary btn-sm cursor-pointer">
            <Upload size={14} /> Upload
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowNewFolder(true)}>
            <FolderPlus size={14} /> New Folder
          </button>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => fetchFiles(currentPath)}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div
        className="flex items-center gap-1 p-3 rounded-t-xl overflow-x-auto"
        style={{
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderBottom: "none",
        }}
      >
        <button
          className="btn btn-secondary btn-sm btn-icon shrink-0"
          onClick={() => navigateTo(".")}
        >
          <Home size={14} />
        </button>
        {pathParts.map((part, i) => (
          <React.Fragment key={i}>
            <ChevronRight size={14} style={{ color: "var(--color-text-muted)" }} />
            <button
              className="text-sm font-medium px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-hover)] shrink-0"
              style={{ color: "var(--color-text-secondary)" }}
              onClick={() => navigateTo(pathParts.slice(0, i + 1).join("/"))}
            >
              {part}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Search */}
      <div
        className="p-3"
        style={{
          background: "var(--color-bg-secondary)",
          borderLeft: "1px solid var(--color-border-primary)",
          borderRight: "1px solid var(--color-border-primary)",
        }}
      >
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            className="input text-sm"
            style={{ paddingLeft: "2rem" }}
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* File List */}
      <div
        className="rounded-b-xl overflow-hidden"
        style={{
          border: "1px solid var(--color-border-primary)",
          background: "var(--color-bg-secondary)",
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchFiles(currentPath)} />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={32} style={{ color: "var(--color-text-muted)" }} />}
            title="Empty directory"
            description={searchQuery ? "No files match your search" : "This directory is empty"}
          />
        ) : (
          <>
            {/* Back button if not root */}
            {currentPath !== "." && (
              <button
                className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-hover)]"
                style={{ borderBottom: "1px solid var(--color-border-primary)" }}
                onClick={navigateUp}
              >
                <ArrowLeft size={18} style={{ color: "var(--color-text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>..</span>
              </button>
            )}

            {filteredItems.map((item) => {
              const fullPath = currentPath === "." ? item.name : `${currentPath}/${item.name}`;
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-bg-hover)] group cursor-pointer"
                  style={{ borderBottom: "1px solid var(--color-border-primary)" }}
                  onClick={() => handleOpenFile(item)}
                >
                  {getFileIcon(item)}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {item.name}
                      {item.is_protected && (
                        <Shield
                          size={12}
                          className="inline ml-1.5"
                          style={{ color: "var(--color-warning)" }}
                        />
                      )}
                    </p>
                  </div>
                  <span className="text-xs shrink-0 hidden sm:block" style={{ color: "var(--color-text-muted)" }}>
                    {item.is_dir ? "—" : formatFileSize(item.size)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.is_dir && (
                      <button
                        className="btn btn-secondary btn-icon btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    )}
                    <button
                      className="btn btn-secondary btn-icon btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(fullPath);
                        setRenameValue(item.name);
                      }}
                      title="Rename"
                    >
                      <Edit3 size={14} />
                    </button>
                    {!item.is_protected && (
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(fullPath); }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* New Folder Dialog */}
      {showNewFolder && (
        <div className="modal-overlay" onClick={() => setShowNewFolder(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
              Create New Folder
            </h3>
            <input
              className="input mb-4"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setShowNewFolder(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {renameTarget && (
        <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
              Rename
            </h3>
            <input
              className="input mb-4"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRename}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete File"
        message="Are you sure you want to delete this? This action cannot be undone."
        confirmText="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
