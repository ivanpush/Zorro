import { useMemo, useState } from 'react';
import { CheckCircle, Eye, RotateCcw, ArrowLeftRight, Pencil, X } from 'lucide-react';
import type { DocObj, Finding } from '@/types';

interface ManuscriptViewProps {
  document: DocObj;
  selectedIssueId: string | null;
  findings: Finding[];
  rewrittenParagraphs: Map<string, string>;
  userEditedParagraphs: Map<string, string>;
  acceptedIssueIds: Set<string>;
  dismissedIssueIds: Set<string>;
  onParagraphClick: (paragraphId: string) => void;
  onSelectIssue?: (issueId: string) => void;
  onRevertRewrite?: (paragraphId: string) => void;
  onUserEdit?: (paragraphId: string, newText: string) => void;
  onRevertUserEdit?: (paragraphId: string) => void;
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

// Universal selection color - #88CACA (cyan/teal)
const selectionColor = {
  accent: '#88CACA',
  border: 'rgba(136, 202, 202, 0.3)',
  bg: 'rgba(136, 202, 202, 0.04)',
  highlight: '#88CACA'
};

// Severity pill colors
const severityPillColors = {
  major: { bg: '#f97316', text: '#fff' },
  minor: { bg: '#E6E6E6', text: '#000' }
};

export function ManuscriptView({
  document,
  selectedIssueId,
  findings,
  rewrittenParagraphs,
  userEditedParagraphs,
  acceptedIssueIds,
  dismissedIssueIds,
  onParagraphClick,
  onSelectIssue,
  onRevertRewrite,
  onUserEdit,
  onRevertUserEdit
}: ManuscriptViewProps) {
  // Track which paragraphs are showing final (diff is default)
  const [showingFinal, setShowingFinal] = useState<Set<string>>(new Set());
  // Track which paragraph is being edited by user
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

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

  const toggleFinalView = (paragraphId: string) => {
    setShowingFinal(prev => {
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

  // Start editing a paragraph
  const startEditing = (paragraphId: string, currentText: string) => {
    setEditingParagraphId(paragraphId);
    setEditText(currentText);
  };

  // Save user edit
  const saveUserEdit = (paragraphId: string) => {
    if (onUserEdit && editText.trim()) {
      onUserEdit(paragraphId, editText);
    }
    setEditingParagraphId(null);
    setEditText('');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingParagraphId(null);
    setEditText('');
  };

  // Render paragraph
  const renderParagraph = (paragraph: any, index: number) => {
    const activeIssues = paragraphIssuesMap.get(paragraph.paragraph_id) || [];
    const hasActiveIssues = activeIssues.length > 0;
    const isSelected = paragraph.paragraph_id === selectedParagraphId;
    const isRewritten = rewrittenParagraphs.has(paragraph.paragraph_id);
    const rewrittenText = rewrittenParagraphs.get(paragraph.paragraph_id);
    const isUserEdited = userEditedParagraphs.has(paragraph.paragraph_id);
    const userEditedText = userEditedParagraphs.get(paragraph.paragraph_id);
    const originalText = paragraph.text;
    const isShowingFinal = showingFinal.has(paragraph.paragraph_id);
    const issueTypes = getIssueTypes(activeIssues);
    const isEditing = editingParagraphId === paragraph.paragraph_id;

    // Use universal #88CACA for all selection highlighting
    const selectedTypeColor = '#88CACA';

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
              textDecorationColor: selectedTypeColor,
              textDecorationThickness: '2px',
              textUnderlineOffset: '3px',
              backgroundColor: `${selectedTypeColor}12`,
              padding: '1px 2px',
              borderRadius: '2px'
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
      if (!originalSnippet || !rewrittenText) {
        return <span className="text-emerald-400 bg-emerald-400/10 px-0.5">{rewrittenText}</span>;
      }

      const idx = originalText.indexOf(originalSnippet);
      if (idx === -1) {
        return <span className="text-emerald-400 bg-emerald-400/10 px-0.5">{rewrittenText}</span>;
      }

      return (
        <>
          <span className="text-gray-200">{originalText.substring(0, idx)}</span>
          <span className="text-red-400 bg-red-400/10 px-0.5 line-through">{originalSnippet}</span>
          <span className="text-emerald-400 bg-emerald-400/10 px-0.5">{rewrittenText}</span>
          <span className="text-gray-200">{originalText.substring(idx + originalSnippet.length)}</span>
        </>
      );
    };

    // Determine paragraph styling based on state
    const getParagraphStyle = () => {
      // User edited paragraphs - subtle bg, same as regular
      if (isUserEdited) {
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.015)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.06)'
        };
      }
      if (isRewritten) {
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.015)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.06)'
        };
      }
      if (isSelected) {
        return {
          backgroundColor: `${selectedTypeColor}05`,
          border: `1px solid ${selectedTypeColor}15`,
          borderLeft: `4px solid ${selectedTypeColor}`
        };
      }
      return {
        backgroundColor: 'rgba(255, 255, 255, 0.015)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.06)'
      };
    };

    // Compute inline diff between original and edited text
    // Find the longest common prefix and suffix to show only what actually changed
    const computeInlineDiff = (original: string, edited: string) => {
      // Find common prefix
      let prefixEnd = 0;
      while (prefixEnd < original.length && prefixEnd < edited.length && original[prefixEnd] === edited[prefixEnd]) {
        prefixEnd++;
      }

      // Find common suffix (but don't overlap with prefix)
      let suffixStart = 0;
      while (
        suffixStart < (original.length - prefixEnd) &&
        suffixStart < (edited.length - prefixEnd) &&
        original[original.length - 1 - suffixStart] === edited[edited.length - 1 - suffixStart]
      ) {
        suffixStart++;
      }

      const prefix = original.substring(0, prefixEnd);
      const suffix = original.substring(original.length - suffixStart);
      const removedPart = original.substring(prefixEnd, original.length - suffixStart);
      const addedPart = edited.substring(prefixEnd, edited.length - suffixStart);

      return { prefix, suffix, removedPart, addedPart };
    };

    // Render user edit diff view - inline, only showing actual changes
    const renderUserEditDiffView = () => {
      const { prefix, suffix, removedPart, addedPart } = computeInlineDiff(originalText, userEditedText || '');

      return (
        <>
          <span className="text-gray-200">{prefix}</span>
          {removedPart && <span className="text-red-400 bg-red-400/10 px-0.5 line-through">{removedPart}</span>}
          {addedPart && <span className="text-emerald-400 bg-emerald-400/10 px-0.5">{addedPart}</span>}
          <span className="text-gray-200">{suffix}</span>
        </>
      );
    };

    // Get displayed text based on state (diff is default, final on toggle)
    const getDisplayedText = () => {
      if (isEditing) return null; // Edit mode shows textarea instead
      if (isUserEdited) {
        // Diff is default, show final only when toggled
        return isShowingFinal ? <span>{userEditedText}</span> : renderUserEditDiffView();
      }
      if (isRewritten) {
        // Diff is default, show final only when toggled
        if (!isShowingFinal) return renderDiffView();
        const originalSnippet = getOriginalSnippet();
        if (!originalSnippet) return <span>{rewrittenText}</span>;
        const idx = originalText.indexOf(originalSnippet);
        if (idx === -1) return <span>{rewrittenText}</span>;
        return (
          <>
            <span>{originalText.substring(0, idx)}</span>
            <span>{rewrittenText}</span>
            <span>{originalText.substring(idx + originalSnippet.length)}</span>
          </>
        );
      }
      return renderTextWithHighlight(paragraph.text);
    };

    return (
      <div
        key={paragraph.paragraph_id}
        id={paragraph.paragraph_id}
        className={`
          relative group transition-all duration-200 rounded-lg overflow-visible
          ${hasActiveIssues && !isRewritten && !isUserEdited ? 'cursor-pointer' : ''}
        `}
        style={getParagraphStyle()}
        onClick={() => hasActiveIssues && !isRewritten && !isUserEdited && !isEditing && onParagraphClick(paragraph.paragraph_id)}
      >
        {/* Edit button - top right, subtle, visible on hover */}
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // For edited/rewritten paragraphs, start with the current displayed text
              const currentText = isUserEdited
                ? (userEditedText || paragraph.text)
                : isRewritten
                  ? (rewrittenText || paragraph.text)
                  : paragraph.text;
              startEditing(paragraph.paragraph_id, currentText);
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1.5 rounded text-gray-500 hover:text-gray-300 z-20"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}

        <div className="py-4 px-4 pr-12">
          {/* Edit mode */}
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-3 text-[15px] leading-[1.85] text-gray-100 bg-gray-800/50 border border-yellow-500/30 rounded-lg resize-y focus:outline-none focus:border-yellow-500/50"
                style={{ minHeight: Math.max(120, Math.ceil(editText.length / 80) * 28 + 40) }}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveUserEdit(paragraph.paragraph_id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Paragraph text */}
              <p className="text-[15px] leading-[1.85] text-gray-200">
                {getDisplayedText()}
              </p>

              {/* User edited badge + controls (same pattern as rewritten) */}
              {isUserEdited && (
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-[10px] font-medium text-yellow-400 uppercase tracking-wide">
                      Edited
                    </span>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-3 w-px bg-gray-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFinalView(paragraph.paragraph_id);
                      }}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      {isShowingFinal ? (
                        <>
                          <ArrowLeftRight className="w-3 h-3" />
                          Diff
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          Final
                        </>
                      )}
                    </button>
                    {onRevertUserEdit && (
                      <>
                        <div className="h-3 w-px bg-gray-600" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRevertUserEdit(paragraph.paragraph_id);
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

              {/* Rewritten controls - green styling */}
              {isRewritten && (
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                      REWRITE APPLIED
                    </span>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-3 w-px bg-gray-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFinalView(paragraph.paragraph_id);
                      }}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      {isShowingFinal ? (
                        <>
                          <ArrowLeftRight className="w-3 h-3" />
                          Diff
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          Final
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
            </>
          )}
        </div>

        {/* Issue indicator pills - vertical stack, below edit button */}
        {hasActiveIssues && !isRewritten && (
          <div
            className="absolute right-0 top-10 flex flex-col gap-0.5 z-50 pointer-events-auto"
            style={{ transform: 'translateX(50%)' }}
          >
            {activeIssues.map((issue) => {
              const type = getCategoryType(issue.category);
              const config = typeConfig[type];
              const isMajor = issue.severity === 'critical' || issue.severity === 'major';
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
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded-full cursor-pointer transition-all hover:scale-105 pointer-events-auto"
                  style={{
                    backgroundColor: isThisSelected ? `${config.color}25` : `${config.color}10`,
                    border: isThisSelected ? `2px solid ${config.color}` : `1px solid ${config.color}30`,
                    boxShadow: isThisSelected ? `0 0 8px ${config.color}40` : 'none'
                  }}
                >
                  {/* Severity icon */}
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{
                      backgroundColor: isMajor ? 'rgba(249, 115, 22, 0.15)' : 'rgba(156, 163, 175, 0.1)',
                      border: isMajor ? '1.5px solid #f97316' : '1.5px solid #9ca3af',
                      color: isMajor ? '#f97316' : '#9ca3af'
                    }}
                  >
                    {isMajor ? '!' : 'i'}
                  </span>
                  {/* Type letter */}
                  <span
                    className="w-3 text-center text-[10px] font-bold"
                    style={{ color: config.color }}
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
