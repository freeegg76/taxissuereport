"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/apiClient";
import { useTheme, type Theme } from "@/components/ThemeProvider";

const PROVIDERS = ["gemini", "anthropic"] as const;
type Provider = (typeof PROVIDERS)[number];

interface ServerConfig {
  llm_provider: Provider;
  anthropic_model: string;
  gemini_model: string;
  anthropic_key_masked: string;
  google_key_masked: string;
  law_key_masked: string;
  anthropic_key_set: boolean;
  google_key_set: boolean;
  law_key_set: boolean;
  setup_complete: boolean;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-6",
};

function KeyField({
  label, placeholder, value, maskedValue, isSet, onChange,
}: {
  label: string; placeholder: string; value: string;
  maskedValue: string; isSet: boolean; onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const displayValue = value || (show ? "" : maskedValue);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        {isSet && !value && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            설정됨
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isSet && !value ? "변경하려면 새 키를 입력하세요" : placeholder}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-16 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
        >
          {show ? "숨김" : "표시"}
        </button>
      </div>
    </div>
  );
}

type SaveState = "idle" | "saving" | "restarting" | "done" | "error";

// 테마 옵션 카드
function ThemeCard({ value, current, onSelect, icon, label, desc }: {
  value: Theme; current: Theme; onSelect: (t: Theme) => void;
  icon: React.ReactNode; label: string; desc: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex-1 flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all text-center ${
        active
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
      }`}
    >
      <div className={`text-2xl ${active ? "opacity-100" : "opacity-60"}`}>{icon}</div>
      <div>
        <p className={`text-sm font-semibold ${active ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>
      </div>
      {active && (
        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  );
}

export default function ConfigPage() {
  const { theme, setTheme } = useTheme();
  const [cfg, setCfg] = useState<ServerConfig | null>(null);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState(DEFAULT_MODELS.gemini);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [lawKey, setLawKey] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiClient.get("/config");
      const data: ServerConfig = res.data;
      setCfg(data);
      setProvider(data.llm_provider);
      setModel(data.llm_provider === "anthropic" ? data.anthropic_model : data.gemini_model);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  function handleProviderChange(p: Provider) {
    setProvider(p);
    setModel(DEFAULT_MODELS[p]);
    setAnthropicKey("");
    setGoogleKey("");
  }

  async function waitForBackend(maxWait = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try { await apiClient.get("/config", { timeout: 2000 }); return true; }
      catch { await new Promise((r) => setTimeout(r, 2000)); }
    }
    return false;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMsg("");
    try {
      const body: Record<string, string> = { llm_provider: provider };
      if (provider === "anthropic") {
        if (anthropicKey) body.anthropic_api_key = anthropicKey;
        body.anthropic_model = model;
      } else {
        if (googleKey) body.google_api_key = googleKey;
        body.gemini_model = model;
      }
      if (lawKey) body.law_api_key = lawKey;
      await apiClient.post("/config", body);
      setSaveState("restarting");
      try { await apiClient.post("/config/restart", {}, { timeout: 3000 }); } catch { /* expected */ }
      const ok = await waitForBackend();
      if (!ok) { setSaveState("error"); setErrorMsg("서버 재시작 시간이 초과되었습니다."); return; }
      await loadConfig();
      setAnthropicKey(""); setGoogleKey(""); setLawKey("");
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setErrorMsg(e?.response?.data?.detail || e?.message || "저장 중 오류가 발생했습니다.");
      setSaveState("error");
    }
  }

  const isRestarting = saveState === "restarting";
  const isSaving = saveState === "saving";
  const isBusy = isSaving || isRestarting;
  const llmKeySet = provider === "anthropic" ? cfg?.anthropic_key_set : cfg?.google_key_set;
  const llmKeyMasked = provider === "anthropic" ? (cfg?.anthropic_key_masked ?? "") : (cfg?.google_key_masked ?? "");
  const llmKeyValue = provider === "anthropic" ? anthropicKey : googleKey;
  const setLlmKey = provider === "anthropic" ? setAnthropicKey : setGoogleKey;

  return (
    <div style={{ minHeight: "100vh", background: "var(--clr-bg)" }}>
      {/* WEBDOT-style page header */}
      <div
        style={{
          background: "var(--clr-surface)",
          borderBottom: "1px solid var(--clr-border)",
          padding: "28px 48px 24px",
          marginBottom: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <a href="/" style={{ fontSize: 11, color: "var(--clr-muted)", textDecoration: "none" }}>홈</a>
          <span style={{ fontSize: 11, color: "var(--clr-border)" }}>/</span>
          <span style={{ fontSize: 11, color: "var(--clr-accent)", fontWeight: 600 }}>Configuration</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.025em", color: "var(--clr-text-strong)", marginBottom: 6 }}>
          Configuration
        </h1>
        <p style={{ fontSize: 12, color: "var(--clr-secondary)" }}>
          LLM 제공자, API 키, 테마를 설정합니다.
        </p>
      </div>

    <div className="px-12 py-8 max-w-xl">

      {/* Setup status */}
      {cfg && (
        <div className={`mb-5 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
          cfg.setup_complete
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
            : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
        }`}>
          {cfg.setup_complete ? (
            <>
              <svg className="w-5 h-5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              설정이 완료되었습니다. 서비스를 이용할 수 있습니다.
            </>
          ) : (
            <>
              <svg className="w-5 h-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              API 키를 설정해야 서비스를 이용할 수 있습니다.
            </>
          )}
        </div>
      )}

      {/* ── 테마 섹션 ── */}
      <div
        className="mb-5 rounded-2xl px-6 py-5"
        style={{ background: "var(--clr-surface)", border: "1px solid var(--clr-border)" }}
      >
        <p className="label-editorial mb-4">테마</p>
        <div className="flex gap-3">
          <ThemeCard
            value="light"
            current={theme}
            onSelect={setTheme}
            icon="☀️"
            label="라이트 모드"
            desc="밝은 배경"
          />
          <ThemeCard
            value="dark"
            current={theme}
            onSelect={setTheme}
            icon="🌙"
            label="다크 모드"
            desc="어두운 배경"
          />
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div
          className="rounded-2xl divide-y"
          style={{
            background: "var(--clr-surface)",
            border: "1px solid var(--clr-border)",
            "--tw-divide-color": "var(--clr-divider)",
          } as React.CSSProperties}
        >

          {/* Provider */}
          <div className="px-6 py-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">LLM Provider</label>
            <div className="flex gap-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderChange(p)}
                  disabled={isBusy}
                  className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                    provider === p
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {p === "gemini" ? "Google Gemini" : "Anthropic Claude"}
                </button>
              ))}
            </div>
          </div>

          {/* LLM API Key */}
          <div className="px-6 py-5">
            <KeyField
              label={provider === "gemini" ? "Google API Key" : "Anthropic API Key"}
              placeholder={provider === "gemini" ? "AIzaSy..." : "sk-ant-..."}
              value={llmKeyValue}
              maskedValue={llmKeyMasked}
              isSet={!!llmKeySet}
              onChange={setLlmKey}
            />
          </div>

          {/* Model */}
          <div className="px-6 py-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">LLM 모델</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isBusy}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              {provider === "gemini"
                ? "권장: gemini-2.5-flash, gemini-2.5-pro"
                : "권장: claude-sonnet-4-6, claude-opus-4-7"}
            </p>
          </div>

          {/* LAW API Key */}
          <div className="px-6 py-5">
            <KeyField
              label="국가법령정보 API Key (LAW_API_KEY)"
              placeholder="법제처 OpenAPI 키"
              value={lawKey}
              maskedValue={cfg?.law_key_masked ?? ""}
              isSet={!!cfg?.law_key_set}
              onChange={setLawKey}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              법제처 국가법령정보 OpenAPI(<span className="font-mono">open.law.go.kr</span>)에서 발급
            </p>
          </div>
        </div>

        {saveState === "error" && (
          <div className="mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        {isRestarting && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-blue-700 dark:text-blue-400">
            <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            설정을 적용하기 위해 서버를 재시작하는 중입니다... (최대 30초 소요)
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={isBusy}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {isSaving ? "저장 중..." : isRestarting ? "재시작 중..." : "저장 및 적용"}
          </button>
          {saveState === "done" && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              설정이 적용되었습니다
            </span>
          )}
        </div>
      </form>

      <div
        className="mt-6 rounded-xl px-5 py-4"
        style={{ background: "var(--clr-surface2)", border: "1px solid var(--clr-border)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "var(--clr-secondary)" }}>
          설정값은 <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">backend/.env</span> 파일에 저장됩니다.
          저장 후 서버가 자동으로 재시작되어 새 설정이 즉시 반영됩니다.
        </p>
      </div>
    </div>
    </div>
  );
}
