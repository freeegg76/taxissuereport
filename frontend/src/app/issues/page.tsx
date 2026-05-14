"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import StatusBadge from "@/components/StatusBadge";

interface Issue {
  issue_id: number;
  title: string | null;
  raw_input: string;
  status: string;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function IssuesPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiClient
      .get("/issues")
      .then((r) => setIssues(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = issues.filter((i) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (i.title || "").toLowerCase().includes(q) ||
      i.raw_input.toLowerCase().includes(q)
    );
  });

  function handleRowClick(issue: Issue) {
    router.push(`/issues/${issue.issue_id}`);
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">이슈 목록</h1>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이슈 검색..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 font-medium mb-1">
            {query ? "검색 결과가 없습니다." : "이슈가 없습니다."}
          </p>
          {!query && (
            <p className="text-gray-400 text-sm">
              새 이슈를 입력하여 분석을 시작하세요.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 w-28">
                  일자
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  제목
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 w-24">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((issue) => (
                <tr
                  key={issue.issue_id}
                  onClick={() => handleRowClick(issue)}
                  className="cursor-pointer hover:bg-blue-50 transition-colors group"
                >
                  <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(issue.created_at)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-gray-800 group-hover:text-blue-700 font-medium truncate block max-w-md">
                      {issue.title || issue.raw_input.slice(0, 50) + (issue.raw_input.length > 50 ? "…" : "")}
                    </span>
                    {issue.title && (
                      <span className="text-gray-400 text-xs truncate block max-w-md mt-0.5">
                        {issue.raw_input.slice(0, 60)}…
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <StatusBadge status={issue.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
