"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Props {
  markdown: string;
}

const components: Components = {
  p({ children, ...props }) {
    const text = String(children);
    if (text.startsWith("※ 검토 의견:")) {
      return (
        <div className="llm-opinion" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      );
    }
    return <p {...props}>{children}</p>;
  },
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300 text-sm" {...props}>
          {children}
        </table>
      </div>
    );
  },
  th({ children, ...props }) {
    return (
      <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold" {...props}>
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td className="border border-gray-300 px-3 py-2" {...props}>
        {children}
      </td>
    );
  },
  blockquote({ children, ...props }) {
    return (
      <blockquote
        className="border-l-4 border-gray-300 bg-gray-50 pl-4 py-2 my-2 text-gray-700 italic"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
};

export default function ReportViewer({ markdown }: Props) {
  return (
    <div className="report-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
