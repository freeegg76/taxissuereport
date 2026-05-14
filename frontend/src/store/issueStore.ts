import { create } from "zustand";

export type WorkflowStatus =
  | "idle"
  | "created"
  | "analyzed"
  | "searching"
  | "searched"
  | "report_generating"
  | "report_ready"
  | "finalized";

interface IssueState {
  issueId: number | null;
  status: WorkflowStatus;
  reportMarkdown: string | null;
  reportId: number | null;
  isLoading: boolean;
  error: string | null;
  setIssueId: (id: number) => void;
  setStatus: (s: WorkflowStatus) => void;
  setReport: (markdown: string, reportId: number) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useIssueStore = create<IssueState>((set) => ({
  issueId: null,
  status: "idle",
  reportMarkdown: null,
  reportId: null,
  isLoading: false,
  error: null,
  setIssueId: (id) => set({ issueId: id }),
  setStatus: (s) => set({ status: s }),
  setReport: (markdown, reportId) => set({ reportMarkdown: markdown, reportId }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg }),
  reset: () =>
    set({ issueId: null, status: "idle", reportMarkdown: null, reportId: null, error: null }),
}));
