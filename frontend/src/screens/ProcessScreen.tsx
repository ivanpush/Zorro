import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAppStore } from '@/store';
import type {
  Finding,
  SSEEvent,
  AgentStartedEvent,
  AgentCompletedEvent,
  ChunkCompletedEvent,
  FindingDiscoveredEvent,
  ReviewCompletedEvent,
} from '@/types';

// API base URL
const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 'http://localhost:8000';

// Agent categories with detailed status
const AGENT_CATEGORIES: Array<{
  match: (id: string) => boolean;
  title: string;
  status: string;
}> = [
  {
    match: (id) => id.includes('briefing'),
    title: 'Understanding your document',
    status: 'Building a map of sections, claims, and evidence...',
  },
  {
    match: (id) => id.includes('clarity'),
    title: 'Reviewing multiple sections',
    status: 'Checking clarity across all paragraphs...',
  },
  {
    match: (id) => id.includes('rigor') && id.includes('find'),
    title: 'Finding methodological issues',
    status: 'Statistical methods, controls, and evidence...',
  },
  {
    match: (id) => id.includes('rigor') && id.includes('rewrite'),
    title: 'Drafting improvements',
    status: 'Writing suggested corrections...',
  },
  {
    match: (id) => id.includes('rigor'),
    title: 'Examining methodology & evidence',
    status: 'Statistical methods, controls, and reasoning...',
  },
  {
    match: (id) => id.includes('adversary'),
    title: 'Stress-testing arguments',
    status: 'Looking for gaps and counterarguments...',
  },
  {
    match: (id) => id.includes('domain'),
    title: 'Validating claims',
    status: 'Cross-referencing facts and citations...',
  },
  {
    match: (id) => id.includes('assembl') || id.includes('synth'),
    title: 'Synthesizing feedback',
    status: 'Merging and prioritizing suggestions...',
  },
];

// Fallback for unknown agents
const DEFAULT_AGENT = {
  title: 'Analyzing document',
  status: 'Processing content...',
};

function getAgentConfig(agentId: string) {
  const found = AGENT_CATEGORIES.find(cat => cat.match(agentId));
  return found || DEFAULT_AGENT;
}

// Map agent/category to human-readable type
function getFindingType(agentId: string, category?: string): string {
  const id = (agentId + ' ' + (category || '')).toLowerCase();
  if (id.includes('clarity') || id.includes('writing')) return 'writing';
  if (id.includes('adversar') || id.includes('rigor') || id.includes('argument')) return 'argument';
  return 'writing';
}

interface AgentNode {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed';
  liveStatus: string;
  chunksCompleted: number;
  totalChunks: number;
}

interface VisibleFinding extends Finding {
  isNew?: boolean;
  isExiting?: boolean;
}

export function ProcessScreen() {
  const navigate = useNavigate();
  const { reviewMode, currentDocument, reviewConfig, setFindings, setReviewMetrics } = useAppStore();

  const [_jobId, setJobId] = useState<string | null>(null);
  const [agentNodes, setAgentNodes] = useState<AgentNode[]>([]);
  const [discoveredFindings, setDiscoveredFindings] = useState<Finding[]>([]);
  const [visibleFindings, setVisibleFindings] = useState<VisibleFinding[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);
  const prevFindingCountRef = useRef(0);

  // Start timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Manage visible findings with animated exits and auto-decay
  const MAX_VISIBLE = 6;
  const DECAY_TIME = 8000; // Auto-decay after 8 seconds

  useEffect(() => {
    if (discoveredFindings.length === 0) return;

    const newFindings = discoveredFindings.map((f, i) => ({
      ...f,
      isNew: i === discoveredFindings.length - 1 && discoveredFindings.length > prevFindingCountRef.current,
      isExiting: false,
    }));

    // If we have more than max, mark old ones for exit
    if (newFindings.length > MAX_VISIBLE) {
      const toExitCount = newFindings.length - MAX_VISIBLE;
      const toExitIds = newFindings.slice(0, toExitCount).map(f => f.id);

      setExitingIds(new Set(toExitIds));

      setTimeout(() => {
        setVisibleFindings(newFindings.slice(-MAX_VISIBLE).map(f => ({ ...f, isNew: false })));
        setExitingIds(new Set());
      }, 300);

      setVisibleFindings(newFindings.map(f => ({
        ...f,
        isExiting: toExitIds.includes(f.id),
      })));
    } else {
      setVisibleFindings(newFindings);
      setTimeout(() => {
        setVisibleFindings(prev => prev.map(f => ({ ...f, isNew: false })));
      }, 500);
    }

    prevFindingCountRef.current = discoveredFindings.length;
  }, [discoveredFindings]);

  // Auto-decay: remove oldest finding periodically
  useEffect(() => {
    if (visibleFindings.length === 0 || !isProcessing) return;

    const decayTimer = setTimeout(() => {
      if (visibleFindings.length > 0) {
        const oldestId = visibleFindings[0].id;
        setExitingIds(new Set([oldestId]));

        setTimeout(() => {
          setVisibleFindings(prev => prev.slice(1));
          setExitingIds(new Set());
        }, 300);
      }
    }, DECAY_TIME);

    return () => clearTimeout(decayTimer);
  }, [visibleFindings, isProcessing]);

  // Start review
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (reviewMode === 'demo') {
      simulateDemoMode();
    } else {
      startRealReview();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const addAgent = (agentId: string, totalChunks: number = 0) => {
    const config = getAgentConfig(agentId);
    setAgentNodes(prev => [
      ...prev,
      {
        id: agentId,
        title: config.title,
        status: 'active',
        liveStatus: config.status,
        chunksCompleted: 0,
        totalChunks,
      }
    ]);
  };

  const completeAgent = (agentId: string) => {
    setAgentNodes(prev => prev.map(n =>
      n.id === agentId ? { ...n, status: 'completed' } : n
    ));
  };

  const simulateDemoMode = async () => {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Briefing
    addAgent('briefing');
    await sleep(2500);
    completeAgent('briefing');
    await sleep(400);

    // Clarity + Rigor in parallel
    addAgent('clarity');
    await sleep(200);
    addAgent('rigor');

    // Findings appear as agents work
    await sleep(1800);
    setDiscoveredFindings([{
      id: 'demo-1',
      agentId: 'clarity',
      category: 'clarity_paragraph',
      severity: 'minor',
      confidence: 0.85,
      title: 'Unclear methodology description',
      description: 'The methods section could benefit from more specific details about the experimental protocol.',
      anchors: [],
      createdAt: new Date().toISOString(),
    }]);

    await sleep(1400);
    setDiscoveredFindings(prev => [...prev, {
      id: 'demo-2',
      agentId: 'rigor_find',
      category: 'rigor_statistics',
      severity: 'major',
      confidence: 0.9,
      title: 'Missing statistical justification',
      description: 'Sample size rationale not provided. Consider adding a power analysis.',
      anchors: [],
      createdAt: new Date().toISOString(),
    }]);

    await sleep(1200);
    completeAgent('clarity');
    await sleep(800);
    completeAgent('rigor');
    await sleep(400);

    // Adversary
    addAgent('adversary');

    await sleep(2000);
    setDiscoveredFindings(prev => [...prev, {
      id: 'demo-3',
      agentId: 'adversary',
      category: 'adversarial_alternative',
      severity: 'major',
      confidence: 0.88,
      title: 'Alternative explanation not addressed',
      description: 'The discussion should consider competing hypotheses for the observed results.',
      anchors: [],
      createdAt: new Date().toISOString(),
    }]);

    await sleep(1500);
    completeAgent('adversary');
    await sleep(400);

    // Assembler
    addAgent('assembler');
    await sleep(1800);
    completeAgent('assembler');

    setIsProcessing(false);
    await sleep(600);
    navigate('/review');
  };

  const startRealReview = async () => {
    if (!currentDocument) {
      setError('No document loaded');
      return;
    }

    try {
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
    };
  };

  const handleSSEEvent = (event: SSEEvent) => {
    switch (event.type) {
      case 'agent_started': {
        const e = event as AgentStartedEvent;
        addAgent(e.agent_id);
        break;
      }

      case 'agent_completed': {
        const e = event as AgentCompletedEvent;
        completeAgent(e.agent_id);
        break;
      }

      case 'chunk_completed': {
        const e = event as ChunkCompletedEvent;
        setAgentNodes(prev => prev.map(n =>
          n.id === e.agent_id
            ? { ...n, chunksCompleted: e.chunk_index + 1, totalChunks: e.total_chunks }
            : n
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
        const finalFindings = e.findings && e.findings.length > 0 ? e.findings : discoveredFindings;
        setFindings(finalFindings);
        setIsProcessing(false);
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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Error: {error}</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 h-6">
          <div className="flex items-center gap-2">
            {discoveredFindings.length > 0 && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-orange-400/80 text-sm">
                  {discoveredFindings.length} {discoveredFindings.length === 1 ? 'finding' : 'findings'}
                </span>
              </>
            )}
          </div>
          <span className="text-gray-600 text-sm font-mono">
            {formatTime(elapsedTime)}
          </span>
        </div>

        {/* Agent Pipeline */}
        <div className="mb-12">
          {agentNodes.length === 0 ? (
            <div className="flex items-center gap-3 text-gray-500 text-sm">
              <div className="w-3 h-3 rounded-full border border-gray-600 animate-pulse" />
              <span className="animate-pulse">Preparing analysis...</span>
            </div>
          ) : (
            <div className="relative">
              {agentNodes.map((node, idx) => (
                <div key={node.id} className="relative">
                  {/* Connecting line to next node */}
                  {idx < agentNodes.length - 1 && (
                    <div
                      className="absolute left-[5px] top-[14px] w-px bg-gray-800"
                      style={{ height: 'calc(100% - 6px)' }}
                    />
                  )}

                  <div className="flex items-start gap-4 pb-6 last:pb-0">
                    {/* Node indicator */}
                    <div className="relative flex-shrink-0 mt-1">
                      {node.status === 'completed' ? (
                        <div className="w-3 h-3 rounded-full bg-emerald-500/40" />
                      ) : (
                        <div className="relative">
                          <div className="w-3 h-3 rounded-full border border-orange-400/70" />
                          <div className="absolute inset-0 w-3 h-3 rounded-full border border-orange-400/40 animate-ping" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${
                        node.status === 'completed' ? 'text-gray-500' : 'text-gray-200'
                      }`}>
                        {node.title}
                      </div>
                      {node.status === 'active' && (
                        <div className="mt-1.5">
                          <span className="text-xs text-gray-600 breathing-text">
                            {node.liveStatus}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress indicator */}
                    {node.status === 'active' && node.totalChunks > 0 && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-20 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400/80 rounded-full transition-all duration-300"
                            style={{ width: `${(node.chunksCompleted / node.totalChunks) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono">
                          {node.chunksCompleted}/{node.totalChunks}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Findings */}
        {visibleFindings.length > 0 && (
          <div className="border-t border-gray-800/50 pt-8">
            <div className="space-y-5">
              {visibleFindings.map((finding) => (
                <div
                  key={finding.id}
                  className={`
                    relative transition-all duration-300
                    ${finding.isExiting ? 'finding-exit' : ''}
                    ${finding.isNew ? 'finding-enter' : ''}
                  `}
                >
                  {/* Flash bar on new */}
                  {finding.isNew && (
                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-orange-400 rounded-full flash-bar" />
                  )}

                  <div className="relative">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wide">
                        {getFindingType(finding.agentId, finding.category)}
                      </span>
                      <span className="text-orange-400/90 text-sm">
                        {finding.title}
                      </span>
                    </div>
                    <div className="text-orange-400/40 text-xs mt-1 line-clamp-1">
                      {finding.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes breathing-text {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; }
        }
        @keyframes slide-in {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-out {
          0% { opacity: 1; }
          100% { opacity: 0; height: 0; margin: 0; overflow: hidden; }
        }
        @keyframes flash-glow {
          0% { opacity: 1; box-shadow: 0 0 12px rgba(251, 146, 60, 0.9); }
          100% { opacity: 0.5; box-shadow: none; }
        }
        .breathing-text {
          animation: breathing-text 1.5s ease-in-out infinite;
        }
        .finding-enter {
          animation: slide-in 0.35s ease-out forwards;
        }
        .finding-exit {
          animation: slide-out 0.25s ease-out forwards;
        }
        .flash-bar {
          animation: flash-glow 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
