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

type StepStatus = "pending" | "running" | "done" | "error";

interface Step {
  key: string;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  { key: "analyze",  label: "STEP 1  이슈 분석",   description: "세목, 쟁점, 검색 전략을 추출합니다." },
  { key: "search",   label: "STEP 2  판례 검색",   description: "국가법령정보 API로 관련 판례를 검색합니다." },
  { key: "select",   label: "STEP 3  판례 선별",   description: "LLM이 관련 판례를 선별합니다." },
  { key: "report",   label: "STEP 4  보고서 생성", description: "판례 기반 분석 보고서를 생성합니다." },
];

// ─── Step Icon ────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">
        ✓
      </span>
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
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
        !
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-200 bg-white" />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const issueId = parseInt(id, 10);

  const [issue, setIssue] = useState<IssueData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  // Step states: one entry per step
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(["pending", "pending", "pending", "pending"]);
  const [stepDetails, setStepDetails] = useState<string[]>(["", "", "", ""]);
  const [stepErrors, setStepErrors] = useState<string[]>(["", "", "", ""]);

  const [phase, setPhase] = useState<"running" | "report" | "error">("running");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const ranRef = useRef(false);

  function setStep(i: number, status: StepStatus, detail = "", err = "") {
    setStepStatuses((prev) => { const n = [...prev]; n[i] = status; return n; });
    setStepDetails((prev) => { const n = [...prev]; if (detail) n[i] = detail; return n; });
    setStepErrors((prev) => { const n = [...prev]; if (err) n[i] = err; return n; });
  }

  // Load issue, then check if report already exists
  useEffect(() => {
    async function init() {
      try {
        const iRes = await apiClient.get(`/issues/${issueId}`);
        const iss: IssueData = iRes.data;
        setIssue(iss);

        // If report already exists, go straight to report view
        if (iss.status === "report_ready" || iss.status === "finalized") {
          try {
            const rRes = await apiClient.get(`/issues/${issueId}/report`);
            setReport(rRes.data);
            setPhase("report");
            setStepStatuses(["done", "done", "done", "done"]);
            return;
          } catch {
            // Report doesn't exist yet, fall through to run
          }
        }

        // Start auto-run if not already running
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

  async function runAll(iss?: IssueData) {
    setPhase("running");

    // Step 0: analyze
    setStep(0, "running");
    try {
      const r = await apiClient.post(`/issues/${issueId}/analyze`);
      const d = r.data;
      setStep(0, "done", `세목: ${d.tax_category || "—"} | 키워드: ${d.primary_query || "—"}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setStep(0, "error", "", e?.response?.data?.detail || e?.message || "분석 실패");
      setPhase("error");
      return;
    }

    // Step 1: search (includes case selection internally)
    setStep(1, "running");
    setStep(2, "running");
    try {
      const r = await apiClient.post(`/issues/${issueId}/search-cases`);
      const saved = r.data?.saved_count ?? 0;
      const selected = r.data?.selected_count ?? 0;
      setStep(1, "done", `${saved}건 검색됨`);
      setStep(2, "done", `${selected}건 선별됨`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "판례 검색 실패";
      setStep(1, "error", "", msg);
      setStep(2, "error", "", msg);
      setPhase("error");
      return;
    }

    // Step 3: report
    setStep(3, "running");
    try {
      await apiClient.post(`/issues/${issueId}/report`);
      const rRes = await apiClient.get(`/issues/${issueId}/report`);
      setReport(rRes.data);
      setStep(3, "done", "보고서 생성 완료");
      const updIss = await apiClient.get(`/issues/${issueId}`);
      setIssue(updIss.data);
      setPhase("report");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setStep(3, "error", "", e?.response?.data?.detail || e?.message || "보고서 생성 실패");
      setPhase("error");
    }
  }

  async function handleRetry() {
    ranRef.current = true;
    setStepStatuses(["pending", "pending", "pending", "pending"]);
    setStepDetails(["", "", "", ""]);
    setStepErrors(["", "", "", ""]);
    await runAll();
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await apiClient.post(`/issues/${issueId}/report/finalize`);
      setReport((prev) => prev ? { ...prev, status: "finalized" } : prev);
      setIssue((prev) => prev ? { ...prev, status: "finalized" } : prev);
      setFinalizeOpen(false);
    } catch {
      // Keep modal open on error
    } finally {
      setFinalizing(false);
    }
  }

  const isFinalized = report?.status === "finalized";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Phase: running / error → show stepper */}
      {phase !== "report" && (
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
            {STEPS.map((step, i) => {
              const st = stepStatuses[i];
              return (
                <div key={step.key} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <StepIcon status={st} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          st === "done" ? "text-gray-700"
                          : st === "running" ? "text-blue-700"
                          : st === "error" ? "text-red-700"
                          : "text-gray-400"
                        }`}>
                          {step.label}
                        </span>
                        {st === "running" && (
                          <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">진행 중</span>
                        )}
                        {st === "done" && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">완료</span>
                        )}
                        {st === "pending" && (
                          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">대기</span>
                        )}
                        {st === "error" && (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">실패</span>
                        )}
                      </div>
                      {st === "pending" && (
                        <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                      )}
                      {(st === "running") && (
                        <p className="text-xs text-blue-500 mt-0.5">{step.description}</p>
                      )}
                      {stepDetails[i] && st === "done" && (
                        <p className="text-xs text-gray-500 mt-0.5">{stepDetails[i]}</p>
                      )}
                      {stepErrors[i] && st === "error" && (
                        <p className="text-xs text-red-500 mt-0.5">{stepErrors[i]}</p>
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
              >
                재시도
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                새 이슈 입력
              </a>
            </div>
          )}
        </div>
      )}

      {/* Phase: report → show report view */}
      {phase === "report" && report && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Report Header */}
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

              {/* Action buttons */}
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
                    setReport((prev) => prev ? { ...prev, status: "finalized" } : prev);
                    setIssue((prev) => prev ? { ...prev, status: "finalized" } : prev);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Report Content */}
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
        onUpdated={(md) => setReport((prev) => prev ? { ...prev, full_report_markdown: md } : prev)}
      />

      {/* Finalize Modal */}
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
