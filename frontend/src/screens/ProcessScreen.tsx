import { useEffect, useState, useRef, useCallback } from 'react';
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

// Agent categories with rotating status messages
const AGENT_CATEGORIES: Array<{
  match: (id: string) => boolean;
  title: string;
  statuses: string[];
}> = [
  {
    match: (id) => id.includes('briefing'),
    title: 'Understanding your document',
    statuses: [
      'Parsing document structure and sections...',
      'Identifying the abstract and introduction...',
      'Mapping out the methodology section...',
      'Building a mental model of your argument...',
      'Extracting key claims and evidence...',
    ],
  },
  {
    match: (id) => id.includes('clarity'),
    title: 'Examining clarity and readability',
    statuses: [
      'Checking sentence complexity...',
      'Looking for ambiguous references...',
      'Evaluating paragraph flow and transitions...',
      'Identifying jargon that may need explanation...',
      'Scanning for passive voice overuse...',
    ],
  },
  {
    match: (id) => id.includes('rigor'),
    title: 'Evaluating scientific rigor',
    statuses: [
      'Examining the experimental design...',
      'Checking if controls are adequate...',
      'Reviewing statistical methodology...',
      'Looking for potential confounders...',
      'Assessing sample size justification...',
    ],
  },
  {
    match: (id) => id.includes('adversary'),
    title: 'Stress-testing your arguments',
    statuses: [
      'Looking for alternative explanations...',
      'Checking if counterarguments are addressed...',
      'Testing the logical chain of reasoning...',
      'Considering what a skeptical reviewer would ask...',
    ],
  },
  {
    match: (id) => id.includes('domain'),
    title: 'Validating against the literature',
    statuses: [
      'Cross-referencing key claims...',
      'Checking terminology conventions...',
      'Comparing methodology to field standards...',
      'Verifying cited facts and figures...',
    ],
  },
  {
    match: (id) => id.includes('assembl') || id.includes('synth'),
    title: 'Synthesizing all feedback',
    statuses: [
      'Merging overlapping suggestions...',
      'Prioritizing by impact and severity...',
      'Removing redundant findings...',
    ],
  },
];

// Fallback for unknown agents
const DEFAULT_AGENT = {
  title: 'Analyzing your document',
  statuses: ['Processing...', 'Evaluating content...', 'Reviewing sections...'],
};

function getAgentConfig(agentId: string) {
  const found = AGENT_CATEGORIES.find(cat => cat.match(agentId));
  return found || DEFAULT_AGENT;
}

// Map agent/category to human-readable type
function getFindingType(agentId: string, category?: string): string {
  const id = (agentId + ' ' + (category || '')).toLowerCase();
  if (id.includes('clarity') || id.includes('writing')) return 'writing';
  if (id.includes('rigor') || id.includes('statistic') || id.includes('method')) return 'rigor';
  if (id.includes('adversar') || id.includes('argument') || id.includes('alternative')) return 'argument';
  if (id.includes('domain') || id.includes('literature')) return 'domain';
  return 'review';
}

// Sample document snippets for demo mode (simulate "reading" real text)
const DEMO_SNIPPETS = [
  '"...the proposed methodology enables..."',
  '"...significant improvement over baseline..."',
  '"...limitations of this approach include..."',
  '"...our results demonstrate that..."',
  '"...further research is needed to..."',
  '"...we hypothesize that the mechanism..."',
];

interface AgentNode {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed';
  liveStatus: string;
  streamedText?: string;
}

export function ProcessScreen() {
  const navigate = useNavigate();
  const { reviewMode, currentDocument, reviewConfig, setFindings, setReviewMetrics } = useAppStore();

  const [_jobId, setJobId] = useState<string | null>(null);
  const [agentNodes, setAgentNodes] = useState<AgentNode[]>([]);
  const [discoveredFindings, setDiscoveredFindings] = useState<Finding[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [flashingFindingId, setFlashingFindingId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);
  const statusIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cycle through status messages for an active agent
  const startStatusCycling = useCallback((agentId: string) => {
    const agentConfig = getAgentConfig(agentId);

    let statusIndex = 0;
    let snippetIndex = 0;

    const interval = setInterval(() => {
      statusIndex = (statusIndex + 1) % agentConfig.statuses.length;
      snippetIndex = (snippetIndex + 1) % DEMO_SNIPPETS.length;

      setAgentNodes(prev => prev.map(n =>
        n.id === agentId && n.status === 'active'
          ? {
              ...n,
              liveStatus: agentConfig.statuses[statusIndex],
              streamedText: DEMO_SNIPPETS[snippetIndex],
            }
          : n
      ));
    }, 2200);

    statusIntervalsRef.current.set(agentId, interval);
  }, []);

  const stopStatusCycling = useCallback((agentId: string) => {
    const interval = statusIntervalsRef.current.get(agentId);
    if (interval) {
      clearInterval(interval);
      statusIntervalsRef.current.delete(agentId);
    }
  }, []);

  // Start timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Clean up all status intervals
      statusIntervalsRef.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  // Flash effect when new findings appear
  useEffect(() => {
    if (discoveredFindings.length > 0) {
      const latestFinding = discoveredFindings[discoveredFindings.length - 1];
      setFlashingFindingId(latestFinding.id);
      const timer = setTimeout(() => setFlashingFindingId(null), 600);
      return () => clearTimeout(timer);
    }
  }, [discoveredFindings.length]);

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

  const addAgent = (agentId: string) => {
    const config = getAgentConfig(agentId);
    setAgentNodes(prev => [
      ...prev,
      {
        id: agentId,
        title: config.title,
        status: 'active',
        liveStatus: config.statuses[0],
        streamedText: DEMO_SNIPPETS[0],
      }
    ]);
    startStatusCycling(agentId);
  };

  const completeAgent = (agentId: string) => {
    stopStatusCycling(agentId);
    setAgentNodes(prev => prev.map(n =>
      n.id === agentId ? { ...n, status: 'completed', streamedText: undefined } : n
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
        // Update with more specific status based on chunk
        const agentConfig = getAgentConfig(e.agent_id);
        const statusIndex = e.chunk_index % agentConfig.statuses.length;
        setAgentNodes(prev => prev.map(n =>
          n.id === e.agent_id
            ? { ...n, liveStatus: agentConfig.statuses[statusIndex] }
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
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
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

  // Only show last 6 findings
  const visibleFindings = discoveredFindings.slice(-6);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 h-6">
          <div className="flex items-center gap-2">
            {discoveredFindings.length > 0 && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span className="text-orange-400/80 text-xs">
                  {discoveredFindings.length} {discoveredFindings.length === 1 ? 'finding' : 'findings'}
                </span>
              </>
            )}
          </div>
          <span className="text-gray-600 text-xs font-mono">
            {formatTime(elapsedTime)}
          </span>
        </div>

        {/* Agent Pipeline Box */}
        <div className="bg-[#0d0d0d] rounded-lg border border-gray-800 p-6 mb-4">
          {agentNodes.length === 0 ? (
            <div className="flex items-center gap-3 text-gray-500 text-sm">
              <div className="w-4 h-4 rounded-full border border-gray-600 animate-pulse" />
              <span>Preparing analysis...</span>
            </div>
          ) : (
            <div className="relative">
              {agentNodes.map((node, idx) => (
                <div key={node.id} className="relative">
                  {/* Connecting line - thin, stops at circle edge */}
                  {idx < agentNodes.length - 1 && (
                    <div
                      className="absolute left-[7px] top-[16px] w-px bg-gray-700"
                      style={{ height: 'calc(100% - 12px)' }}
                    />
                  )}

                  <div className="flex items-start gap-3 pb-5 last:pb-0">
                    {/* Node indicator */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      {node.status === 'completed' ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="w-4 h-4 rounded-full border border-orange-400" />
                          <div className="absolute inset-0 w-4 h-4 rounded-full border border-orange-400 animate-ping opacity-30" />
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
                        <div className="mt-1 space-y-0.5">
                          <div className="text-xs text-gray-500">
                            {node.liveStatus}
                          </div>
                          {node.streamedText && (
                            <div className="text-xs text-gray-600 italic">
                              {node.streamedText}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Findings Box - only show last 6, no scroll */}
        {visibleFindings.length > 0 && (
          <div className="bg-[#111] rounded-lg border border-gray-800/50 p-5">
            <div className="space-y-3">
              {visibleFindings.map((finding) => (
                <div
                  key={finding.id}
                  className={`
                    relative pl-3 py-1.5 transition-all duration-300
                    border-l border-orange-500/50
                    ${flashingFindingId === finding.id ? 'bg-orange-500/5' : ''}
                  `}
                >
                  {flashingFindingId === finding.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent animate-sweep" />
                  )}

                  <div className="relative">
                    <div className="text-orange-400/90 text-sm">
                      {finding.title}
                    </div>
                    <div className="text-gray-600 text-xs mt-0.5 line-clamp-1">
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
        @keyframes sweep {
          0% { opacity: 1; transform: translateX(-100%); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateX(100%); }
        }
        .animate-sweep {
          animation: sweep 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
