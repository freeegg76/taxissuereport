"use client";

import { use, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/apiClient";
import ReportViewer from "@/components/ReportViewer";
import FeedbackPanel from "@/components/FeedbackForm";
import ExportDropdown from "@/components/ExportButtons";
import ConfirmModal from "@/components/ConfirmModal";
import StatusBadge from "@/components/StatusBadge";

interface IssueData {
  issue_id: number;
  title: string | null;
  raw_input: string;
  tax_category: string | null;
  status: string;
}

interface ReportData {
  report_id: number;
  full_report_markdown: string;
  status: string;
  title: string | null;
}

interface CaseData {
  case_id: number;
  case_name: string | null;
  case_number: string | null;
  court_name: string | null;
  decision_date: string | null;
  summary: string | null;
  holding: string | null;
  relevance_score: number | null;
  rank_order: number | null;
  selected: number;
  selection_reason: string | null;
}

type StepStatus = "pending" | "running" | "done" | "error";
type Phase = "running" | "select" | "generating" | "report" | "error";

const RUN_STEPS = [
  { key: "analyze", label: "이슈 분석",               description: "세목, 쟁점, 검색 전략을 추출합니다." },
  { key: "search",  label: "판례 검색 및 관련성 평가", description: "국가법령정보 API로 판례를 검색하고 AI가 관련성을 평가합니다." },
];

// ── 공용 헤더 ─────────────────────────────────────────────────────────────────
function PageHeader({
  breadcrumb, title, meta,
}: {
  breadcrumb: string;
  title: string;
  meta?: React.ReactNode;
}) {
  return (
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
        <span style={{ fontSize: 11, color: "var(--clr-accent)", fontWeight: 600 }}>{breadcrumb}</span>
      </div>
      <h1
        style={{
          fontSize: 24, fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.2,
          color: "var(--clr-text-strong)", marginBottom: meta ? 10 : 0,
        }}
      >
        {title}
      </h1>
      {meta && <div>{meta}</div>}
    </div>
  );
}

// ── Step 번호 뱃지 (WEBDOT 번호 섹션 스타일) ──────────────────────────────────
function StepNum({ n, status }: { n: number; status: StepStatus }) {
  const bg =
    status === "done"    ? "#16a34a" :
    status === "running" ? "#2563eb" :
    status === "error"   ? "#dc2626" :
    "var(--clr-border)";
  const color =
    status === "pending" ? "var(--clr-muted)" : "#fff";
  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: "50%",
        background: bg, color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, flexShrink: 0,
        transition: "background 0.3s",
      }}
    >
      {status === "running" ? (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#fff" strokeWidth="4" />
          <path className="opacity-75" fill="#fff" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : status === "done" ? (
        <svg width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : status === "error" ? "!" : n}
    </div>
  );
}

function StatusPill({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; color: string; bg: string }> = {
    pending: { label: "대기",    color: "var(--clr-muted)",  bg: "var(--clr-surface2)" },
    running: { label: "진행 중", color: "#2563eb",           bg: "rgba(37,99,235,0.08)" },
    done:    { label: "완료",    color: "#16a34a",           bg: "rgba(22,163,74,0.08)" },
    error:   { label: "실패",    color: "#dc2626",           bg: "rgba(220,38,38,0.08)" },
  };
  const m = map[status];
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        padding: "2px 8px", borderRadius: 4,
        color: m.color, background: m.bg,
        border: `1px solid ${m.color}30`,
      }}
    >
      {m.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#ca8a04" : "var(--clr-muted)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{ width: 52, height: 4, background: "var(--clr-border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "var(--clr-secondary)", width: 30, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const issueId = parseInt(id, 10);

  const [issue, setIssue]   = useState<IssueData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [cases, setCases]   = useState<CaseData[]>([]);

  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const [expandedCases, setExpandedCases] = useState<Set<number>>(new Set());
  const [phase, setPhase]                 = useState<Phase>("running");

  const [runStatuses, setRunStatuses] = useState<StepStatus[]>(["pending", "pending"]);
  const [runDetails,  setRunDetails]  = useState<string[]>(["", ""]);
  const [runErrors,   setRunErrors]   = useState<string[]>(["", ""]);

  const [genStatus,  setGenStatus]  = useState<StepStatus>("pending");
  const [genError,   setGenError]   = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing,   setFinalizing]   = useState(false);

  const ranRef = useRef(false);

  function setRunStep(i: number, status: StepStatus, detail = "", err = "") {
    setRunStatuses(prev => { const n = [...prev]; n[i] = status; return n; });
    setRunDetails( prev => { const n = [...prev]; if (detail) n[i] = detail; return n; });
    setRunErrors(  prev => { const n = [...prev]; if (err)    n[i] = err;    return n; });
  }

  async function loadAndShowCases() {
    const res = await apiClient.get(`/issues/${issueId}/cases`);
    const data: CaseData[] = res.data;
    setCases(data);
    setSelectedIds(new Set(data.filter(c => c.selected === 1).map(c => c.case_id)));
    setPhase("select");
  }

  useEffect(() => {
    async function init() {
      try {
        const iRes = await apiClient.get(`/issues/${issueId}`);
        const iss: IssueData = iRes.data;
        setIssue(iss);
        if (iss.status === "report_ready" || iss.status === "finalized") {
          try {
            const rRes = await apiClient.get(`/issues/${issueId}/report`);
            setReport(rRes.data);
            setPhase("report");
            return;
          } catch { /* fall through */ }
        }
        if (iss.status === "searched") { await loadAndShowCases(); return; }
        if (!ranRef.current) { ranRef.current = true; await runAll(iss); }
      } catch { setPhase("error"); }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function runAll(_iss?: IssueData) {
    setPhase("running");
    setRunStep(0, "running");
    try {
      const r = await apiClient.post(`/issues/${issueId}/analyze`);
      const d = r.data;
      setRunStep(0, "done", `세목: ${d.tax_category || "—"} · 키워드: ${d.primary_query || "—"}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setRunStep(0, "error", "", e?.response?.data?.detail || e?.message || "분석 실패");
      setPhase("error"); return;
    }
    setRunStep(1, "running");
    try {
      const r = await apiClient.post(`/issues/${issueId}/search-cases`);
      const saved    = r.data?.saved_count    ?? 0;
      const selected = r.data?.selected_count ?? 0;
      setRunStep(1, "done", `${saved}건 검색됨 · AI ${selected}건 추천`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setRunStep(1, "error", "", e?.response?.data?.detail || e?.message || "판례 검색 실패");
      setPhase("error"); return;
    }
    try { await loadAndShowCases(); }
    catch { setRunStep(1, "error", "", "판례 목록 로드 실패"); setPhase("error"); }
  }

  async function handleGenerateReport() {
    if (selectedIds.size === 0) return;
    setGenLoading(true); setGenError("");
    try {
      await apiClient.post(`/issues/${issueId}/cases/select`, { case_ids: [...selectedIds] });
      setPhase("generating"); setGenStatus("running");
      await apiClient.post(`/issues/${issueId}/report`);
      const rRes   = await apiClient.get(`/issues/${issueId}/report`);
      const updIss = await apiClient.get(`/issues/${issueId}`);
      setReport(rRes.data); setIssue(updIss.data);
      setGenStatus("done"); setPhase("report");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setGenError(e?.response?.data?.detail || e?.message || "보고서 생성 실패");
      setGenStatus("error");
    } finally { setGenLoading(false); }
  }

  function toggleCase(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleExpand(id: number) {
    setExpandedCases(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleRetry() {
    ranRef.current = true;
    setRunStatuses(["pending", "pending"]);
    setRunDetails(["", ""]); setRunErrors(["", ""]);
    await runAll();
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await apiClient.post(`/issues/${issueId}/report/finalize`);
      setReport(prev => prev ? { ...prev, status: "finalized" } : prev);
      setIssue( prev => prev ? { ...prev, status: "finalized" } : prev);
      setFinalizeOpen(false);
    } catch { /* keep modal */ } finally { setFinalizing(false); }
  }

  const isFinalized = report?.status === "finalized";
  const sortedCases = [...cases].sort((a, b) => {
    if (a.selected !== b.selected) return b.selected - a.selected;
    return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
  });

  const issueTitle = issue?.title || `이슈 #${issueId}`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--clr-bg)" }}>

      {/* ── Running / Error ── */}
      {(phase === "running" || phase === "error") && (
        <>
          <PageHeader
            breadcrumb={phase === "error" ? "오류" : "분석 진행 중"}
            title={issueTitle}
            meta={
              <p style={{ fontSize: 12, color: "var(--clr-secondary)" }}>
                {phase === "error" ? "분석 중 오류가 발생했습니다." : "판례 기반 분석을 수행하고 있습니다..."}
              </p>
            }
          />
          <div style={{ padding: "32px 48px", maxWidth: 720 }}>
            <div
              style={{
                background: "var(--clr-surface)",
                border: "1px solid var(--clr-border)",
                borderRadius: 12, overflow: "hidden",
              }}
            >
              {RUN_STEPS.map((step, i) => {
                const st = runStatuses[i];
                const isLast = i === RUN_STEPS.length - 1;
                return (
                  <div
                    key={step.key}
                    style={{
                      padding: "20px 24px",
                      borderBottom: isLast ? "none" : "1px solid var(--clr-divider)",
                      display: "flex", alignItems: "flex-start", gap: 16,
                    }}
                  >
                    <StepNum n={i + 1} status={st} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 13, fontWeight: 700,
                            color: st === "done" ? "var(--clr-text-strong)"
                              : st === "running" ? "#2563eb"
                              : st === "error" ? "#dc2626"
                              : "var(--clr-muted)",
                          }}
                        >
                          {step.label}
                        </span>
                        <StatusPill status={st} />
                      </div>
                      {(st === "pending" || st === "running") && (
                        <p style={{ fontSize: 12, color: "var(--clr-muted)", lineHeight: 1.6 }}>
                          {step.description}
                        </p>
                      )}
                      {runDetails[i] && st === "done" && (
                        <p style={{ fontSize: 11, color: "var(--clr-secondary)", fontFamily: "monospace" }}>
                          {runDetails[i]}
                        </p>
                      )}
                      {runErrors[i] && st === "error" && (
                        <p style={{ fontSize: 12, color: "#dc2626" }}>{runErrors[i]}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {phase === "error" && (
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button
                  onClick={handleRetry}
                  style={{
                    padding: "10px 20px", background: "var(--clr-accent)", color: "#fff",
                    borderRadius: 7, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}
                >재시도</button>
                <a
                  href="/"
                  style={{
                    padding: "10px 20px",
                    background: "var(--clr-surface)",
                    border: "1px solid var(--clr-border)",
                    color: "var(--clr-text)", borderRadius: 7,
                    fontSize: 13, fontWeight: 600, textDecoration: "none", display: "inline-block",
                  }}
                >새 이슈 입력</a>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Select phase ── */}
      {phase === "select" && (
        <>
          <PageHeader
            breadcrumb="판례 선택"
            title={issueTitle}
            meta={
              <p style={{ fontSize: 12, color: "var(--clr-secondary)" }}>
                {cases.length}건 검색됨 &middot; AI {cases.filter(c => c.selected === 1).length}건 추천 &middot; <strong style={{ color: "var(--clr-accent)" }}>{selectedIds.size}건 선택</strong>
              </p>
            }
          />

          <div style={{ padding: "28px 48px 120px", maxWidth: 860 }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2
                style={{
                  fontSize: 14, fontWeight: 800, letterSpacing: "0.06em",
                  textTransform: "uppercase", color: "var(--clr-secondary)",
                }}
              >
                판례 목록
              </h2>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { label: "AI 추천", fn: () => setSelectedIds(new Set(cases.filter(c => c.selected === 1).map(c => c.case_id))) },
                  { label: "전체 선택", fn: () => setSelectedIds(new Set(cases.map(c => c.case_id))) },
                  { label: "전체 해제", fn: () => setSelectedIds(new Set()) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.fn}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "5px 10px",
                      background: "var(--clr-surface)",
                      border: "1px solid var(--clr-border)",
                      borderRadius: 6, color: "var(--clr-secondary)", cursor: "pointer",
                    }}
                  >{btn.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedCases.map((c, idx) => {
                const isChecked  = selectedIds.has(c.case_id);
                const isExpanded = expandedCases.has(c.case_id);
                const isAI       = c.selected === 1;

                return (
                  <div
                    key={c.case_id}
                    style={{
                      background: "var(--clr-surface)",
                      border: `1.5px solid ${isChecked ? "rgba(37,99,235,0.45)" : "var(--clr-border)"}`,
                      borderRadius: 10,
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div
                      style={{ padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleCase(c.case_id)}
                    >
                      {/* Number + checkbox */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <span
                          style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: "var(--clr-surface2)",
                            border: "1px solid var(--clr-border)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, color: "var(--clr-muted)",
                          }}
                        >{idx + 1}</span>
                        <div
                          style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            border: `2px solid ${isChecked ? "var(--clr-accent)" : "var(--clr-border)"}`,
                            background: isChecked ? "var(--clr-accent)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}
                        >
                          {isChecked && (
                            <svg width="9" height="9" fill="none" stroke="#fff" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--clr-text-strong)" }}>
                                {c.case_name || c.case_number || "판례"}
                              </span>
                              {isAI && (
                                <span
                                  style={{
                                    fontSize: 9, fontWeight: 800, padding: "2px 7px",
                                    background: "rgba(37,99,235,0.08)",
                                    color: "var(--clr-accent)",
                                    border: "1px solid rgba(37,99,235,0.2)",
                                    borderRadius: 3,
                                    letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0,
                                  }}
                                >AI 추천</span>
                              )}
                            </div>
                            <p style={{ fontSize: 11, color: "var(--clr-muted)", fontFamily: "monospace" }}>
                              {[c.court_name, c.decision_date, c.case_name ? c.case_number : null].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <ScoreBar score={c.relevance_score} />
                        </div>

                        {c.selection_reason && (
                          <p style={{ fontSize: 12, color: "var(--clr-secondary)", marginTop: 8, lineHeight: 1.65 }}>
                            {c.selection_reason}
                          </p>
                        )}

                        {(c.holding || c.summary) && (
                          <button
                            onClick={e => { e.stopPropagation(); toggleExpand(c.case_id); }}
                            style={{
                              marginTop: 8, fontSize: 11, fontWeight: 600,
                              color: "var(--clr-accent)", background: "none",
                              border: "none", cursor: "pointer", padding: 0,
                            }}
                          >
                            {isExpanded ? "▲ 접기" : "▼ 판결요지 보기"}
                          </button>
                        )}

                        {isExpanded && (c.holding || c.summary) && (
                          <div
                            className="callout-info"
                            style={{ marginTop: 10, fontSize: 12, color: "var(--clr-text)", lineHeight: 1.7 }}
                          >
                            {c.holding || c.summary}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sticky bottom bar */}
          <div
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
              background: "var(--clr-surface)",
              borderTop: "1px solid var(--clr-border)",
              padding: "14px 48px",
            }}
          >
            <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, color: "var(--clr-secondary)", fontWeight: 600 }}>
                {selectedIds.size === 0 ? "판례를 1건 이상 선택하세요" : `${selectedIds.size}건 선택됨`}
              </p>
              <button
                disabled={selectedIds.size === 0 || genLoading}
                onClick={handleGenerateReport}
                style={{
                  padding: "11px 24px",
                  background: selectedIds.size === 0 || genLoading ? "var(--clr-muted)" : "var(--clr-accent)",
                  color: "#fff", borderRadius: 7, border: "none",
                  fontWeight: 700, fontSize: 13, letterSpacing: "0.04em",
                  cursor: selectedIds.size === 0 || genLoading ? "not-allowed" : "pointer",
                  opacity: selectedIds.size === 0 || genLoading ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {genLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    처리 중...
                  </>
                ) : `${selectedIds.size}건으로 보고서 생성 →`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Generating ── */}
      {phase === "generating" && (
        <>
          <PageHeader breadcrumb="보고서 생성 중" title={issueTitle} />
          <div style={{ padding: "32px 48px", maxWidth: 720 }}>
            <div
              style={{
                background: "var(--clr-surface)", border: "1px solid var(--clr-border)",
                borderRadius: 12, padding: "20px 24px",
                display: "flex", alignItems: "flex-start", gap: 16,
              }}
            >
              <StepNum n={1} status={genStatus} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: genStatus === "error" ? "#dc2626" : "var(--clr-text-strong)" }}>
                    보고서 생성
                  </span>
                  <StatusPill status={genStatus} />
                </div>
                {genStatus === "running" && (
                  <p style={{ fontSize: 12, color: "var(--clr-secondary)", lineHeight: 1.6 }}>
                    선택한 판례를 기반으로 분석 보고서를 생성합니다. (1~3분 소요)
                  </p>
                )}
                {genStatus === "error" && <p style={{ fontSize: 12, color: "#dc2626" }}>{genError}</p>}
              </div>
            </div>
            {genStatus === "error" && (
              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <button
                  onClick={() => setPhase("select")}
                  style={{ padding: "10px 18px", background: "var(--clr-surface)", color: "var(--clr-text)", borderRadius: 7, border: "1px solid var(--clr-border)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >← 판례 선택으로</button>
                <button
                  onClick={handleGenerateReport}
                  style={{ padding: "10px 18px", background: "var(--clr-accent)", color: "#fff", borderRadius: 7, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >재시도</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Report phase ── */}
      {phase === "report" && report && (
        <>
          {/* Article header */}
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
              <span style={{ fontSize: 11, color: "var(--clr-secondary)" }}>보고서</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <StatusBadge status={report.status} />
                  {issue?.tax_category && (
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 9px",
                        background: "rgba(37,99,235,0.08)", color: "var(--clr-accent)",
                        border: "1px solid rgba(37,99,235,0.2)", borderRadius: 4,
                        letterSpacing: "0.07em", textTransform: "uppercase",
                      }}
                    >{issue.tax_category}</span>
                  )}
                </div>
                <h1
                  style={{
                    fontSize: 22, fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.25,
                    color: "var(--clr-text-strong)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {report.title || issue?.title || `이슈 #${issueId}`}
                </h1>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {!isFinalized && (
                  <button
                    onClick={() => setFeedbackOpen(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px",
                      background: "var(--clr-surface2)",
                      border: "1px solid var(--clr-border)",
                      borderRadius: 7, fontSize: 12, fontWeight: 700,
                      color: "var(--clr-text)", cursor: "pointer",
                    }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    피드백
                  </button>
                )}
                {!isFinalized && (
                  <button
                    onClick={() => setFinalizeOpen(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", background: "#16a34a",
                      border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
                      color: "#fff", cursor: "pointer",
                    }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    최종 확정
                  </button>
                )}
                <ExportDropdown
                  issueId={issueId}
                  isFinalized={isFinalized}
                  onFinalized={() => {
                    setReport(prev => prev ? { ...prev, status: "finalized" } : prev);
                    setIssue( prev => prev ? { ...prev, status: "finalized" } : prev);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Report body — article layout */}
          <div style={{ padding: "36px 48px", maxWidth: 900, margin: "0 auto" }}>
            <div
              style={{
                background: "var(--clr-surface)",
                border: "1px solid var(--clr-border)",
                borderRadius: 12,
                padding: "36px 40px",
              }}
            >
              <ReportViewer markdown={report.full_report_markdown} />
            </div>
          </div>
        </>
      )}

      <FeedbackPanel
        issueId={issueId}
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onUpdated={md => setReport(prev => prev ? { ...prev, full_report_markdown: md } : prev)}
      />

      {finalizeOpen && (
        <ConfirmModal
          title="보고서를 최종 확정하시겠습니까?"
          message="확정 후에는 보고서를 수정할 수 없습니다."
          confirmLabel="최종 확정"
          cancelLabel="취소"
          loading={finalizing}
          onConfirm={handleFinalize}
          onCancel={() => setFinalizeOpen(false)}
        />
      )}
    </div>
  );
}
