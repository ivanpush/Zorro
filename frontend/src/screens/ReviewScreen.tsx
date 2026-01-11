import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, CheckCircle2, ChevronDown, ChevronUp, Clock, DollarSign, Cpu } from 'lucide-react';
import { useAppStore } from '@/store';
import { ManuscriptView } from '@/components/domain/ManuscriptView';
import { IssuesPanel } from './ReviewScreen/IssuesPanel';
import { settings } from '@/settings';
import type { DocObj, Finding } from '@/types';

// Progress Ring Component
function ProgressRing({
  progress,
  size = 32,
  strokeWidth = 3
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  // Color transitions from amber to green based on progress
  const getColor = () => {
    if (progress < 33) return '#f59e0b'; // amber
    if (progress < 66) return '#84cc16'; // lime
    return '#22c55e'; // green
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="absolute" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-700"
        />
      </svg>
      {/* Progress circle */}
      <svg
        className="absolute -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-semibold text-white">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

// Dev Banner Component
function DevBanner({
  metrics,
  isExpanded,
  onToggle
}: {
  metrics: { total_time_ms: number; total_cost_usd: number; agents_run: string[] };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  const formatCost = (usd: number) => `$${usd.toFixed(2)}`;

  return (
    <div className="bg-[#1a1a1d] border-b border-gray-700/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-gray-500 font-mono">DEV</span>
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatTime(metrics.total_time_ms)}</span>
          </div>
          <div className="flex items-center gap-1 text-green-400">
            <DollarSign className="w-3 h-3" />
            <span>{formatCost(metrics.total_cost_usd)}</span>
          </div>
          <div className="flex items-center gap-1 text-blue-400">
            <Cpu className="w-3 h-3" />
            <span>{metrics.agents_run.join(', ')}</span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 py-2 border-t border-gray-700/30">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-gray-500 mb-1">Total Time</div>
              <div className="text-white font-mono">{formatTime(metrics.total_time_ms)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Total Cost</div>
              <div className="text-green-400 font-mono">{formatCost(metrics.total_cost_usd)}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Agents Run</div>
              <div className="text-blue-400 font-mono">{metrics.agents_run.join(', ')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReviewScreen() {
  const navigate = useNavigate();
  const { currentDocument, setCurrentDocument, findings, setFindings, reviewMode, reviewMetrics } = useAppStore();

  // Local state for issue management
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [acceptedIssueIds, setAcceptedIssueIds] = useState<Set<string>>(new Set());
  const [dismissedIssueIds, setDismissedIssueIds] = useState<Set<string>>(new Set());
  const [rewrittenParagraphs, setRewrittenParagraphs] = useState<Map<string, string>>(new Map());
  const [userEditedParagraphs, setUserEditedParagraphs] = useState<Map<string, string>>(new Map());
  // Track issues that were auto-dismissed when user edited a paragraph (so they can be restored on revert)
  const [userEditDismissedIssues, setUserEditDismissedIssues] = useState<Map<string, Set<string>>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  // Highlighted paragraph (for user edit goto)
  const [highlightedParagraphId, setHighlightedParagraphId] = useState<string | null>(null);

  // Dev banner state
  const [devBannerExpanded, setDevBannerExpanded] = useState(false);

  // Draggable panel width (percentage for issues panel)
  // Default 34%, can only expand (not shrink below 34%)
  const [issuesPanelWidth, setIssuesPanelWidth] = useState(() => {
    const saved = localStorage.getItem('issuesPanelWidth');
    return saved ? Math.max(34, parseFloat(saved)) : 34;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Refs for scrolling
  const manuscriptRef = useRef<HTMLDivElement>(null);
  const issuesPanelRef = useRef<HTMLDivElement>(null);

  // Calculate progress
  const progress = useMemo(() => {
    if (findings.length === 0) return 0;
    const addressed = acceptedIssueIds.size + dismissedIssueIds.size;
    return (addressed / findings.length) * 100;
  }, [findings.length, acceptedIssueIds.size, dismissedIssueIds.size]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      const mode = sessionStorage.getItem('reviewMode') || reviewMode || 'static';
      const demoFile = sessionStorage.getItem('demoFile') || 'manuscript_pdf';

      // Only load fixture data in static mode OR if we don't have a document
      // In dynamic mode with a document, we use findings from the store (even if empty)
      const isDynamicWithDocument = (mode === 'demo' || mode === 'dynamic') && currentDocument;
      if (!isDynamicWithDocument && (mode === 'static' || !currentDocument)) {
        try {
          const response = await fetch(`/reviews/${demoFile}_fullreview.json`);
          if (!response.ok) throw new Error('Failed to load review data');

          const data = await response.json();

          const doc: DocObj = {
            document_id: data.document_id || 'demo_doc',
            filename: `${demoFile}.pdf`,
            type: 'pdf',
            title: data.document_type || 'Research Manuscript',
            sections: [],
            paragraphs: [],
            figures: [],
            references: [],
            metadata: {
              wordCount: 0,
              characterCount: 0
            },
            createdAt: new Date().toISOString()
          };

          const sectionMap = new Map<string, any>();
          const paragraphMap = new Map<string, any>();

          data.issues.forEach((issue: any) => {
            if (issue.section_id && !sectionMap.has(issue.section_id)) {
              sectionMap.set(issue.section_id, {
                section_id: issue.section_id,
                section_index: sectionMap.size,
                section_title: issue.section_id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                level: 1,
                paragraph_ids: []
              });
            }

            if (issue.paragraph_id && !paragraphMap.has(issue.paragraph_id)) {
              const section = sectionMap.get(issue.section_id);
              if (section) {
                section.paragraph_ids.push(issue.paragraph_id);
              }

              paragraphMap.set(issue.paragraph_id, {
                paragraph_id: issue.paragraph_id,
                paragraph_index: paragraphMap.size,
                section_id: issue.section_id || '',
                text: issue.original_text || `Paragraph ${issue.paragraph_id}`,
                sentences: []
              });
            }
          });

          doc.sections = Array.from(sectionMap.values());
          doc.paragraphs = Array.from(paragraphMap.values());

          const mappedFindings: Finding[] = data.issues.map((issue: any) => {
            // Handle different field names for different issue types
            // Counterpoint uses 'critique' instead of 'message'
            const description = issue.message || issue.critique || '';

            // Distinguish between actual rewrites and suggestions
            // suggested_rewrite/proposed_rewrite = actual text replacements (type: 'replace')
            // suggested_revision/outline_suggestion = actionable advice, not direct text swap (type: 'suggestion')
            // If no rewrite or suggestion, fall back to rationale as suggestion
            const rewriteText = issue.suggested_rewrite || issue.proposed_rewrite;
            const suggestionText = issue.suggested_revision ||
              (issue.outline_suggestion && Array.isArray(issue.outline_suggestion)
                ? issue.outline_suggestion.map((s: string) => `• ${s}`).join('\n')
                : null);
            const proposedText = rewriteText || suggestionText || (issue.rationale && !rewriteText && !suggestionText ? issue.rationale : null);
            const isSuggestion = !rewriteText && (!!suggestionText || (!suggestionText && !!issue.rationale));

            // Use scope for categorization (rigor, clarity, counterpoint)
            // Fall back to issue_type if scope not available
            const category = issue.scope || issue.issue_type || 'general';

            return {
              id: issue.id,
              agentId: issue.persona || 'reviewer',
              category,
              severity: issue.severity || 'minor',
              confidence: 0.8,
              title: issue.title,
              description,
              anchors: issue.paragraph_id ? [{
                paragraphId: issue.paragraph_id,
                sentenceId: issue.sentence_ids?.[0],
                quotedText: issue.original_text || ''
              }] : [],
              proposedEdit: proposedText ? {
                type: isSuggestion ? 'suggestion' : 'replace',
                anchor: {
                  paragraphId: issue.paragraph_id,
                  quotedText: issue.original_text || ''
                },
                newText: proposedText,
                // Don't duplicate rationale in tooltip if it's already the main suggestion text
                rationale: (rewriteText || suggestionText) ? (issue.rationale || '') : ''
              } : undefined,
              createdAt: new Date().toISOString()
            };
          });

          setCurrentDocument(doc);
          setFindings(mappedFindings);
        } catch (error) {
          console.error('Failed to load review data:', error);
          setCurrentDocument({
            document_id: 'fallback',
            filename: 'document.pdf',
            type: 'pdf',
            title: 'Document',
            sections: [],
            paragraphs: [],
            figures: [],
            references: [],
            metadata: { wordCount: 0, characterCount: 0 },
            createdAt: new Date().toISOString()
          });
          setFindings([]);
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  // Ref for IssuesPanel to register its select callback
  const selectIssueRef = useRef<((issue: Finding) => void) | null>(null);

  // Handle issue selection - called from IssuesPanel card clicks
  const handleIssueSelect = useCallback((issueId: string) => {
    setSelectedIssueId(issueId);

    const issue = findings.find(f => f.id === issueId);
    if (issue && issue.anchors.length > 0) {
      const paragraphId = issue.anchors[0].paragraphId;
      const element = document.getElementById(paragraphId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [findings]);

  // Handle bubble click from ManuscriptView - calls IssuesPanel's registered callback
  const handleBubbleSelect = useCallback((issue: Finding) => {
    setSelectedIssueId(issue.id);
    // Call the IssuesPanel's registered callback to handle expansion/scroll
    if (selectIssueRef.current) {
      selectIssueRef.current(issue);
    }
  }, []);

  // Handle paragraph click
  const handleParagraphClick = useCallback((paragraphId: string) => {
    const issue = findings.find(f =>
      f.anchors.some(a => a.paragraphId === paragraphId)
    );

    if (issue) {
      setSelectedIssueId(issue.id);

      const issueElement = document.getElementById(`issue-${issue.id}`);
      if (issueElement) {
        issueElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [findings]);

  // Handle issue actions
  const handleAcceptIssue = useCallback((issueId: string) => {
    setAcceptedIssueIds(prev => new Set([...prev, issueId]));
    setDismissedIssueIds(prev => {
      const next = new Set(prev);
      next.delete(issueId);
      return next;
    });
  }, []);

  const handleAcceptRewrite = useCallback((issueId: string, editedText?: string) => {
    const issue = findings.find(f => f.id === issueId);
    // Allow if we have editedText OR if the issue has proposedEdit.newText
    if (!issue || (!editedText && !issue.proposedEdit?.newText) || !issue.anchors[0]?.paragraphId) return;

    const paragraphId = issue.anchors[0].paragraphId;
    const quotedText = issue.anchors[0].quotedText;
    const replacementText = editedText || issue.proposedEdit!.newText!;

    // Get original paragraph text
    const paragraph = currentDocument?.paragraphs.find(p => p.paragraph_id === paragraphId);
    if (!paragraph) return;

    setRewrittenParagraphs(prev => {
      const next = new Map(prev);
      // Get current text (with any previous rewrites applied) or original
      const currentText = next.get(paragraphId) || paragraph.text;

      // Find and replace the quoted text
      const idx = currentText.indexOf(quotedText);
      if (idx !== -1) {
        const fullNewText = currentText.substring(0, idx) + replacementText + currentText.substring(idx + quotedText.length);
        next.set(paragraphId, fullNewText);
      } else {
        // Fallback if quoted text not found (shouldn't happen normally)
        next.set(paragraphId, replacementText);
      }
      return next;
    });

    handleAcceptIssue(issueId);
  }, [findings, currentDocument, handleAcceptIssue]);

  const handleDismissIssue = useCallback((issueId: string) => {
    setDismissedIssueIds(prev => new Set([...prev, issueId]));
    setAcceptedIssueIds(prev => {
      const next = new Set(prev);
      next.delete(issueId);
      return next;
    });
  }, []);

  const handleUndoIssue = useCallback((issueId: string) => {
    setAcceptedIssueIds(prev => {
      const next = new Set(prev);
      next.delete(issueId);
      return next;
    });
    setDismissedIssueIds(prev => {
      const next = new Set(prev);
      next.delete(issueId);
      return next;
    });
  }, []);

  const handleRevertRewrite = useCallback((paragraphId: string) => {
    // Remove the rewrite
    setRewrittenParagraphs(prev => {
      const next = new Map(prev);
      next.delete(paragraphId);
      return next;
    });
    // Find and un-accept ALL related issues with rewrites on this paragraph
    const relatedIssues = findings.filter(f =>
      f.anchors[0]?.paragraphId === paragraphId &&
      acceptedIssueIds.has(f.id) &&
      f.proposedEdit?.newText
    );
    if (relatedIssues.length > 0) {
      setAcceptedIssueIds(prev => {
        const next = new Set(prev);
        relatedIssues.forEach(issue => next.delete(issue.id));
        return next;
      });
    }
  }, [findings, acceptedIssueIds]);

  // Handle user direct edit of a paragraph
  // When user edits, auto-dismiss any applied AI rewrites on that paragraph
  const handleUserEdit = useCallback((paragraphId: string, newText: string) => {
    // Find all accepted issues with rewrites applied to this paragraph
    const issuesToAutoDismiss = findings.filter(f =>
      f.anchors[0]?.paragraphId === paragraphId &&
      acceptedIssueIds.has(f.id) &&
      f.proposedEdit?.newText
    );

    if (issuesToAutoDismiss.length > 0) {
      // Track these issues so we can restore them if user reverts their edit
      setUserEditDismissedIssues(prev => {
        const next = new Map(prev);
        const existingIds = next.get(paragraphId) || new Set<string>();
        issuesToAutoDismiss.forEach(issue => existingIds.add(issue.id));
        next.set(paragraphId, existingIds);
        return next;
      });

      // Move issues from accepted to dismissed
      setAcceptedIssueIds(prev => {
        const next = new Set(prev);
        issuesToAutoDismiss.forEach(issue => next.delete(issue.id));
        return next;
      });
      setDismissedIssueIds(prev => {
        const next = new Set(prev);
        issuesToAutoDismiss.forEach(issue => next.add(issue.id));
        return next;
      });

      // Remove the AI rewrite since user edit takes over
      setRewrittenParagraphs(prev => {
        const next = new Map(prev);
        next.delete(paragraphId);
        return next;
      });
    }

    // Set the user's edit
    setUserEditedParagraphs(prev => {
      const next = new Map(prev);
      next.set(paragraphId, newText);
      return next;
    });
  }, [findings, acceptedIssueIds]);

  // Revert user edit - restore auto-dismissed issues back to active
  const handleRevertUserEdit = useCallback((paragraphId: string) => {
    // Restore any issues that were auto-dismissed when user edited this paragraph
    const autoDismissedIds = userEditDismissedIssues.get(paragraphId);
    if (autoDismissedIds && autoDismissedIds.size > 0) {
      // Remove from dismissed (make them active again)
      setDismissedIssueIds(prev => {
        const next = new Set(prev);
        autoDismissedIds.forEach(id => next.delete(id));
        return next;
      });

      // Clear the tracking for this paragraph
      setUserEditDismissedIssues(prev => {
        const next = new Map(prev);
        next.delete(paragraphId);
        return next;
      });
    }

    // Remove the user edit
    setUserEditedParagraphs(prev => {
      const next = new Map(prev);
      next.delete(paragraphId);
      return next;
    });
  }, [userEditDismissedIssues]);

  // Drag handlers for resizable panel
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerWidth = window.innerWidth;
      const newWidth = ((containerWidth - e.clientX) / containerWidth) * 100;
      // Min 34% (default/max compression), max 55%
      const clampedWidth = Math.min(55, Math.max(34, newWidth));
      setIssuesPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('issuesPanelWidth', issuesPanelWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, issuesPanelWidth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#131316]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-600 border-t-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#131316]">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No document loaded</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium"
          >
            Upload Document
          </button>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    const exportData = {
      document: currentDocument,
      findings: findings,
      acceptedIssues: Array.from(acceptedIssueIds),
      dismissedIssues: Array.from(dismissedIssueIds),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDocument.title}_review_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeIssuesCount = findings.length - acceptedIssueIds.size - dismissedIssueIds.size;

  return (
    <div className="h-screen flex flex-col bg-[#131316] overscroll-none">
      {/* Dev Banner - only show if enabled in settings and metrics available */}
      {settings.showDevBanner && reviewMetrics && (
        <DevBanner
          metrics={reviewMetrics}
          isExpanded={devBannerExpanded}
          onToggle={() => setDevBannerExpanded(!devBannerExpanded)}
        />
      )}

      {/* Header - Refined minimal design */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-[#131316]">
        {/* Left: Logo + Document info */}
        <div className="flex items-center gap-4">
          <h1
            className="text-base font-semibold tracking-wide"
            style={{ color: '#E89855' }}
          >
            ZORRO
          </h1>
          <div className="h-4 w-px bg-gray-600"></div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300 truncate max-w-[200px]">
              {currentDocument.title}
            </span>
          </div>
        </div>

        {/* Center: Progress */}
        <div className="flex items-center gap-3">
          <ProgressRing progress={progress} size={36} strokeWidth={3} />
          <div className="text-xs">
            <div className="text-gray-300">
              <span className="text-white font-medium">{activeIssuesCount}</span> remaining
            </div>
            <div className="text-gray-500">
              {acceptedIssueIds.size} accepted, {dismissedIssueIds.size} dismissed
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {progress === 100 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Review Complete
            </div>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
                     text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Manuscript Panel - dynamic width (adjusts to issues panel) */}
        <div
          ref={manuscriptRef}
          className="flex-1 overflow-hidden"
          style={{ flexBasis: `${100 - issuesPanelWidth}%` }}
        >
          <div className="h-full overflow-y-auto overflow-x-visible overscroll-contain scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            <div className="max-w-7xl mx-auto pr-8">
              <ManuscriptView
                document={currentDocument}
                selectedIssueId={selectedIssueId}
                findings={findings}
                rewrittenParagraphs={rewrittenParagraphs}
                userEditedParagraphs={userEditedParagraphs}
                acceptedIssueIds={acceptedIssueIds}
                dismissedIssueIds={dismissedIssueIds}
                highlightedParagraphId={highlightedParagraphId}
                onParagraphClick={handleParagraphClick}
                onSelectIssue={handleIssueSelect}
                onBubbleSelect={handleBubbleSelect}
                onRevertRewrite={handleRevertRewrite}
                onUserEdit={handleUserEdit}
                onRevertUserEdit={handleRevertUserEdit}
                onClearHighlight={() => setHighlightedParagraphId(null)}
              />
            </div>
          </div>
        </div>

        {/* Divider with glow effect when issue selected - draggable */}
        <div
          onMouseDown={handleDragStart}
          className="w-px transition-all duration-300 cursor-col-resize hover:w-1"
          style={{
            backgroundColor: 'rgba(232, 152, 85, 0.3)',
            boxShadow: selectedIssueId ? '0 0 20px rgba(232, 152, 85, 0.2)' : 'none'
          }}
        />

        {/* Issues Panel - dynamic width (34-55%) */}
        <div
          ref={issuesPanelRef}
          className="overflow-hidden bg-[#16161a]"
          style={{ flexBasis: `${issuesPanelWidth}%` }}
        >
          <IssuesPanel
            issues={findings}
            document={currentDocument}
            selectedIssueId={selectedIssueId}
            acceptedIssueIds={acceptedIssueIds}
            dismissedIssueIds={dismissedIssueIds}
            rewrittenParagraphs={rewrittenParagraphs}
            userEditedParagraphs={userEditedParagraphs}
            filterSeverity={filterSeverity}
            onFilterChange={setFilterSeverity}
            onSelectIssue={handleIssueSelect}
            selectIssueRef={selectIssueRef}
            onAcceptIssue={handleAcceptIssue}
            onAcceptRewrite={handleAcceptRewrite}
            onDismissIssue={handleDismissIssue}
            onUndoIssue={handleUndoIssue}
            onGotoEdit={(paragraphId) => {
              setHighlightedParagraphId(paragraphId);
              const element = window.document.getElementById(paragraphId);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
