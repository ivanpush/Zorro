import { useMemo, useState } from 'react';
import { CheckCircle, Eye, RotateCcw, ArrowLeftRight } from 'lucide-react';
import type { DocObj, Finding } from '@/types';

interface ManuscriptViewProps {
  document: DocObj;
  selectedIssueId: string | null;
  findings: Finding[];
  rewrittenParagraphs: Map<string, string>;
  acceptedIssueIds: Set<string>;
  dismissedIssueIds: Set<string>;
  onParagraphClick: (paragraphId: string) => void;
  onSelectIssue?: (issueId: string) => void;
  onRevertRewrite?: (paragraphId: string) => void;
}

// Category type mapping
type IssueType = 'critical' | 'argument' | 'writing';

const getCategoryType = (category: string): IssueType => {
  if (category.includes('adversarial') || category.includes('scope')) return 'critical';
  if (category.includes('rigor')) return 'argument';
  return 'writing';
};

// Category type colors for pills
const typeConfig: Record<IssueType, { color: string; bg: string; letter: string }> = {
  critical: { color: '#f87171', bg: 'rgba(248, 113, 113, 0.2)', letter: 'C' },
  argument: { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)', letter: 'A' },
  writing: { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.2)', letter: 'W' }
};

// Selection colors - distinct for major vs minor
const severitySelectionColors = {
  major: {
    accent: '#f97316',
    border: 'rgba(249, 115, 22, 0.4)',
    bg: 'rgba(249, 115, 22, 0.06)',
    highlight: '#f97316'
  },
  minor: {
    accent: '#fbbf24',
    border: 'rgba(251, 191, 36, 0.4)',
    bg: 'rgba(251, 191, 36, 0.06)',
    highlight: '#fbbf24'
  }
};

// Severity pill colors
const severityPillColors = {
  major: { bg: '#f97316', text: '#fff' },
  minor: { bg: '#fbbf24', text: '#000' }
};

export function ManuscriptView({
  document,
  selectedIssueId,
  findings,
  rewrittenParagraphs,
  acceptedIssueIds,
  dismissedIssueIds,
  onParagraphClick,
  onSelectIssue,
  onRevertRewrite
}: ManuscriptViewProps) {
  // Track which paragraphs are showing diff vs final
  const [showingDiff, setShowingDiff] = useState<Set<string>>(new Set());

  // Map paragraphs to their active issues (not resolved)
  const paragraphIssuesMap = useMemo(() => {
    const map = new Map<string, Finding[]>();

    findings.forEach(finding => {
      if (acceptedIssueIds.has(finding.id) || dismissedIssueIds.has(finding.id)) return;

      finding.anchors.forEach(anchor => {
        if (anchor.paragraph_id) {
          const existing = map.get(anchor.paragraph_id) || [];
          existing.push(finding);
          map.set(anchor.paragraph_id, existing);
        }
      });
    });

    return map;
  }, [findings, acceptedIssueIds, dismissedIssueIds]);

  // Get selected issue details
  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    return findings.find(f => f.id === selectedIssueId) || null;
  }, [selectedIssueId, findings]);

  const selectedParagraphId = selectedIssue?.anchors[0]?.paragraph_id || null;

  const toggleDiffView = (paragraphId: string) => {
    setShowingDiff(prev => {
      const next = new Set(prev);
      if (next.has(paragraphId)) {
        next.delete(paragraphId);
      } else {
        next.add(paragraphId);
      }
      return next;
    });
  };

  // Get unique issue types for a paragraph's active issues
  const getIssueTypes = (issues: Finding[]): IssueType[] => {
    const types = new Set<IssueType>();
    issues.forEach(issue => {
      types.add(getCategoryType(issue.category));
    });
    return Array.from(types);
  };

  // Render paragraph
  const renderParagraph = (paragraph: any, index: number) => {
    const activeIssues = paragraphIssuesMap.get(paragraph.paragraph_id) || [];
    const hasActiveIssues = activeIssues.length > 0;
    const isSelected = paragraph.paragraph_id === selectedParagraphId;
    const isRewritten = rewrittenParagraphs.has(paragraph.paragraph_id);
    const rewrittenText = rewrittenParagraphs.get(paragraph.paragraph_id);
    const originalText = paragraph.text;
    const isDiffView = showingDiff.has(paragraph.paragraph_id);
    const issueTypes = getIssueTypes(activeIssues);

    // Get severity for selection styling
    const selectedSeverity = selectedIssue?.severity === 'critical' || selectedIssue?.severity === 'major' ? 'major' : 'minor';
    const selectionColors = severitySelectionColors[selectedSeverity];

    // Highlight the quoted text within the paragraph
    const renderTextWithHighlight = (text: string) => {
      if (!isSelected || !selectedIssue?.anchors[0]?.quoted_text) {
        return <span className="text-gray-200">{text}</span>;
      }

      const quotedText = selectedIssue.anchors[0].quoted_text;
      const idx = text.indexOf(quotedText);

      if (idx === -1) return <span className="text-gray-200">{text}</span>;

      return (
        <>
          <span className="text-gray-200">{text.substring(0, idx)}</span>
          <span
            className="text-white font-medium"
            style={{
              textDecoration: 'underline',
              textDecorationColor: selectionColors.highlight,
              textDecorationThickness: '2px',
              textUnderlineOffset: '3px'
            }}
          >
            {quotedText}
          </span>
          <span className="text-gray-200">{text.substring(idx + quotedText.length)}</span>
        </>
      );
    };

    // Find the original snippet that was replaced (from the finding)
    const getOriginalSnippet = () => {
      const relatedFinding = findings.find(f =>
        f.anchors[0]?.paragraph_id === paragraph.paragraph_id &&
        f.proposedEdit?.newText === rewrittenText
      );
      return relatedFinding?.anchors[0]?.quoted_text || '';
    };

    // Render diff view - show paragraph with inline diff for the changed snippet
    const renderDiffView = () => {
      const originalSnippet = getOriginalSnippet();
      if (!originalSnippet) {
        return <span className="text-emerald-400">{rewrittenText}</span>;
      }

      const idx = originalText.indexOf(originalSnippet);
      if (idx === -1) {
        return <span className="text-emerald-400">{rewrittenText}</span>;
      }

      return (
        <>
          <span className="text-gray-200">{originalText.substring(0, idx)}</span>
          <span className="text-red-400/70 line-through">{originalSnippet}</span>
          <span className="text-emerald-400 font-medium"> {rewrittenText} </span>
          <span className="text-gray-200">{originalText.substring(idx + originalSnippet.length)}</span>
        </>
      );
    };

    return (
      <div
        key={paragraph.paragraph_id}
        id={paragraph.paragraph_id}
        className={`
          relative group transition-all duration-200 rounded-lg overflow-visible
          ${hasActiveIssues && !isRewritten ? 'cursor-pointer' : ''}
        `}
        style={{
          backgroundColor: isSelected ? selectionColors.bg : isRewritten ? 'rgba(52, 211, 153, 0.04)' : 'transparent',
          border: isSelected
            ? `1px solid ${selectionColors.border}`
            : isRewritten
              ? '1px solid rgba(52, 211, 153, 0.2)'
              : '1px solid rgba(255, 255, 255, 0.06)',
          borderLeft: isSelected
            ? `4px solid ${selectionColors.accent}`
            : isRewritten
              ? '4px solid rgba(52, 211, 153, 0.4)'
              : '1px solid rgba(255, 255, 255, 0.06)'
        }}
        onClick={() => hasActiveIssues && !isRewritten && onParagraphClick(paragraph.paragraph_id)}
      >
        <div className="py-4 px-4 pr-12">
          {/* Paragraph text */}
          <p className="text-[15px] leading-[1.85] text-gray-200">
            {isRewritten
              ? isDiffView
                ? renderDiffView()
                : (() => {
                    const originalSnippet = getOriginalSnippet();
                    if (!originalSnippet) {
                      return <span>{rewrittenText}</span>;
                    }
                    const idx = originalText.indexOf(originalSnippet);
                    if (idx === -1) {
                      return <span>{rewrittenText}</span>;
                    }
                    return (
                      <>
                        <span>{originalText.substring(0, idx)}</span>
                        <span>{rewrittenText}</span>
                        <span>{originalText.substring(idx + originalSnippet.length)}</span>
                      </>
                    );
                  })()
              : renderTextWithHighlight(paragraph.text)
            }
          </p>

          {/* Rewritten controls - shown below text */}
          {isRewritten && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                  Rewritten
                </span>
              </div>
              {/* Hover-only controls */}
              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-3 w-px bg-gray-600" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDiffView(paragraph.paragraph_id);
                  }}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {isDiffView ? (
                    <>
                      <Eye className="w-3 h-3" />
                      See Final
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-3 h-3" />
                      See Diff
                    </>
                  )}
                </button>
                {onRevertRewrite && (
                  <>
                    <div className="h-3 w-px bg-gray-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevertRewrite(paragraph.paragraph_id);
                      }}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revert
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Issue indicator pills - vertical stack on right edge */}
        {hasActiveIssues && !isRewritten && (
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-50 pointer-events-auto"
            style={{ transform: 'translateY(-50%) translateX(50%)' }}
          >
            {activeIssues.map((issue) => {
              const type = getCategoryType(issue.category);
              const config = typeConfig[type];
              const isMajor = issue.severity === 'critical' || issue.severity === 'major';
              const sevPill = isMajor ? severityPillColors.major : severityPillColors.minor;
              const isThisSelected = selectedIssueId === issue.id;

              return (
                <button
                  key={issue.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onSelectIssue) {
                      onSelectIssue(issue.id);
                    }
                  }}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded-full cursor-pointer transition-all hover:scale-110 hover:brightness-110 pointer-events-auto"
                  style={{
                    backgroundColor: isThisSelected ? config.color : 'rgba(30, 30, 35, 0.95)',
                    border: `2px solid ${config.color}`
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none"
                    style={{
                      backgroundColor: sevPill.bg,
                      color: sevPill.text
                    }}
                  >
                    {isMajor ? '!' : 'i'}
                  </div>
                  <span
                    className="text-[11px] font-bold px-1 pointer-events-none"
                    style={{ color: isThisSelected ? '#000' : config.color }}
                  >
                    {config.letter}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-8 px-6 overflow-visible">
      {/* Document Title */}
      <header className="mb-10 pb-6 border-b border-gray-700/30">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          {document.title}
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          {document.paragraphs.length} paragraphs
        </p>
      </header>

      {/* Document content */}
      <div className="space-y-1 overflow-visible">
        {document.sections.length > 0 ? (
          document.sections.map(section => (
            <section key={section.section_id} className="mb-10">
              {/* Section title */}
              {section.section_title && (
                <h2 className={`
                  font-semibold text-white mb-5 tracking-tight px-4
                  ${section.level === 1 ? 'text-xl' : ''}
                  ${section.level === 2 ? 'text-lg' : ''}
                  ${section.level >= 3 ? 'text-base' : ''}
                `}>
                  {section.section_title}
                </h2>
              )}

              {/* Section paragraphs */}
              <div className="space-y-1">
                {section.paragraph_ids?.map((paragraphId: string, idx: number) => {
                  const paragraph = document.paragraphs.find(p => p.paragraph_id === paragraphId);
                  return paragraph ? renderParagraph(paragraph, idx) : null;
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="space-y-1">
            {document.paragraphs.map((paragraph, index) => renderParagraph(paragraph, index))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {document.paragraphs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500">No content available</p>
        </div>
      )}
    </div>
  );
}
