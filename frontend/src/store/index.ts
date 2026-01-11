import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DocObj,
  Finding,
  Decision,
  ReviewConfig,
  ReviewMode,
  ReviewJob
} from '@/types';

// Metrics from review completion
export interface ReviewMetrics {
  total_time_ms: number;
  total_cost_usd: number;
  agents_run: number;
  // Per-agent breakdown (optional)
  agent_metrics?: Record<string, { time_ms: number; cost_usd: number; findings_count: number }>;
}

interface AppState {
  // Review mode
  reviewMode: ReviewMode;
  setReviewMode: (mode: ReviewMode) => void;

  // Document state
  currentDocument: DocObj | null;
  setCurrentDocument: (doc: DocObj | null) => void;

  // Review configuration
  reviewConfig: ReviewConfig | null;
  setReviewConfig: (config: ReviewConfig | null) => void;

  // Review job (for dynamic mode)
  currentJob: ReviewJob | null;
  setCurrentJob: (job: ReviewJob | null) => void;

  // Findings
  findings: Finding[];
  setFindings: (findings: Finding[]) => void;
  addFinding: (finding: Finding) => void;

  // Review metrics (for dev banner)
  reviewMetrics: ReviewMetrics | null;
  setReviewMetrics: (metrics: ReviewMetrics | null) => void;

  // Decisions
  decisions: Map<string, Decision>;
  addDecision: (decision: Decision) => void;
  removeDecision: (findingId: string) => void;
  clearDecisions: () => void;

  // UI state
  selectedFindingId: string | null;
  setSelectedFindingId: (id: string | null) => void;

  // Reset everything
  reset: () => void;
}

const initialState = {
  reviewMode: 'demo' as ReviewMode,
  currentDocument: null,
  reviewConfig: null,
  currentJob: null,
  findings: [],
  reviewMetrics: null as ReviewMetrics | null,
  decisions: new Map<string, Decision>(),
  selectedFindingId: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      setReviewMode: (mode) => set({ reviewMode: mode }),

      setCurrentDocument: (doc) => set({ currentDocument: doc }),

      setReviewConfig: (config) => set({ reviewConfig: config }),

      setCurrentJob: (job) => set({ currentJob: job }),

      setFindings: (findings) => set({ findings }),

      addFinding: (finding) =>
        set((state) => ({ findings: [...state.findings, finding] })),

      setReviewMetrics: (metrics) => set({ reviewMetrics: metrics }),

      addDecision: (decision) =>
        set((state) => {
          const newDecisions = new Map(state.decisions);
          newDecisions.set(decision.finding_id, decision);
          return { decisions: newDecisions };
        }),

      removeDecision: (findingId) =>
        set((state) => {
          const newDecisions = new Map(state.decisions);
          newDecisions.delete(findingId);
          return { decisions: newDecisions };
        }),

      clearDecisions: () => set({ decisions: new Map() }),

      setSelectedFindingId: (id) => set({ selectedFindingId: id }),

      reset: () => set(initialState),
    }),
    {
      name: 'zorro-app-storage',
      // Don't persist UI state
      partialize: (state) => ({
        reviewMode: state.reviewMode,
        currentDocument: state.currentDocument,
        reviewConfig: state.reviewConfig,
        findings: state.findings,
        decisions: Array.from(state.decisions.entries()),
      }),
      // Rehydrate decisions Map
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.decisions)) {
          state.decisions = new Map(state.decisions);
        }
      },
    }
  )
);