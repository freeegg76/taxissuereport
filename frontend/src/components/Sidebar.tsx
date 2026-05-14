"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";

interface Issue {
  issue_id: number;
  title: string | null;
  raw_input: string;
  status: string;
  created_at: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [recentIssues, setRecentIssues] = useState<Issue[]>([]);

  useEffect(() => {
    apiClient
      .get("/issues?limit=10")
      .then((r) => setRecentIssues(r.data.slice(0, 10)))
      .catch(() => {});
  }, [pathname]);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  function issueLabel(issue: Issue) {
    return issue.title || issue.raw_input.slice(0, 20) + "…";
  }

  return (
    <aside
      className="flex flex-col bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto"
      style={{ width: "var(--sidebar-width, 240px)", minWidth: 240 }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <span className="text-base font-bold text-blue-700 tracking-tight">세무 AI 어시스턴트</span>
      </div>

      {/* New Issue Button */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={() => router.push("/")}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          새 이슈 분석
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <Link
          href="/issues"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/issues"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          이슈 목록
        </Link>
      </div>

      {/* Divider */}
      <div className="px-3 py-1">
        <div className="border-t border-gray-100" />
      </div>

      {/* Recent Issues */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 mb-2">최근 이슈</p>
        {recentIssues.length === 0 ? (
          <p className="text-xs text-gray-400 px-3">이슈가 없습니다.</p>
        ) : (
          <ul className="space-y-0.5">
            {recentIssues.map((issue) => {
              const href = `/issues/${issue.issue_id}`;
              const isActive = pathname === href;
              return (
                <li key={issue.issue_id}>
                  <Link
                    href={href}
                    className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span className="truncate font-medium text-xs leading-tight">
                      {issueLabel(issue)}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(issue.created_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Config Link */}
      <div className="px-3 py-3 border-t border-gray-100">
        <Link
          href="/config"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/config"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuration
        </Link>
      </div>
    </aside>
  );
}
