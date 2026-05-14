"use client";

import { useEffect, useState } from "react";

const PROVIDERS = ["gemini", "anthropic"] as const;
type Provider = (typeof PROVIDERS)[number];

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-6",
};

interface Config {
  provider: Provider;
  model: string;
  lawApiKey: string;
}

function loadConfig(): Config {
  if (typeof window === "undefined") {
    return { provider: "gemini", model: DEFAULT_MODELS.gemini, lawApiKey: "" };
  }
  try {
    const raw = localStorage.getItem("tax_agent_config");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { provider: "gemini", model: DEFAULT_MODELS.gemini, lawApiKey: "" };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config>({
    provider: "gemini",
    model: DEFAULT_MODELS.gemini,
    lawApiKey: "",
  });
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  function handleProviderChange(p: Provider) {
    setConfig((prev) => ({
      ...prev,
      provider: p,
      model: DEFAULT_MODELS[p],
    }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem("tax_agent_config", JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="px-6 py-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">LLM 및 API 설정을 관리합니다.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {/* LLM Provider */}
        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">LLM Provider</label>
          <div className="flex gap-3">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                  config.provider === p
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p === "gemini" ? "Google Gemini" : "Anthropic Claude"}
              </button>
            ))}
          </div>
        </div>

        {/* LLM Model */}
        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">LLM 모델</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => { setConfig((prev) => ({ ...prev, model: e.target.value })); setSaved(false); }}
            placeholder={DEFAULT_MODELS[config.provider]}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            {config.provider === "gemini"
              ? "예) gemini-2.5-flash, gemini-2.5-pro"
              : "예) claude-sonnet-4-6, claude-opus-4-7"}
          </p>
        </div>

        {/* LAW API Key */}
        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">LAW_API_KEY</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={config.lawApiKey}
              onChange={(e) => { setConfig((prev) => ({ ...prev, lawApiKey: e.target.value })); setSaved(false); }}
              placeholder="국가법령정보 OpenAPI 키"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-20 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              {showKey ? "숨김" : "확인"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            법제처 국가법령정보 OpenAPI에서 발급받은 키를 입력하세요.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          저장
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            저장되었습니다
          </span>
        )}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <p className="text-xs text-amber-700 leading-relaxed">
          <strong>참고:</strong> 이 설정은 브라우저 localStorage에 저장됩니다. 서버의 실제 환경변수를 변경하려면{" "}
          <code className="bg-amber-100 px-1 rounded font-mono">backend/.env</code> 파일을 직접 수정하세요.
        </p>
      </div>
    </div>
  );
}
