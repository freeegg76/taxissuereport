"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";

const MAX_FEEDBACK = 1000;

interface FeedbackEntry {
  text: string;
  at: string;
}

interface Props {
  issueId: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (markdown: string) => void;
}

export default function FeedbackPanel({ issueId, isOpen, onClose, onUpdated }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<FeedbackEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setSearching(false);
    setError(null);
    try {
      const res = await apiClient.put(`/issues/${issueId}/report/feedback`, {
        feedback_text: text,
      });
      if (res.data?.searched_count > 0) setSearching(true);
      const reportRes = await apiClient.get(`/issues/${issueId}/report`);
      onUpdated(reportRes.data.full_report_markdown);
      setHistory((prev) => [
        { text: text.slice(0, 60) + (text.length > 60 ? "…" : ""), at: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) },
        ...prev,
      ]);
      setText("");
      setSearching(false);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e?.response?.data?.detail || e?.message || "피드백 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div
        className="w-full sm:w-[400px] bg-white shadow-2xl flex flex-col h-full panel-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">피드백 입력</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">
                  수정 요청 내용 <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs ${text.length > MAX_FEEDBACK * 0.9 ? "text-orange-500" : "text-gray-400"}`}>
                  {text.length}/{MAX_FEEDBACK}
                </span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_FEEDBACK))}
                placeholder="예) 대법원 판례 위주로 재구성해 주세요. / 결론 섹션을 더 명확하게 써주세요."
                rows={6}
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
              />
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                판례 재검색 중...
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">이전 피드백</p>
                <ul className="space-y-2">
                  {history.map((h, i) => (
                    <li key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">{h.at}</p>
                      <p className="text-sm text-gray-700">&ldquo;{h.text}&rdquo;</p>
                      <p className="text-xs text-green-600 mt-1">→ 반영 완료</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  처리 중...
                </>
              ) : (
                "반영하기"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
