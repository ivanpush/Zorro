import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store';
import { AGENT_NAMES } from '@/types';
import type { AgentId, Finding } from '@/types';

const phases = [
  { id: 'parsing', label: 'Parsing' },
  { id: 'context', label: 'Context' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'synthesis', label: 'Synthesis' },
];

const agents: AgentId[] = [
  'context_builder',
  'clarity_inspector',
  'rigor_inspector',
  'adversarial_critic',
  'domain_validator',
];

export function ProcessScreen() {
  const navigate = useNavigate();
  const { reviewMode, findings, addFinding } = useAppStore();
  const [currentPhase, setCurrentPhase] = useState(0);
  const [agentStatuses, setAgentStatuses] = useState<
    Record<AgentId, 'pending' | 'running' | 'completed'>
  >({
    context_builder: 'pending',
    clarity_inspector: 'pending',
    rigor_inspector: 'pending',
    adversarial_critic: 'pending',
    domain_validator: 'pending',
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [discoveredFindings, setDiscoveredFindings] = useState<Finding[]>([]);

  useEffect(() => {
    if (reviewMode === 'demo') {
      // Simulate processing in demo mode
      simulateProcessing();
    } else {
      // Would connect to SSE for real processing
      navigate('/review');
    }
  }, [reviewMode, navigate]);

  const simulateProcessing = async () => {
    // Start timer
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    // Phase 1: Parsing
    await sleep(1000);
    setCurrentPhase(1);

    // Phase 2: Context
    await sleep(1000);
    setCurrentPhase(2);
    setAgentStatuses((prev) => ({ ...prev, context_builder: 'running' }));
    await sleep(1500);
    setAgentStatuses((prev) => ({ ...prev, context_builder: 'completed' }));

    // Phase 3: Analysis
    setAgentStatuses((prev) => ({
      ...prev,
      clarity_inspector: 'running',
      rigor_inspector: 'running',
    }));
    await sleep(2000);
    setAgentStatuses((prev) => ({
      ...prev,
      clarity_inspector: 'completed',
      rigor_inspector: 'completed',
      adversarial_critic: 'running',
    }));

    // Simulate finding discoveries
    if (findings.length > 0) {
      for (let i = 0; i < Math.min(5, findings.length); i++) {
        await sleep(500);
        setDiscoveredFindings((prev) => [...prev, findings[i]]);
      }
    }

    await sleep(1500);
    setAgentStatuses((prev) => ({
      ...prev,
      adversarial_critic: 'completed',
      domain_validator: 'running',
    }));
    await sleep(1000);
    setAgentStatuses((prev) => ({
      ...prev,
      domain_validator: 'completed',
    }));

    // Phase 4: Synthesis
    setCurrentPhase(3);
    await sleep(1500);

    clearInterval(timer);

    // Navigate to review
    setTimeout(() => {
      navigate('/review');
    }, 500);
  };

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((currentPhase + 1) / phases.length) * 100;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Processing Document</h1>
        <p className="text-muted-foreground">
          AI agents are analyzing your document
        </p>
      </div>

      {/* Overall Progress */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Overall Progress</span>
            <span className="text-sm font-normal text-muted-foreground">
              Elapsed: {formatTime(elapsedTime)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-4" />
          <div className="flex justify-between">
            {phases.map((phase, idx) => (
              <div
                key={phase.id}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    idx <= currentPhase
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx < currentPhase ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : idx === currentPhase ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-xs ${
                    idx <= currentPhase
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {phase.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agents.map((agentId) => {
                const status = agentStatuses[agentId];
                return (
                  <div
                    key={agentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {status === 'running' && (
                          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
                        )}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            status === 'completed'
                              ? 'bg-green-500 text-white'
                              : status === 'running'
                              ? 'bg-blue-500 text-white'
                              : 'bg-muted-foreground/20 text-muted-foreground'
                          }`}
                        >
                          {status === 'completed' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : status === 'running' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium">
                        {AGENT_NAMES[agentId]}
                      </span>
                    </div>
                    <span
                      className={`text-xs ${
                        status === 'completed'
                          ? 'text-green-600'
                          : status === 'running'
                          ? 'text-blue-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {status === 'running' && 'Analyzing...'}
                      {status === 'completed' && 'Complete'}
                      {status === 'pending' && 'Waiting'}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Live Findings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Live Findings</span>
              <Badge variant="secondary">{discoveredFindings.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {discoveredFindings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Findings will appear here as they're discovered...
                </p>
              ) : (
                discoveredFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3 rounded-lg border animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="flex items-start gap-2">
                      <Badge
                        variant={finding.severity as any}
                        className="text-xs"
                      >
                        {finding.severity}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-1">
                          {finding.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {AGENT_NAMES[finding.agentId]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Button */}
      <div className="flex justify-center mt-8">
        <Button
          variant="outline"
          onClick={() => {
            if (confirm('Are you sure you want to cancel the review?')) {
              navigate('/upload');
            }
          }}
        >
          Cancel Review
        </Button>
      </div>
    </div>
  );
}