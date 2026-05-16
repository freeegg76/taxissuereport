"use client";

import { useEffect, useRef, useState } from "react";
import apiClient from "@/lib/apiClient";

interface Props {
  issueId: number;
  isFinalized: boolean;
  onFinalized: () => void;
}

type ToastState = {
  type: "docx" | "pdf";
  status: "loading" | "done" | "error";
  message: string;
  fileUrl?: string;
} | null;

export default function ExportDropdown({ issueId, isFinalized, onFinalized }: Props) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-dismiss toast after 8s on done/error
  useEffect(() => {
    if (toast && toast.status !== "loading") {
      const t = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function exportFile(type: "docx" | "pdf") {
    setOpen(false);
    setToast({ type, status: "loading", message: `${type.toUpperCase()} 생성 중...` });
    try {
      const res = await apiClient.post(`/issues/${issueId}/report/export/${type}`);
      const base = (apiClient.defaults.baseURL || "").replace(/\/api\/v1$/, "");
      const rawUrl: string = res.data.download_url || "";
      const fileUrl = `${base}${rawUrl}`;
      setToast({
        type,
        status: "done",
        message: "다운로드 준비 완료",
        fileUrl,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || `${type.toUpperCase()} 생성 실패`;
      setToast({ type, status: "error", message: msg });
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Dropdown trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors bg-white"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        내보내기
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
          <button
            onClick={() => exportFile("docx")}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-blue-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Word 문서 (.docx)
          </button>
          <button
            onClick={() => exportFile("pdf")}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </span>
            PDF 문서 (.pdf)
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 min-w-72 bg-white border rounded-xl shadow-xl px-4 py-3 flex items-start gap-3 toast-enter ${
            toast.status === "error" ? "border-red-200" : "border-gray-200"
          }`}
        >
          {toast.status === "loading" && (
            <svg className="animate-spin h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {toast.status === "done" && (
            <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.status === "error" && (
            <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">
              {toast.type.toUpperCase()} {toast.status === "loading" ? "생성 중" : toast.status === "done" ? "완료" : "오류"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{toast.message}</p>
            {toast.status === "done" && toast.fileUrl && (
              <a
                href={toast.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                다운로드
              </a>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
