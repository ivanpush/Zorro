import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useAppStore } from '@/store';
import { ManuscriptView } from '@/components/domain/ManuscriptView';
import { IssuesPanel } from './ReviewScreen/IssuesPanel';
import type { DocObj, Finding } from '@/types';

export function ReviewScreen() {
  const navigate = useNavigate();
  const { currentDocument, setCurrentDocument, findings, setFindings, reviewMode } = useAppStore();

  // Local state for issue management
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [acceptedIssueIds, setAcceptedIssueIds] = useState<Set<string>>(new Set());
  const [dismissedIssueIds, setDismissedIssueIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Refs for scrolling
  const manuscriptRef = useRef<HTMLDivElement>(null);
  const issuesPanelRef = useRef<HTMLDivElement>(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      // Check how we got here
      const mode = sessionStorage.getItem('reviewMode') || reviewMode || 'static';
      const demoFile = sessionStorage.getItem('demoFile') || 'manuscript_pdf';

      if (mode === 'static' || !currentDocument || findings.length === 0) {
        // Load from fixtures
        try {
          // Load the review JSON which contains both document structure and issues
          const response = await fetch(`/reviews/${demoFile}_fullreview.json`);
          if (!response.ok) throw new Error('Failed to load review data');

          const data = await response.json();

          // Extract and set document structure
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

          // Build document structure from issues
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

          // Convert issues to findings
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
          // Create minimal fallback data
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

    // Find the issue and scroll to its paragraph
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
    // Find first issue for this paragraph
    const issue = findings.find(f =>
      f.anchors.some(a => a.paragraph_id === paragraphId)
    );

    if (issue) {
      setSelectedIssueId(issue.id);

      // Scroll issues panel to this issue
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

  const handleDismissIssue = useCallback((issueId: string) => {
    setDismissedIssueIds(prev => new Set([...prev, issueId]));
    setAcceptedIssueIds(prev => {
      const next = new Set(prev);
      next.delete(issueId);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading review data...</p>
        </div>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No document loaded</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Upload Document
          </button>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    // For now, just export as JSON
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

  return (
    <div className="h-screen flex flex-col">
      {/* Header - reduced height from h-14 to h-11 (20% reduction) */}
      <div className="h-11 flex items-center justify-between px-6 border-b bg-background">
        {/* ZORRO on the left */}
        <h1 className="text-lg font-serif tracking-wide" style={{ color: '#E89855' }}>
          ZORRO
        </h1>

        {/* Empty center for balance */}
        <div></div>

        {/* Export button on the right */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-1.5 text-sm rounded-md transition-all duration-200
                   hover:bg-gray-800/50"
          style={{ color: '#a0a0b0' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#E89855'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#a0a0b0'}
        >
          <Download className="w-4 h-4" />
          Export Review
        </button>
      </div>

      {/* Main content - no longer needs absolute export button */}
      <div className="flex-1 flex overflow-hidden">
        {/* Manuscript View - 60% */}
        <div
          ref={manuscriptRef}
          className="flex-1 overflow-y-auto border-r bg-background"
          style={{ flexBasis: '60%' }}
        >
          <ManuscriptView
            document={currentDocument}
            selectedIssueId={selectedIssueId}
            findings={findings}
            onParagraphClick={handleParagraphClick}
          />
        </div>

        {/* Issues Panel - 40% */}
        <div
          ref={issuesPanelRef}
          className="overflow-y-auto bg-background"
          style={{ flexBasis: '40%' }}
        >
          <IssuesPanel
            issues={findings}
            selectedIssueId={selectedIssueId}
            acceptedIssueIds={acceptedIssueIds}
            dismissedIssueIds={dismissedIssueIds}
            onSelectIssue={handleIssueSelect}
            onAcceptIssue={handleAcceptIssue}
            onDismissIssue={handleDismissIssue}
          />
        </div>
      </div>
    </div>
  );
}