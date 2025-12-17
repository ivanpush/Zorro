import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { ManuscriptView } from '@/components/domain/ManuscriptView';
import { IssuesPanel } from './ReviewScreen/IssuesPanel';
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

export function ReviewScreen() {
  const navigate = useNavigate();
  const { currentDocument, setCurrentDocument, findings, setFindings, reviewMode } = useAppStore();

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

      if (mode === 'static' || !currentDocument || findings.length === 0) {
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

          const mappedFindings: Finding[] = data.issues.map((issue: any) => ({
            id: issue.id,
            agentId: issue.persona || 'reviewer',
            category: issue.issue_type || 'general',
            severity: issue.severity || 'minor',
            confidence: 0.8,
            title: issue.title,
            description: issue.message,
            anchors: issue.paragraph_id ? [{
              paragraph_id: issue.paragraph_id,
              sentence_id: issue.sentence_ids?.[0],
              quoted_text: issue.original_text || ''
            }] : [],
            proposedEdit: issue.suggested_rewrite ? {
              type: 'replace',
              anchor: {
                paragraph_id: issue.paragraph_id,
                quoted_text: issue.original_text || ''
              },
              newText: issue.suggested_rewrite,
              rationale: issue.rationale || ''
            } : undefined,
            createdAt: new Date().toISOString()
          }));

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

  // Handle issue selection
  const handleIssueSelect = useCallback((issueId: string) => {
    setSelectedIssueId(issueId);

    const issue = findings.find(f => f.id === issueId);
    if (issue && issue.anchors.length > 0) {
      const paragraphId = issue.anchors[0].paragraph_id;
      const element = document.getElementById(paragraphId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [findings]);

  // Handle paragraph click
  const handleParagraphClick = useCallback((paragraphId: string) => {
    const issue = findings.find(f =>
      f.anchors.some(a => a.paragraph_id === paragraphId)
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

  const handleAcceptRewrite = useCallback((issueId: string) => {
    const issue = findings.find(f => f.id === issueId);
    if (!issue || !issue.proposedEdit?.newText || !issue.anchors[0]?.paragraph_id) return;
    const paragraphId = issue.anchors[0].paragraph_id;
    const newText = issue.proposedEdit.newText;
    setRewrittenParagraphs(prev => new Map(prev).set(paragraphId, newText));
    handleAcceptIssue(issueId);
  }, [findings, handleAcceptIssue]);

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
    // Find and un-accept the related issue
    const relatedIssue = findings.find(f =>
      f.anchors[0]?.paragraph_id === paragraphId && acceptedIssueIds.has(f.id)
    );
    if (relatedIssue) {
      setAcceptedIssueIds(prev => {
        const next = new Set(prev);
        next.delete(relatedIssue.id);
        return next;
      });
    }
  }, [findings, acceptedIssueIds]);

  // Handle user direct edit of a paragraph
  // When user edits, auto-dismiss any applied AI rewrites on that paragraph
  const handleUserEdit = useCallback((paragraphId: string, newText: string) => {
    // Find all accepted issues with rewrites applied to this paragraph
    const issuesToAutoDismiss = findings.filter(f =>
      f.anchors[0]?.paragraph_id === paragraphId &&
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
    <div className="h-screen flex flex-col bg-[#131316]">
      {/* Header - Refined minimal design */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-[#131316]">
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
        {/* Manuscript Panel - 65% */}
        <div
          ref={manuscriptRef}
          className="flex-1 overflow-hidden"
          style={{ flexBasis: '65%' }}
        >
          <div className="h-full overflow-y-auto overflow-x-visible scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            <div className="max-w-5xl mx-auto pr-8">
              <ManuscriptView
                document={currentDocument}
                selectedIssueId={selectedIssueId}
                findings={findings}
                rewrittenParagraphs={rewrittenParagraphs}
                userEditedParagraphs={userEditedParagraphs}
                acceptedIssueIds={acceptedIssueIds}
                dismissedIssueIds={dismissedIssueIds}
                onParagraphClick={handleParagraphClick}
                onSelectIssue={handleIssueSelect}
                onRevertRewrite={handleRevertRewrite}
                onUserEdit={handleUserEdit}
                onRevertUserEdit={handleRevertUserEdit}
              />
            </div>
          </div>
        </div>

        {/* Divider with glow effect when issue selected */}
        <div
          className="w-px transition-all duration-300"
          style={{
            backgroundColor: selectedIssueId ? 'rgba(232, 152, 85, 0.3)' : 'rgba(55, 65, 81, 0.5)',
            boxShadow: selectedIssueId ? '0 0 20px rgba(232, 152, 85, 0.2)' : 'none'
          }}
        />

        {/* Issues Panel - 35% */}
        <div
          ref={issuesPanelRef}
          className="overflow-hidden bg-[#16161a]"
          style={{ flexBasis: '35%' }}
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
            onAcceptIssue={handleAcceptIssue}
            onAcceptRewrite={handleAcceptRewrite}
            onDismissIssue={handleDismissIssue}
            onUndoIssue={handleUndoIssue}
            onGotoEdit={(paragraphId) => {
              const element = document.getElementById(paragraphId);
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
