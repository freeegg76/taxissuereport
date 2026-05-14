interface Props {
  status: string;
  className?: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  created:        { label: "생성됨",   className: "bg-gray-100 text-gray-600" },
  analyzed:       { label: "분석완료", className: "bg-blue-100 text-blue-700" },
  searched:       { label: "검색완료", className: "bg-indigo-100 text-indigo-700" },
  report_ready:   { label: "초안",     className: "bg-yellow-100 text-yellow-700" },
  finalized:      { label: "확정",     className: "bg-green-100 text-green-700" },
  draft:          { label: "초안",     className: "bg-yellow-100 text-yellow-700" },
  error:          { label: "오류",     className: "bg-red-100 text-red-600" },
};

export default function StatusBadge({ status, className = "" }: Props) {
  const cfg = STATUS_MAP[status] ?? { label: status, className: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className} ${className}`}>
      {cfg.label}
    </span>
  );
}
