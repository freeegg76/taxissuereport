"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/apiClient";

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
  label,
  placeholder,
  value,
  maskedValue,
  isSet,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  maskedValue: string;
  isSet: boolean;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const displayValue = value || (show ? "" : maskedValue);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {isSet && !value && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 font-medium"
        >
          {show ? "숨김" : "표시"}
        </button>
      </div>
    </div>
  );
}

type SaveState = "idle" | "saving" | "restarting" | "done" | "error";

export default function ConfigPage() {
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
    } catch {
      // Backend not yet reachable (restarting) — retry
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  function handleProviderChange(p: Provider) {
    setProvider(p);
    setModel(DEFAULT_MODELS[p]);
    setAnthropicKey("");
    setGoogleKey("");
  }

  async function waitForBackend(maxWait = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        await apiClient.get("/config", { timeout: 2000 });
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
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

      // Trigger server restart
      setSaveState("restarting");
      try {
        await apiClient.post("/config/restart", {}, { timeout: 3000 });
      } catch {
        // Connection closed by restart — expected
      }

      // Poll until backend comes back up
      const ok = await waitForBackend();
      if (!ok) {
        setSaveState("error");
        setErrorMsg("서버 재시작 시간이 초과되었습니다. start.bat을 재실행해주세요.");
        return;
      }

      // Reload config from fresh server
      await loadConfig();
      setAnthropicKey("");
      setGoogleKey("");
      setLawKey("");
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
    <div className="px-6 py-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">LLM 제공자 및 API 키를 설정합니다.</p>
      </div>

      {/* Setup status */}
      {cfg && (
        <div className={`mb-5 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
          cfg.setup_complete
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
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

      <form onSubmit={handleSave}>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">

          {/* Provider */}
          <div className="px-6 py-5">
            <label className="block text-sm font-medium text-gray-700 mb-3">LLM Provider</label>
            <div className="flex gap-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderChange(p)}
                  disabled={isBusy}
                  className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                    provider === p
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">LLM 모델</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isBusy}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 mt-1.5">
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
            <p className="text-xs text-gray-400 mt-1.5">
              법제처 국가법령정보 OpenAPI(<span className="font-mono">open.law.go.kr</span>)에서 발급
            </p>
          </div>
        </div>

        {/* Error */}
        {saveState === "error" && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Restarting indicator */}
        {isRestarting && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-blue-700">
            <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            설정을 적용하기 위해 서버를 재시작하는 중입니다... (최대 30초 소요)
          </div>
        )}

        {/* Save button */}
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
            <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              설정이 적용되었습니다
            </span>
          )}
        </div>
      </form>

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          설정값은 <span className="font-mono bg-gray-100 px-1 rounded">backend/.env</span> 파일에 저장됩니다.
          저장 후 서버가 자동으로 재시작되어 새 설정이 즉시 반영됩니다.
        </p>
      </div>
    </div>
  );
}
