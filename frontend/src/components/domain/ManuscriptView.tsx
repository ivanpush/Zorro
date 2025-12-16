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
  onRevertRewrite?: (paragraphId: string) => void;
}

// Category type mapping
const getCategoryType = (category: string): 'critical' | 'argument' | 'writing' => {
  if (category.includes('adversarial') || category.includes('scope')) return 'critical';
  if (category.includes('rigor')) return 'argument';
  return 'writing';
};

// Severity colors for selection
const severityColors = {
  critical: {
    border: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.06)',
    highlight: 'rgba(239, 68, 68, 0.25)'
  },
  major: {
    border: '#f97316',
    bg: 'rgba(249, 115, 22, 0.06)',
    highlight: 'rgba(249, 115, 22, 0.25)'
  },
  minor: {
    border: '#eab308',
    bg: 'rgba(234, 179, 8, 0.06)',
    highlight: 'rgba(234, 179, 8, 0.25)'
  },
  suggestion: {
    border: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.06)',
    highlight: 'rgba(59, 130, 246, 0.25)'
  }
};

// Category type colors for dots
const typeColors = {
  critical: '#e879f9',
  argument: '#60a5fa',
  writing: '#4ade80'
};

export function ManuscriptView({
  document,
  selectedIssueId,
  findings,
  rewrittenParagraphs,
  acceptedIssueIds,
  dismissedIssueIds,
  onParagraphClick,
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

  // Map paragraphs to their original text (from findings)
  const originalTextMap = useMemo(() => {
    const map = new Map<string, string>();
    findings.forEach(finding => {
      if (finding.anchors[0]?.paragraph_id && finding.anchors[0]?.quoted_text) {
        // Store the full original paragraph text if available
        const para = document.paragraphs.find(p => p.paragraph_id === finding.anchors[0].paragraph_id);
        if (para) {
          map.set(finding.anchors[0].paragraph_id, para.text);
        }
      }
    });
    return map;
  }, [findings, document.paragraphs]);

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

  // Render paragraph
  const renderParagraph = (paragraph: any, index: number) => {
    const activeIssues = paragraphIssuesMap.get(paragraph.paragraph_id) || [];
    const hasActiveIssues = activeIssues.length > 0;
    const isSelected = paragraph.paragraph_id === selectedParagraphId;
    const isRewritten = rewrittenParagraphs.has(paragraph.paragraph_id);
    const rewrittenText = rewrittenParagraphs.get(paragraph.paragraph_id);
    const originalText = paragraph.text;
    const isDiffView = showingDiff.has(paragraph.paragraph_id);

    // Get severity for selection styling
    const severity = selectedIssue?.severity || activeIssues[0]?.severity || 'minor';
    const colors = severityColors[severity as keyof typeof severityColors] || severityColors.minor;

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
          <mark
            className="text-white font-medium rounded px-0.5 -mx-0.5"
            style={{ backgroundColor: colors.highlight }}
          >
            {quotedText}
          </mark>
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
        // Fallback: just show the new text
        return <span className="text-green-400">{rewrittenText}</span>;
      }

      const idx = originalText.indexOf(originalSnippet);
      if (idx === -1) {
        return <span className="text-green-400">{rewrittenText}</span>;
      }

      return (
        <>
          <span className="text-gray-200">{originalText.substring(0, idx)}</span>
          <span className="text-red-400/70 line-through">{originalSnippet}</span>
          <span className="text-green-400 font-medium"> {rewrittenText} </span>
          <span className="text-gray-200">{originalText.substring(idx + originalSnippet.length)}</span>
        </>
      );
    };

    return (
      <div
        key={paragraph.paragraph_id}
        id={paragraph.paragraph_id}
        className={`
          relative group transition-all duration-200 rounded-md
          ${hasActiveIssues && !isRewritten ? 'cursor-pointer hover:bg-white/[0.02]' : ''}
        `}
        style={{
          backgroundColor: isSelected ? colors.bg : isRewritten ? 'rgba(74, 222, 128, 0.03)' : 'transparent',
          borderLeft: isSelected ? `3px solid ${colors.border}` : isRewritten ? '3px solid rgba(74, 222, 128, 0.3)' : '3px solid transparent',
          paddingLeft: isSelected || isRewritten ? '16px' : '12px'
        }}
        onClick={() => hasActiveIssues && !isRewritten && onParagraphClick(paragraph.paragraph_id)}
      >
        <div className="py-3 pr-3">
          {/* Paragraph text */}
          <p className="text-[15px] leading-[1.8] font-normal">
            {isRewritten
              ? isDiffView
                ? renderDiffView()
                : (() => {
                    // Show final text with replacement inline
                    const originalSnippet = getOriginalSnippet();
                    if (!originalSnippet) {
                      return <span className="text-gray-200">{rewrittenText}</span>;
                    }
                    const idx = originalText.indexOf(originalSnippet);
                    if (idx === -1) {
                      return <span className="text-gray-200">{rewrittenText}</span>;
                    }
                    return (
                      <>
                        <span className="text-gray-200">{originalText.substring(0, idx)}</span>
                        <span className="text-gray-200">{rewrittenText}</span>
                        <span className="text-gray-200">{originalText.substring(idx + originalSnippet.length)}</span>
                      </>
                    );
                  })()
              : renderTextWithHighlight(paragraph.text)
            }
          </p>

          {/* Rewritten controls - shown below text */}
          {isRewritten && (
            <div className="flex items-center gap-3 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] font-medium text-green-500 uppercase tracking-wide">
                  Rewritten
                </span>
              </div>
              <div className="h-3 w-px bg-gray-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDiffView(paragraph.paragraph_id);
                }}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
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
                  <div className="h-3 w-px bg-gray-700" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRevertRewrite(paragraph.paragraph_id);
                    }}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Revert
                  </button>
                </>
              )}
            </div>
          )}

          {/* Issue type indicators - subtle dots */}
          {hasActiveIssues && !isSelected && !isRewritten && (
            <div className="flex items-center gap-1.5 mt-2 opacity-40 group-hover:opacity-80 transition-opacity">
              {activeIssues.slice(0, 4).map((issue, i) => {
                const type = getCategoryType(issue.category);
                return (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: typeColors[type].border }}
                  />
                );
              })}
              {activeIssues.length > 4 && (
                <span className="text-[10px] text-gray-600">+{activeIssues.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="py-8 px-8">
      {/* Document Title */}
      <header className="mb-10 pb-6 border-b border-white/5">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          {document.title}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {document.paragraphs.length} paragraphs
        </p>
      </header>

      {/* Document content */}
      <div className="space-y-0.5">
        {document.sections.length > 0 ? (
          document.sections.map(section => (
            <section key={section.section_id} className="mb-10">
              {/* Section title */}
              {section.section_title && (
                <h2 className={`
                  font-semibold text-white mb-5 tracking-tight
                  ${section.level === 1 ? 'text-xl' : ''}
                  ${section.level === 2 ? 'text-lg' : ''}
                  ${section.level >= 3 ? 'text-base' : ''}
                `}>
                  {section.section_title}
                </h2>
              )}

              {/* Section paragraphs */}
              <div className="space-y-0.5">
                {section.paragraph_ids?.map((paragraphId: string, idx: number) => {
                  const paragraph = document.paragraphs.find(p => p.paragraph_id === paragraphId);
                  return paragraph ? renderParagraph(paragraph, idx) : null;
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="space-y-0.5">
            {document.paragraphs.map((paragraph, index) => renderParagraph(paragraph, index))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {document.paragraphs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-600">No content available</p>
        </div>
      )}
    </div>
  );
}
