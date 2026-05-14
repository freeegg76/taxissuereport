"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";

const MAX_INPUT = 2000;
const MIN_INPUT = 10;
const MAX_TITLE = 100;

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCount = rawInput.length;
  const isValid = rawInput.trim().length >= MIN_INPUT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post("/issues", {
        title: title.trim() || undefined,
        raw_input: rawInput,
      });
      router.push(`/issues/${res.data.issue_id}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e?.response?.data?.detail || e?.message || "이슈 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-16 px-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">세무 이슈 분석</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            세무 이슈를 자연어로 입력하면 관련 판례를 검색하고 분석 보고서를 자동 생성합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              제목 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              placeholder="예) 부당행위계산부인 검토"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {title.length > 80 && (
              <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/{MAX_TITLE}</p>
            )}
          </div>

          {/* Raw Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                세무 이슈 <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs ${inputCount > MAX_INPUT * 0.9 ? "text-orange-500" : "text-gray-400"}`}>
                {inputCount.toLocaleString()} / {MAX_INPUT.toLocaleString()}
              </span>
            </div>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value.slice(0, MAX_INPUT))}
              placeholder="예) 법인이 대표이사에게 시가보다 낮은 가격으로 부동산을 양도한 경우 부당행위계산부인 적용 여부를 검토해 주세요."
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            />
            {rawInput.length > 0 && rawInput.trim().length < MIN_INPUT && (
              <p className="text-xs text-red-400 mt-1">최소 {MIN_INPUT}자 이상 입력하세요.</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
              "분석 시작"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
