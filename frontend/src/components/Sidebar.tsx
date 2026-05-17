"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/apiClient";

interface Issue {
  issue_id: number;
  title: string | null;
  raw_input: string;
  status: string;
  folder_id: number | null;
  created_at: string;
}

interface Folder {
  folder_id: number;
  name: string;
  created_at: string;
}

function getLabel(issue: Issue) {
  return issue.title || issue.raw_input.slice(0, 20) + "…";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ── Always-dark sidebar palette (WEBDOT header style) ──────────────────────
const SB = {
  bg:         "#0b1e35",
  popup:      "#0f2a45",
  text:       "rgba(200,220,252,0.68)",
  textStrong: "rgba(220,238,255,0.95)",
  muted:      "rgba(200,220,252,0.30)",
  border:     "rgba(255,255,255,0.06)",
  hover:      "rgba(255,255,255,0.05)",
  activeBg:   "rgba(59,130,246,0.22)",
  activeText: "#93c5fd",
  dragOver:   "rgba(59,130,246,0.28)",
  handle:     "rgba(255,255,255,0.08)",
  handleHover:"#3b82f6",
  accent:     "#2563eb",
};

const ROW: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  padding: "6px 10px", borderRadius: 6, cursor: "pointer",
  transition: "background-color 0.1s", userSelect: "none",
};

// ── 이슈 Row ───────────────────────────────────────────────────────────────
interface IssueItemProps {
  issue: Issue;
  isActive: boolean;
  isMenuOpen: boolean;
  isRenaming: boolean;
  renameValue: string;
  isDragging: boolean;
  indent?: boolean;
  onNavigate: () => void;
  onMenuToggle: (e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onRenameSave: () => void;
  onRenameCancel: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRenameStart: (e: React.MouseEvent) => void;
  onRemoveFromFolder?: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

function IssueItem({
  issue, isActive, isMenuOpen, isRenaming, renameValue, isDragging, indent = false,
  onNavigate, onMenuToggle, onRenameChange, onRenameSave, onRenameCancel,
  onDelete, onRenameStart, onRemoveFromFolder, onDragStart, onDragEnd, menuRef,
}: IssueItemProps) {
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [isRenaming]);

  return (
    <li style={{ position: "relative", listStyle: "none", opacity: isDragging ? 0.4 : 1 }}>
      {isRenaming ? (
        <div style={{ padding: "4px 8px", paddingLeft: indent ? 24 : 8 }}>
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSave();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={onRenameSave}
            style={{
              width: "100%", fontSize: 12, padding: "4px 8px",
              border: "1.5px solid #3b82f6", borderRadius: 5,
              outline: "none", boxSizing: "border-box",
              color: SB.textStrong, background: SB.popup,
            }}
          />
        </div>
      ) : (
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onNavigate}
          style={{
            ...ROW,
            paddingLeft: indent ? 22 : 10,
            backgroundColor: isActive ? SB.activeBg : hovered ? SB.hover : "transparent",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontWeight: isActive ? 700 : 500, fontSize: 12, lineHeight: 1.4,
              color: isActive ? SB.activeText : SB.textStrong,
            }}>
              {getLabel(issue)}
            </span>
            <span style={{ fontSize: 10, color: SB.muted, fontFamily: "monospace" }}>
              {formatDate(issue.created_at)}
            </span>
          </div>
          <button
            aria-label="더 보기"
            onClick={onMenuToggle}
            style={{
              flexShrink: 0, width: 20, height: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, border: "none",
              background: isMenuOpen ? SB.border : "transparent",
              cursor: "pointer", padding: 0, fontSize: 13, color: SB.muted,
              visibility: hovered || isMenuOpen ? "visible" : "hidden",
            }}
          >
            ···
          </button>
        </div>
      )}

      {isMenuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute", right: 8, top: "calc(100% - 2px)",
            zIndex: 100, background: SB.popup,
            border: `1px solid ${SB.border}`, borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            padding: "4px 0", minWidth: 148,
          }}
        >
          <MenuBtn onClick={onRenameStart}>이름 바꾸기</MenuBtn>
          {onRemoveFromFolder && <MenuBtn onClick={onRemoveFromFolder}>폴더에서 제거</MenuBtn>}
          <MenuBtn onClick={onDelete} danger>삭제</MenuBtn>
        </div>
      )}
    </li>
  );
}

// ── 폴더 Row ──────────────────────────────────────────────────────────────
interface FolderItemProps {
  folder: Folder;
  issues: Issue[];
  expanded: boolean;
  isMenuOpen: boolean;
  isRenaming: boolean;
  renameValue: string;
  isDragOver: boolean;
  activeIssueId: number | null;
  onToggle: () => void;
  onMenuToggle: (e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onRenameSave: () => void;
  onRenameCancel: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRenameStart: (e: React.MouseEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  issueMenuOpenId: number | null;
  issueRenamingId: number | null;
  issueRenameValue: string;
  issueDraggingId: number | null;
  issueMenuRef: React.RefObject<HTMLDivElement | null>;
  onIssueNavigate: (id: number) => void;
  onIssueMenuToggle: (e: React.MouseEvent, id: number) => void;
  onIssueRenameChange: (v: string) => void;
  onIssueRenameSave: (id: number) => void;
  onIssueRenameCancel: () => void;
  onIssueDelete: (e: React.MouseEvent, id: number) => void;
  onIssueRenameStart: (e: React.MouseEvent, issue: Issue) => void;
  onIssueRemoveFromFolder: (e: React.MouseEvent, id: number) => void;
  onIssueDragStart: (e: React.DragEvent, id: number) => void;
  onIssueDragEnd: () => void;
  pathname: string;
}

function FolderItem({
  folder, issues, expanded, isMenuOpen, isRenaming, renameValue, isDragOver,
  onToggle, onMenuToggle, onRenameChange, onRenameSave, onRenameCancel,
  onDelete, onRenameStart, onDragOver, onDragLeave, onDrop, menuRef,
  issueMenuOpenId, issueRenamingId, issueRenameValue, issueDraggingId, issueMenuRef,
  onIssueNavigate, onIssueMenuToggle, onIssueRenameChange, onIssueRenameSave,
  onIssueRenameCancel, onIssueDelete, onIssueRenameStart, onIssueRemoveFromFolder,
  onIssueDragStart, onIssueDragEnd, pathname,
}: FolderItemProps) {
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [isRenaming]);

  return (
    <li style={{ listStyle: "none" }}>
      {isRenaming ? (
        <div style={{ padding: "4px 8px" }}>
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSave();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={onRenameSave}
            style={{
              width: "100%", fontSize: 12, padding: "4px 8px",
              border: "1.5px solid #3b82f6", borderRadius: 5,
              outline: "none", boxSizing: "border-box",
              color: SB.textStrong, background: SB.popup,
            }}
          />
        </div>
      ) : (
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={onToggle}
          style={{
            ...ROW,
            backgroundColor: isDragOver ? SB.dragOver : hovered ? SB.hover : "transparent",
            border: isDragOver ? "1px dashed #3b82f6" : "1px solid transparent",
            color: SB.textStrong,
          }}
        >
          <span style={{ fontSize: 11, marginRight: 2, color: SB.muted }}>{expanded ? "▾" : "▸"}</span>
          <span style={{ fontSize: 12, marginRight: 3 }}>📁</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: SB.text }}>
            {folder.name}
          </span>
          <span style={{ fontSize: 10, color: SB.muted, marginRight: 4 }}>{issues.length}</span>
          <button
            aria-label="폴더 더 보기"
            onClick={onMenuToggle}
            style={{
              flexShrink: 0, width: 20, height: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, border: "none",
              background: isMenuOpen ? SB.border : "transparent",
              cursor: "pointer", padding: 0, fontSize: 13, color: SB.muted,
              visibility: hovered || isMenuOpen ? "visible" : "hidden",
            }}
          >
            ···
          </button>
        </div>
      )}

      {isMenuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute", right: 8, zIndex: 100, background: SB.popup,
            border: `1px solid ${SB.border}`, borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            padding: "4px 0", minWidth: 148,
          }}
        >
          <MenuBtn onClick={onRenameStart}>이름 바꾸기</MenuBtn>
          <MenuBtn onClick={onDelete} danger>폴더 삭제</MenuBtn>
        </div>
      )}

      {expanded && issues.length > 0 && (
        <ul style={{ padding: 0, margin: 0 }}>
          {issues.map((issue) => (
            <IssueItem
              key={issue.issue_id}
              issue={issue}
              isActive={pathname === `/issues/${issue.issue_id}`}
              isMenuOpen={issueMenuOpenId === issue.issue_id}
              isRenaming={issueRenamingId === issue.issue_id}
              renameValue={issueRenameValue}
              isDragging={issueDraggingId === issue.issue_id}
              indent
              onNavigate={() => onIssueNavigate(issue.issue_id)}
              onMenuToggle={(e) => onIssueMenuToggle(e, issue.issue_id)}
              onRenameChange={onIssueRenameChange}
              onRenameSave={() => onIssueRenameSave(issue.issue_id)}
              onRenameCancel={onIssueRenameCancel}
              onDelete={(e) => onIssueDelete(e, issue.issue_id)}
              onRenameStart={(e) => onIssueRenameStart(e, issue)}
              onRemoveFromFolder={(e) => onIssueRemoveFromFolder(e, issue.issue_id)}
              onDragStart={(e) => onIssueDragStart(e, issue.issue_id)}
              onDragEnd={onIssueDragEnd}
              menuRef={issueMenuRef}
            />
          ))}
        </ul>
      )}
      {expanded && issues.length === 0 && (
        <div style={{ padding: "5px 10px 5px 28px", fontSize: 11, color: SB.muted, fontStyle: "italic" }}>
          드래그해서 추가
        </div>
      )}
    </li>
  );
}

// ── 메뉴 버튼 ─────────────────────────────────────────────────────────────
function MenuBtn({ children, onClick, danger }: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", textAlign: "left", padding: "7px 14px",
        fontSize: 12,
        color: danger ? "#f87171" : SB.textStrong,
        background: hov ? (danger ? "rgba(239,68,68,0.12)" : SB.hover) : "none",
        border: "none", cursor: "pointer", display: "block",
      }}
    >
      {children}
    </button>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 240;
const STORAGE_KEY = "sidebar-width";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [handleHovered, setHandleHovered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);
  const currentWidthRef = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n)) {
        const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
        setSidebarWidth(clamped);
        currentWidthRef.current = clamped;
      }
    }
  }, []);

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidthRef.current;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    function onMouseMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const delta = ev.clientX - startXRef.current;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      currentWidthRef.current = next;
      setSidebarWidth(next);
    }
    function onMouseUp() {
      resizingRef.current = false;
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(STORAGE_KEY, String(currentWidthRef.current));
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const [issues, setIssues] = useState<Issue[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const [issueMenuOpenId, setIssueMenuOpenId] = useState<number | null>(null);
  const [issueRenamingId, setIssueRenamingId] = useState<number | null>(null);
  const [issueRenameValue, setIssueRenameValue] = useState("");
  const issueMenuRef = useRef<HTMLDivElement>(null);

  const [folderMenuOpenId, setFolderMenuOpenId] = useState<number | null>(null);
  const [folderRenamingId, setFolderRenamingId] = useState<number | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const folderMenuRef = useRef<HTMLDivElement>(null);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const [draggingIssueId, setDraggingIssueId] = useState<number | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

  const load = useCallback(() => {
    apiClient.get("/issues?limit=20").then((r) => setIssues(r.data)).catch(() => {});
    apiClient.get("/folders").then((r) => setFolders(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [pathname, load]);

  useEffect(() => {
    if (issueMenuOpenId === null && folderMenuOpenId === null) return;
    function handler(e: MouseEvent) {
      if (issueMenuRef.current && !issueMenuRef.current.contains(e.target as Node)) setIssueMenuOpenId(null);
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) setFolderMenuOpenId(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [issueMenuOpenId, folderMenuOpenId]);

  useEffect(() => {
    if (creatingFolder) newFolderInputRef.current?.focus();
  }, [creatingFolder]);

  async function handleIssueDelete(e: React.MouseEvent, issueId: number) {
    e.stopPropagation();
    setIssueMenuOpenId(null);
    try { await apiClient.delete(`/issues/${issueId}`); } catch { /* ignore */ }
    setIssues((prev) => prev.filter((i) => i.issue_id !== issueId));
    if (pathname === `/issues/${issueId}`) router.push("/");
  }

  function handleIssueRenameStart(e: React.MouseEvent, issue: Issue) {
    e.stopPropagation();
    setIssueMenuOpenId(null);
    setIssueRenamingId(issue.issue_id);
    setIssueRenameValue(getLabel(issue));
  }

  async function handleIssueRenameSave(issueId: number) {
    const trimmed = issueRenameValue.trim();
    if (trimmed) {
      try {
        const res = await apiClient.patch(`/issues/${issueId}`, { title: trimmed });
        setIssues((prev) => prev.map((i) => i.issue_id === issueId ? { ...i, title: res.data.title } : i));
      } catch { /* ignore */ }
    }
    setIssueRenamingId(null);
  }

  async function handleIssueRemoveFromFolder(e: React.MouseEvent, issueId: number) {
    e.stopPropagation();
    setIssueMenuOpenId(null);
    try { await apiClient.patch(`/issues/${issueId}/folder`, { folder_id: null }); } catch { /* ignore */ }
    setIssues((prev) => prev.map((i) => i.issue_id === issueId ? { ...i, folder_id: null } : i));
  }

  async function handleFolderDelete(e: React.MouseEvent, folderId: number) {
    e.stopPropagation();
    setFolderMenuOpenId(null);
    try { await apiClient.delete(`/folders/${folderId}`); } catch { /* ignore */ }
    setFolders((prev) => prev.filter((f) => f.folder_id !== folderId));
    setIssues((prev) => prev.map((i) => i.folder_id === folderId ? { ...i, folder_id: null } : i));
  }

  function handleFolderRenameStart(e: React.MouseEvent, folder: Folder) {
    e.stopPropagation();
    setFolderMenuOpenId(null);
    setFolderRenamingId(folder.folder_id);
    setFolderRenameValue(folder.name);
  }

  async function handleFolderRenameSave(folderId: number) {
    const trimmed = folderRenameValue.trim();
    if (trimmed) {
      try {
        const res = await apiClient.patch(`/folders/${folderId}`, { name: trimmed });
        setFolders((prev) => prev.map((f) => f.folder_id === folderId ? { ...f, name: res.data.name } : f));
      } catch { /* ignore */ }
    }
    setFolderRenamingId(null);
  }

  async function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) { setCreatingFolder(false); return; }
    try {
      const res = await apiClient.post("/folders", { name: trimmed });
      setFolders((prev) => [...prev, res.data]);
      setExpandedFolders((prev) => new Set([...prev, res.data.folder_id]));
    } catch { /* ignore */ }
    setCreatingFolder(false);
    setNewFolderName("");
  }

  async function handleDrop(e: React.DragEvent, folderId: number) {
    e.preventDefault();
    setDragOverFolderId(null);
    if (draggingIssueId === null) return;
    try { await apiClient.patch(`/issues/${draggingIssueId}/folder`, { folder_id: folderId }); } catch { /* ignore */ }
    setIssues((prev) => prev.map((i) => i.issue_id === draggingIssueId ? { ...i, folder_id: folderId } : i));
    setExpandedFolders((prev) => new Set([...prev, folderId]));
    setDraggingIssueId(null);
  }

  const unfolderedIssues = issues.filter((i) => i.folder_id === null);
  const issuesInFolder = (folderId: number) => issues.filter((i) => i.folder_id === folderId);

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 overflow-y-auto flex-shrink-0"
      style={{ width: sidebarWidth, position: "relative", background: SB.bg }}
    >
      {/* 리사이즈 핸들 */}
      <div
        onMouseDown={handleResizeMouseDown}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        style={{
          position: "absolute", top: 0, right: 0, width: 4, height: "100%",
          cursor: "col-resize", zIndex: 20,
          backgroundColor: handleHovered || resizing ? SB.handleHover : SB.handle,
          transition: handleHovered || resizing ? "none" : "background-color 0.15s",
        }}
      />

      {/* ── 로고 ── */}
      <div
        style={{
          padding: "20px 16px 16px",
          borderBottom: `1px solid ${SB.border}`,
          cursor: "pointer",
        }}
        onClick={() => router.push("/")}
        title="홈으로"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 900, lineHeight: 1 }}>T</span>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: SB.textStrong, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              세무 AI
            </p>
            <p style={{ fontSize: 10, color: SB.muted, letterSpacing: "0.02em", lineHeight: 1 }}>
              어시스턴트
            </p>
          </div>
        </div>
      </div>

      {/* ── 새 이슈 버튼 ── */}
      <div style={{ padding: "14px 12px 10px" }}>
        <button
          onClick={() => router.push("/")}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "9px 14px",
            background: SB.accent,
            color: "#fff", border: "none", borderRadius: 7,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            letterSpacing: "0.02em",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <span style={{ fontSize: 15, lineHeight: 1, marginTop: -1 }}>+</span>
          새 이슈 분석
        </button>
      </div>

      {/* ── 이슈 목록 링크 ── */}
      <div style={{ padding: "2px 8px" }}>
        <Link
          href="/issues"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", borderRadius: 6, textDecoration: "none",
            background: pathname === "/issues" ? SB.activeBg : "transparent",
            color: pathname === "/issues" ? SB.activeText : SB.text,
            fontSize: 12, fontWeight: 600,
            transition: "background 0.1s",
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          이슈 목록
        </Link>
      </div>

      <div style={{ margin: "8px 12px", borderTop: `1px solid ${SB.border}` }} />

      {/* ── 최근 이슈 ── */}
      <div style={{ flex: 1, padding: "0 8px 8px", overflowY: "auto" }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: SB.muted, padding: "4px 10px 6px" }}>
          최근 이슈
        </p>

        {unfolderedIssues.length === 0 && folders.length === 0 && (
          <p style={{ fontSize: 11, color: SB.muted, padding: "4px 10px", fontStyle: "italic" }}>이슈가 없습니다.</p>
        )}

        <ul style={{ padding: 0, margin: 0, marginBottom: 4 }}>
          {unfolderedIssues.map((issue) => (
            <IssueItem
              key={issue.issue_id}
              issue={issue}
              isActive={pathname === `/issues/${issue.issue_id}`}
              isMenuOpen={issueMenuOpenId === issue.issue_id}
              isRenaming={issueRenamingId === issue.issue_id}
              renameValue={issueRenameValue}
              isDragging={draggingIssueId === issue.issue_id}
              onNavigate={() => router.push(`/issues/${issue.issue_id}`)}
              onMenuToggle={(e) => { e.stopPropagation(); setIssueMenuOpenId(issueMenuOpenId === issue.issue_id ? null : issue.issue_id); }}
              onRenameChange={setIssueRenameValue}
              onRenameSave={() => handleIssueRenameSave(issue.issue_id)}
              onRenameCancel={() => setIssueRenamingId(null)}
              onDelete={(e) => handleIssueDelete(e, issue.issue_id)}
              onRenameStart={(e) => handleIssueRenameStart(e, issue)}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingIssueId(issue.issue_id); }}
              onDragEnd={() => setDraggingIssueId(null)}
              menuRef={issueMenuRef}
            />
          ))}
        </ul>

        {folders.length > 0 && (
          <ul style={{ padding: 0, margin: 0, marginBottom: 4 }}>
            {folders.map((folder) => (
              <FolderItem
                key={folder.folder_id}
                folder={folder}
                issues={issuesInFolder(folder.folder_id)}
                expanded={expandedFolders.has(folder.folder_id)}
                isMenuOpen={folderMenuOpenId === folder.folder_id}
                isRenaming={folderRenamingId === folder.folder_id}
                renameValue={folderRenameValue}
                isDragOver={dragOverFolderId === folder.folder_id}
                activeIssueId={null}
                onToggle={() => setExpandedFolders((prev) => {
                  const next = new Set(prev);
                  next.has(folder.folder_id) ? next.delete(folder.folder_id) : next.add(folder.folder_id);
                  return next;
                })}
                onMenuToggle={(e) => { e.stopPropagation(); setFolderMenuOpenId(folderMenuOpenId === folder.folder_id ? null : folder.folder_id); }}
                onRenameChange={setFolderRenameValue}
                onRenameSave={() => handleFolderRenameSave(folder.folder_id)}
                onRenameCancel={() => setFolderRenamingId(null)}
                onDelete={(e) => handleFolderDelete(e, folder.folder_id)}
                onRenameStart={(e) => handleFolderRenameStart(e, folder)}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.folder_id); }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDrop(e, folder.folder_id)}
                menuRef={folderMenuRef}
                issueMenuOpenId={issueMenuOpenId}
                issueRenamingId={issueRenamingId}
                issueRenameValue={issueRenameValue}
                issueDraggingId={draggingIssueId}
                issueMenuRef={issueMenuRef}
                onIssueNavigate={(id) => router.push(`/issues/${id}`)}
                onIssueMenuToggle={(e, id) => { e.stopPropagation(); setIssueMenuOpenId(issueMenuOpenId === id ? null : id); }}
                onIssueRenameChange={setIssueRenameValue}
                onIssueRenameSave={handleIssueRenameSave}
                onIssueRenameCancel={() => setIssueRenamingId(null)}
                onIssueDelete={handleIssueDelete}
                onIssueRenameStart={handleIssueRenameStart}
                onIssueRemoveFromFolder={handleIssueRemoveFromFolder}
                onIssueDragStart={(e, id) => { e.dataTransfer.effectAllowed = "move"; setDraggingIssueId(id); }}
                onIssueDragEnd={() => setDraggingIssueId(null)}
                pathname={pathname}
              />
            ))}
          </ul>
        )}

        {/* 폴더 만들기 */}
        <div style={{ padding: "2px 4px" }}>
          {creatingFolder ? (
            <input
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
              }}
              onBlur={handleCreateFolder}
              placeholder="폴더 이름 입력 후 Enter"
              style={{
                width: "100%", fontSize: 11, padding: "5px 8px",
                border: "1.5px solid #3b82f6", borderRadius: 5,
                outline: "none", boxSizing: "border-box",
                color: SB.textStrong, background: SB.popup,
              }}
            />
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              style={{
                width: "100%", textAlign: "left", padding: "5px 8px",
                fontSize: 11, color: SB.muted, background: "none",
                border: `1px dashed ${SB.border}`, borderRadius: 5,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = SB.text;
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = SB.muted;
                e.currentTarget.style.borderColor = SB.border;
              }}
            >
              <span style={{ fontSize: 13 }}>+</span> 폴더 만들기
            </button>
          )}
        </div>
      </div>

      {/* ── Configuration ── */}
      <div style={{ borderTop: `1px solid ${SB.border}`, padding: "10px 8px" }}>
        <Link
          href="/config"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", borderRadius: 6, textDecoration: "none",
            background: pathname === "/config" ? SB.activeBg : "transparent",
            color: pathname === "/config" ? SB.activeText : SB.text,
            fontSize: 12, fontWeight: 600,
            transition: "background 0.1s",
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuration
        </Link>
      </div>
    </aside>
  );
}
