interface Props {
  status: string;
  className?: string;
}

const STATUS_MAP: Record<string, { label: string; style: React.CSSProperties }> = {
  created:      { label: "생성됨",   style: { background: "var(--clr-surface2)", color: "var(--clr-secondary)", border: "1px solid var(--clr-border)" } },
  analyzed:     { label: "분석완료", style: { background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)" } },
  searched:     { label: "검색완료", style: { background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" } },
  report_ready: { label: "초안",     style: { background: "rgba(234,179,8,0.1)", color: "#ca8a04", border: "1px solid rgba(234,179,8,0.25)" } },
  finalized:    { label: "확정",     style: { background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)" } },
  draft:        { label: "초안",     style: { background: "rgba(234,179,8,0.1)", color: "#ca8a04", border: "1px solid rgba(234,179,8,0.25)" } },
  error:        { label: "오류",     style: { background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" } },
};

export default function StatusBadge({ status, className = "" }: Props) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    style: { background: "var(--clr-surface2)", color: "var(--clr-muted)", border: "1px solid var(--clr-border)" },
  };
  return (
    <span
      className={className}
      style={{
        ...cfg.style,
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}
