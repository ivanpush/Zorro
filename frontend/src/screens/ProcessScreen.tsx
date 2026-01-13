import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, Search } from 'lucide-react';
import { useAppStore } from '@/store';
import type {
  Finding,
  SSEEvent,
  PhaseStartedEvent,
  AgentStartedEvent,
  AgentCompletedEvent,
  ChunkCompletedEvent,
  FindingDiscoveredEvent,
  ReviewCompletedEvent,
} from '@/types';

// API base URL - use environment variable or default
const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 'http://localhost:8000';

// Pipeline phases matching backend
const PHASES = ['researching', 'assessing', 'evaluating', 'synthesizing'] as const;
type Phase = typeof PHASES[number];

const PHASE_LABELS: Record<Phase, string> = {
  researching: 'Researching...',
  assessing: 'Assessing...',
  evaluating: 'Evaluating...',
  synthesizing: 'Synthesizing...',
};

interface ActiveAgent {
  id: string;
  title: string;
  subtitle: string;
  chunksCompleted?: number;
  totalChunks?: number;
}

export function ProcessScreen() {
  const navigate = useNavigate();
  const { reviewMode, currentDocument, reviewConfig, setFindings, setReviewMetrics } = useAppStore();

  const [_jobId, setJobId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>('researching');
  const [activeAgents, setActiveAgents] = useState<ActiveAgent[]>([]);
  const [discoveredFindings, setDiscoveredFindings] = useState<Finding[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);

  // Start timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start review and connect to SSE (guard against StrictMode double-mount)
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (reviewMode === 'demo') {
      // In demo mode, run simulation then navigate
      simulateDemoMode();
    } else {
      // Dynamic mode - start real review
      startRealReview();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const simulateDemoMode = async () => {
    // Quick simulation for demo mode
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    setActiveAgents([{ id: 'briefing', title: 'Reading document', subtitle: 'Analyzing structure' }]);
    await sleep(1000);

    setCurrentPhase('assessing');
    setActiveAgents([
      { id: 'clarity', title: 'Reviewing writing style', subtitle: 'Checking clarity' },
      { id: 'rigor', title: 'Evaluating rigor', subtitle: 'Methods and evidence' },
    ]);
    await sleep(1500);

    setCurrentPhase('evaluating');
    setActiveAgents([{ id: 'adversary', title: 'Challenging arguments', subtitle: "Devil's advocate" }]);
    await sleep(1000);

    setCurrentPhase('synthesizing');
    setActiveAgents([{ id: 'assembler', title: 'Synthesizing results', subtitle: 'Deduplicating' }]);
    await sleep(500);

    navigate('/review');
  };

  const startRealReview = async () => {
    if (!currentDocument) {
      setError('No document loaded');
      return;
    }

    try {
      // Start the review job
      const response = await fetch(`${API_BASE}/review/demo/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: currentDocument,
          config: {
            panel_mode: reviewConfig?.reviewMode === 'panel-review',
            steering_memo: reviewConfig?.steeringMemo || null,
            enable_domain: reviewConfig?.enableDomainValidation ?? true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start review: ${response.statusText}`);
      }

      const data = await response.json();
      setJobId(data.job_id);

      // Connect to SSE stream
      connectToStream(data.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const connectToStream = (jobId: string) => {
    const eventSource = new EventSource(`${API_BASE}/review/${jobId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        handleSSEEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();
      // Don't set error - might just be stream ending
    };
  };

  const handleSSEEvent = (event: SSEEvent) => {
    switch (event.type) {
      case 'phase_started': {
        const e = event as PhaseStartedEvent;
        if (PHASES.includes(e.phase as Phase)) {
          setCurrentPhase(e.phase as Phase);
        }
        break;
      }

      case 'agent_started': {
        const e = event as AgentStartedEvent;
        setActiveAgents(prev => [
          ...prev,
          { id: e.agent_id, title: e.title, subtitle: e.subtitle }
        ]);
        break;
      }

      case 'agent_completed': {
        const e = event as AgentCompletedEvent;
        setActiveAgents(prev => prev.filter(a => a.id !== e.agent_id));
        break;
      }

      case 'chunk_completed': {
        const e = event as ChunkCompletedEvent;
        setActiveAgents(prev => prev.map(a =>
          a.id === e.agent_id
            ? { ...a, chunksCompleted: e.chunk_index + 1, totalChunks: e.total_chunks }
            : a
        ));
        break;
      }

      case 'finding_discovered': {
        const e = event as FindingDiscoveredEvent;
        setDiscoveredFindings(prev => [...prev, e.finding]);
        break;
      }

      case 'review_completed': {
        const e = event as ReviewCompletedEvent;
        // Store findings (prefer from event if available, fallback to accumulated)
        const finalFindings = e.findings && e.findings.length > 0 ? e.findings : discoveredFindings;
        setFindings(finalFindings);
        // Store metrics for dev banner
        if (e.metrics) {
          setReviewMetrics({
            total_time_ms: e.metrics.total_time_ms || 0,
            total_cost_usd: e.metrics.total_cost_usd || 0,
            agents_run: e.metrics.agents_run || [],
            agent_metrics: e.metrics.agent_metrics,
          });
        }
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => navigate('/review'), 500);
        break;
      }

      case 'error': {
        setError(event.message);
        break;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseIndex = (phase: Phase) => PHASES.indexOf(phase);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Error: {error}</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header: Issue count + Timer */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-teal-400 text-lg font-medium">
              {discoveredFindings.length} Suggestions found
            </span>
          </div>
          <span className="text-gray-400 font-mono">
            {formatTime(elapsedTime)}
          </span>
        </div>

        {/* Active Agents Section */}
        <div className="bg-[#1a1a1d] rounded-xl p-5 mb-6 border border-gray-800">
          {activeAgents.length === 0 ? (
            <div className="text-gray-500 text-sm">Starting analysis...</div>
          ) : (
            <div className="space-y-4">
              {activeAgents.map((agent) => (
                <div key={agent.id} className="flex items-start gap-3">
                  <div className="mt-1">
                    {agent.id === activeAgents[0]?.id ? (
                      <Circle className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Search className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-white font-medium">{agent.title}</div>
                      {agent.totalChunks && (
                        <span className="text-xs text-teal-400 font-mono">
                          {agent.chunksCompleted || 0}/{agent.totalChunks}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-sm">{agent.subtitle}</div>
                    {agent.totalChunks && (
                      <div className="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-400 transition-all duration-300"
                          style={{ width: `${((agent.chunksCompleted || 0) / agent.totalChunks) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discovered Findings Section */}
        {discoveredFindings.length > 0 && (
          <div className="bg-[#1a1a1d] rounded-xl p-5 mb-8 border border-gray-800 max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {discoveredFindings.slice(-10).map((finding) => (
                <div
                  key={finding.id}
                  className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="w-2 h-2 rounded-full bg-teal-400 mt-2 flex-shrink-0" />
                  <div className="border-l-2 border-teal-400/30 pl-3">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                      ALL
                    </span>
                    <div className="text-teal-400 font-medium">
                      {finding.title}
                    </div>
                    <div className="text-gray-400 text-sm line-clamp-1">
                      {finding.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pipeline Phases - Bottom */}
        <div className="flex justify-center gap-8">
          {PHASES.map((phase, idx) => {
            const isActive = getPhaseIndex(currentPhase) >= idx;
            const isCurrent = currentPhase === phase;

            return (
              <div key={phase} className="flex flex-col items-center gap-2">
                <span className={`text-sm ${isActive ? 'text-white' : 'text-gray-600'}`}>
                  {PHASE_LABELS[phase]}
                </span>
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                      : isActive
                        ? 'bg-teal-400'
                        : 'bg-gray-700'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
