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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── 페이지 헤더 (WEBDOT article header style) ── */}
      <div
        style={{
          background: "var(--clr-surface)",
          borderBottom: "1px solid var(--clr-border)",
          padding: "32px 48px 28px",
        }}
      >
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: "var(--clr-muted)" }}>홈</span>
          <span style={{ fontSize: 11, color: "var(--clr-border)" }}>/</span>
          <span style={{ fontSize: 11, color: "var(--clr-accent)", fontWeight: 600 }}>새 이슈 분석</span>
        </div>

        {/* Category tag */}
        <div style={{ marginBottom: 16 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 10, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "4px 10px",
              background: "rgba(37,99,235,0.08)",
              color: "var(--clr-accent)",
              border: "1px solid rgba(37,99,235,0.18)",
              borderRadius: 4,
            }}
          >
            세무 AI 분석
          </span>
        </div>

        <h1
          style={{
            fontSize: 28, fontWeight: 900,
            color: "var(--clr-text-strong)",
            letterSpacing: "-0.03em", lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          세무 이슈 분석 보고서 생성
        </h1>
        <p style={{ fontSize: 13, color: "var(--clr-secondary)", lineHeight: 1.7, maxWidth: 540 }}>
          세무 이슈를 자연어로 입력하면 관련 판례를 검색하고
          AI가 분석 보고서를 자동으로 생성합니다.
        </p>
      </div>

      {/* ── 본문 (form) ── */}
      <div style={{ flex: 1, padding: "36px 48px", maxWidth: 780, width: "100%" }}>

        {/* 선정 기준 스타일 안내 박스 */}
        <div className="callout-info" style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--clr-accent)", marginBottom: 8,
            }}
          >
            입력 가이드
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              "구체적인 거래 유형과 당사자 관계를 포함하세요",
              "관련 세목(법인세, 소득세, 부가세 등)을 명시하면 더 정확한 분석이 가능합니다",
              "판례 검색을 위해 쟁점이 되는 행위나 거래를 명확히 기술해주세요",
            ].map((t, i) => (
              <li key={i} style={{ fontSize: 12, color: "var(--clr-secondary)", lineHeight: 1.6 }}>{t}</li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* 제목 */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--clr-secondary)",
                }}
              >
                제목
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, color: "var(--clr-muted)" }}>
                  (선택)
                </span>
              </label>
              {title.length > 80 && (
                <span style={{ fontSize: 11, color: "var(--clr-muted)", fontFamily: "monospace" }}>
                  {title.length}/{MAX_TITLE}
                </span>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              placeholder="예) 부당행위계산부인 검토"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "var(--clr-surface)",
                border: "1.5px solid var(--clr-border)",
                borderRadius: 8,
                padding: "11px 14px",
                fontSize: 14,
                color: "var(--clr-text-strong)",
                outline: "none",
                transition: "border-color 0.15s",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--clr-accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--clr-border)")}
            />
          </div>

          {/* 세무 이슈 */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--clr-secondary)",
                }}
              >
                세무 이슈
                <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
              </label>
              <span
                style={{
                  fontSize: 11, fontFamily: "monospace",
                  color: inputCount > MAX_INPUT * 0.9 ? "#f97316" : "var(--clr-muted)",
                }}
              >
                {inputCount.toLocaleString()} / {MAX_INPUT.toLocaleString()}
              </span>
            </div>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value.slice(0, MAX_INPUT))}
              placeholder="예) 법인이 대표이사에게 시가보다 낮은 가격으로 부동산을 양도한 경우 부당행위계산부인 적용 여부를 검토해 주세요."
              rows={7}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "var(--clr-surface)",
                border: "1.5px solid var(--clr-border)",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 14,
                color: "var(--clr-text-strong)",
                outline: "none",
                resize: "none",
                lineHeight: 1.75,
                transition: "border-color 0.15s",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--clr-accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--clr-border)")}
            />
            {rawInput.length > 0 && rawInput.trim().length < MIN_INPUT && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>
                최소 {MIN_INPUT}자 이상 입력하세요.
              </p>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px", borderRadius: 8, fontSize: 13,
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            style={{
              alignSelf: "flex-start",
              padding: "12px 32px",
              background: loading || !isValid ? "var(--clr-muted)" : "var(--clr-accent)",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.04em",
              cursor: loading || !isValid ? "not-allowed" : "pointer",
              opacity: loading || !isValid ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "opacity 0.15s, background 0.15s",
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                분석 중...
              </>
            ) : "분석 시작 →"}
          </button>
        </form>
      </div>
    </div>
  );
}
