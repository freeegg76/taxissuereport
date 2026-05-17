"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import StatusBadge from "@/components/StatusBadge";

interface Issue {
  issue_id: number;
  title: string | null;
  raw_input: string;
  status: string;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function IssuesPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiClient.get("/issues")
      .then((r) => setIssues(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = issues.filter((i) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (i.title || "").toLowerCase().includes(q) || i.raw_input.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--clr-bg)" }}>

      {/* Page header (WEBDOT style) */}
      <div
        style={{
          background: "var(--clr-surface)",
          borderBottom: "1px solid var(--clr-border)",
          padding: "28px 48px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <a href="/" style={{ fontSize: 11, color: "var(--clr-muted)", textDecoration: "none" }}>홈</a>
          <span style={{ fontSize: 11, color: "var(--clr-border)" }}>/</span>
          <span style={{ fontSize: 11, color: "var(--clr-accent)", fontWeight: 600 }}>이슈 목록</span>
        </div>
        <h1
          style={{
            fontSize: 24, fontWeight: 900, letterSpacing: "-0.025em",
            color: "var(--clr-text-strong)", marginBottom: 8,
          }}
        >
          이슈 목록
        </h1>
        <p style={{ fontSize: 12, color: "var(--clr-secondary)" }}>
          총 {issues.length}개의 이슈가 있습니다.
        </p>
      </div>

      <div style={{ padding: "28px 48px", maxWidth: 900 }}>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <svg
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--clr-muted)" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이슈 검색..."
            style={{
              width: "100%", boxSizing: "border-box",
              paddingLeft: 38, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
              background: "var(--clr-surface)",
              border: "1.5px solid var(--clr-border)",
              borderRadius: 8, fontSize: 13,
              color: "var(--clr-text-strong)", outline: "none",
              fontFamily: "inherit", transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--clr-accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--clr-border)")}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", color: "var(--clr-muted)", gap: 8, fontSize: 13 }}>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", textAlign: "center" }}>
            <svg style={{ width: 40, height: 40, color: "var(--clr-border)", marginBottom: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p style={{ color: "var(--clr-text)", fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
              {query ? "검색 결과가 없습니다." : "이슈가 없습니다."}
            </p>
            {!query && <p style={{ color: "var(--clr-muted)", fontSize: 12 }}>새 이슈를 입력하여 분석을 시작하세요.</p>}
          </div>
        ) : (
          <div
            style={{
              background: "var(--clr-surface)",
              border: "1px solid var(--clr-border)",
              borderRadius: 12, overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid", gridTemplateColumns: "100px 1fr 90px",
                padding: "10px 20px",
                background: "var(--clr-surface2)",
                borderBottom: "1px solid var(--clr-border)",
              }}
            >
              {["일자", "제목", "상태"].map((h, i) => (
                <span
                  key={h}
                  style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.14em",
                    textTransform: "uppercase", color: "var(--clr-muted)",
                    textAlign: i === 2 ? "right" : "left",
                  }}
                >{h}</span>
              ))}
            </div>

            {filtered.map((issue, idx) => (
              <IssueRow
                key={issue.issue_id}
                issue={issue}
                isLast={idx === filtered.length - 1}
                onClick={() => router.push(`/issues/${issue.issue_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IssueRow({ issue, isLast, onClick }: { issue: Issue; isLast: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: "100px 1fr 90px",
        padding: "13px 20px", cursor: "pointer",
        borderBottom: isLast ? "none" : "1px solid var(--clr-divider)",
        background: hovered ? "var(--clr-hover)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--clr-muted)", alignSelf: "center" }}>
        {formatDate(issue.created_at)}
      </span>
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block", fontSize: 13, fontWeight: 700,
            color: hovered ? "var(--clr-accent)" : "var(--clr-text-strong)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            transition: "color 0.1s",
          }}
        >
          {issue.title || issue.raw_input.slice(0, 55) + (issue.raw_input.length > 55 ? "…" : "")}
        </span>
        {issue.title && (
          <span style={{ display: "block", fontSize: 11, color: "var(--clr-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {issue.raw_input.slice(0, 65)}…
          </span>
        )}
      </div>
      <div style={{ textAlign: "right", alignSelf: "center" }}>
        <StatusBadge status={issue.status} />
      </div>
    </div>
  );
}
