"use client";

import { use, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/apiClient";
import ReportViewer from "@/components/ReportViewer";
import FeedbackPanel from "@/components/FeedbackForm";
import ExportDropdown from "@/components/ExportButtons";
import ConfirmModal from "@/components/ConfirmModal";
import StatusBadge from "@/components/StatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  { key: "analyze", label: "STEP 1  이슈 분석",           description: "세목, 쟁점, 검색 전략을 추출합니다." },
  { key: "search",  label: "STEP 2  판례 검색 및 관련성 평가", description: "국가법령정보 API로 판례를 검색하고 AI가 관련성을 평가합니다." },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center">
        <svg className="animate-spin w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">!</span>
    );
  }
  return <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-200 bg-white" />;
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const issueId = parseInt(id, 10);

  const [issue, setIssue]     = useState<IssueData | null>(null);
  const [report, setReport]   = useState<ReportData | null>(null);
  const [cases, setCases]     = useState<CaseData[]>([]);

  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [expandedCases, setExpandedCases] = useState<Set<number>>(new Set());

  const [phase, setPhase] = useState<Phase>("running");

  // Running phase: 2 steps
  const [runStatuses, setRunStatuses] = useState<StepStatus[]>(["pending", "pending"]);
  const [runDetails,  setRunDetails]  = useState<string[]>(["", ""]);
  const [runErrors,   setRunErrors]   = useState<string[]>(["", ""]);

  // Generating phase: 1 step
  const [genStatus, setGenStatus] = useState<StepStatus>("pending");
  const [genError,  setGenError]  = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const [feedbackOpen,  setFeedbackOpen]  = useState(false);
  const [finalizeOpen,  setFinalizeOpen]  = useState(false);
  const [finalizing,    setFinalizing]    = useState(false);

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

        if (iss.status === "searched") {
          await loadAndShowCases();
          return;
        }

        if (!ranRef.current) {
          ranRef.current = true;
          await runAll(iss);
        }
      } catch {
        setPhase("error");
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function runAll(_iss?: IssueData) {
    setPhase("running");

    // Step 0: analyze
    setRunStep(0, "running");
    try {
      const r = await apiClient.post(`/issues/${issueId}/analyze`);
      const d = r.data;
      setRunStep(0, "done", `세목: ${d.tax_category || "—"} | 키워드: ${d.primary_query || "—"}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setRunStep(0, "error", "", e?.response?.data?.detail || e?.message || "분석 실패");
      setPhase("error");
      return;
    }

    // Step 1: search + LLM scoring
    setRunStep(1, "running");
    try {
      const r = await apiClient.post(`/issues/${issueId}/search-cases`);
      const saved    = r.data?.saved_count    ?? 0;
      const selected = r.data?.selected_count ?? 0;
      setRunStep(1, "done", `${saved}건 검색됨 · AI ${selected}건 추천`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setRunStep(1, "error", "", e?.response?.data?.detail || e?.message || "판례 검색 실패");
      setPhase("error");
      return;
    }

    try {
      await loadAndShowCases();
    } catch {
      setRunStep(1, "error", "", "판례 목록 로드 실패");
      setPhase("error");
    }
  }

  async function handleGenerateReport() {
    if (selectedIds.size === 0) return;
    setGenLoading(true);
    setGenError("");
    try {
      await apiClient.post(`/issues/${issueId}/cases/select`, { case_ids: [...selectedIds] });
      setPhase("generating");
      setGenStatus("running");

      await apiClient.post(`/issues/${issueId}/report`);
      const rRes   = await apiClient.get(`/issues/${issueId}/report`);
      const updIss = await apiClient.get(`/issues/${issueId}`);
      setReport(rRes.data);
      setIssue(updIss.data);
      setGenStatus("done");
      setPhase("report");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setGenError(e?.response?.data?.detail || e?.message || "보고서 생성 실패");
      setGenStatus("error");
    } finally {
      setGenLoading(false);
    }
  }

  function toggleCase(caseId: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId); else next.add(caseId);
      return next;
    });
  }

  function toggleExpand(caseId: number) {
    setExpandedCases(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId); else next.add(caseId);
      return next;
    });
  }

  async function handleRetry() {
    ranRef.current = true;
    setRunStatuses(["pending", "pending"]);
    setRunDetails(["", ""]);
    setRunErrors(["", ""]);
    await runAll();
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await apiClient.post(`/issues/${issueId}/report/finalize`);
      setReport(prev => prev ? { ...prev, status: "finalized" } : prev);
      setIssue( prev => prev ? { ...prev, status: "finalized" } : prev);
      setFinalizeOpen(false);
    } catch { /* keep modal open */ } finally { setFinalizing(false); }
  }

  const isFinalized = report?.status === "finalized";

  const sortedCases = [...cases].sort((a, b) => {
    if (a.selected !== b.selected) return b.selected - a.selected;
    return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">

      {/* ── Running / Error phase ── */}
      {(phase === "running" || phase === "error") && (
        <div className="px-6 py-8 max-w-2xl mx-auto">
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">
              {phase === "error" ? "분석 중 오류 발생" : "분석 중..."}
            </p>
            <h1 className="text-xl font-bold text-gray-900">
              {issue?.title || `이슈 #${issueId}`}
            </h1>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {RUN_STEPS.map((step, i) => {
              const st = runStatuses[i];
              return (
                <div key={step.key} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <StepIcon status={st} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          st === "done"    ? "text-gray-700"
                          : st === "running" ? "text-blue-700"
                          : st === "error"   ? "text-red-700"
                          : "text-gray-400"
                        }`}>{step.label}</span>
                        {st === "running" && <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">진행 중</span>}
                        {st === "done"    && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">완료</span>}
                        {st === "pending" && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">대기</span>}
                        {st === "error"   && <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">실패</span>}
                      </div>
                      {(st === "pending" || st === "running") && (
                        <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                      )}
                      {runDetails[i] && st === "done" && (
                        <p className="text-xs text-gray-500 mt-0.5">{runDetails[i]}</p>
                      )}
                      {runErrors[i] && st === "error" && (
                        <p className="text-xs text-red-500 mt-0.5">{runErrors[i]}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {phase === "error" && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >재시도</button>
              <a href="/" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                새 이슈 입력
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Select phase ── */}
      {phase === "select" && (
        <div className="px-6 py-8 max-w-3xl mx-auto pb-32">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {issue?.title || `이슈 #${issueId}`}
            </h1>
            <p className="text-sm text-gray-500">
              {cases.length}건 검색됨 &middot; AI {cases.filter(c => c.selected === 1).length}건 추천 &middot; {selectedIds.size}건 선택
            </p>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">판례 선택</h2>
            <div className="flex gap-1.5">
              <button
                onClick={() => setSelectedIds(new Set(cases.filter(c => c.selected === 1).map(c => c.case_id)))}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
              >AI 추천으로 초기화</button>
              <button
                onClick={() => setSelectedIds(new Set(cases.map(c => c.case_id)))}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
              >전체 선택</button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
              >전체 해제</button>
            </div>
          </div>

          <div className="space-y-2">
            {sortedCases.map(c => {
              const isChecked  = selectedIds.has(c.case_id);
              const isExpanded = expandedCases.has(c.case_id);
              const isAI       = c.selected === 1;

              return (
                <div
                  key={c.case_id}
                  className={`bg-white rounded-xl border transition-colors ${
                    isChecked ? "border-blue-300 shadow-sm" : "border-gray-200"
                  }`}
                >
                  <div
                    className="px-4 py-3.5 flex items-start gap-3 cursor-pointer select-none"
                    onClick={() => toggleCase(c.case_id)}
                  >
                    {/* Checkbox */}
                    <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      isChecked ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
                    }`}>
                      {isChecked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">
                              {c.case_name || c.case_number || "판례"}
                            </span>
                            {isAI && (
                              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                AI 추천
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[c.court_name, c.decision_date, c.case_name ? c.case_number : null]
                              .filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <ScoreBar score={c.relevance_score} />
                      </div>

                      {/* Selection reason */}
                      {c.selection_reason && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                          {c.selection_reason}
                        </p>
                      )}

                      {/* Expand toggle */}
                      {(c.holding || c.summary) && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpand(c.case_id); }}
                          className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {isExpanded ? "▲ 접기" : "▼ 판결요지 보기"}
                        </button>
                      )}

                      {/* Expanded content */}
                      {isExpanded && (c.holding || c.summary) && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed">
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
      )}

      {/* ── Select phase: sticky bottom bar ── */}
      {phase === "select" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 z-10 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedIds.size === 0
                ? "판례를 1건 이상 선택하세요"
                : `${selectedIds.size}건 선택됨`}
            </p>
            <button
              disabled={selectedIds.size === 0 || genLoading}
              onClick={handleGenerateReport}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
      )}

      {/* ── Generating phase ── */}
      {phase === "generating" && (
        <div className="px-6 py-8 max-w-2xl mx-auto">
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">보고서 생성 중...</p>
            <h1 className="text-xl font-bold text-gray-900">
              {issue?.title || `이슈 #${issueId}`}
            </h1>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4">
            <div className="flex items-start gap-3">
              <StepIcon status={genStatus} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    genStatus === "done"    ? "text-gray-700"
                    : genStatus === "running" ? "text-blue-700"
                    : genStatus === "error"   ? "text-red-700"
                    : "text-gray-400"
                  }`}>보고서 생성</span>
                  {genStatus === "running" && <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">진행 중</span>}
                  {genStatus === "done"    && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">완료</span>}
                  {genStatus === "error"   && <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">실패</span>}
                </div>
                {genStatus === "running" && (
                  <p className="text-xs text-blue-500 mt-0.5">선택한 판례를 기반으로 분석 보고서를 생성합니다. (1~3분 소요)</p>
                )}
                {genStatus === "error" && (
                  <p className="text-xs text-red-500 mt-0.5">{genError}</p>
                )}
              </div>
            </div>
          </div>
          {genStatus === "error" && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setPhase("select")}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >← 판례 선택으로 돌아가기</button>
              <button
                onClick={handleGenerateReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >재시도</button>
            </div>
          )}
        </div>
      )}

      {/* ── Report phase ── */}
      {phase === "report" && report && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={report.status} />
                  {issue?.tax_category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                      {issue.tax_category}
                    </span>
                  )}
                </div>
                <h1 className="text-lg font-bold text-gray-900 truncate">
                  {report.title || issue?.title || `이슈 #${issueId}`}
                </h1>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isFinalized && (
                  <button
                    onClick={() => setFeedbackOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    피드백
                  </button>
                )}
                {!isFinalized && (
                  <button
                    onClick={() => setFinalizeOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-6">
            <ReportViewer markdown={report.full_report_markdown} />
          </div>
        </div>
      )}

      {/* Feedback Panel */}
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
