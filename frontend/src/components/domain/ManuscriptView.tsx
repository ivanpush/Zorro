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
  highlightedParagraphId?: string | null;
  onParagraphClick: (paragraphId: string) => void;
  onSelectIssue?: (issueId: string) => void;
  onBubbleSelect?: (issue: Finding) => void;
  onRevertRewrite?: (paragraphId: string) => void;
  onUserEdit?: (paragraphId: string, newText: string) => void;
  onRevertUserEdit?: (paragraphId: string) => void;
  onClearHighlight?: () => void;
}

// Category type mapping
type IssueType = 'critical' | 'argument' | 'writing';

const getCategoryType = (category: string): IssueType => {
  if (category.includes('adversarial') || category.includes('counterpoint')) return 'critical';
  if (category.includes('rigor')) return 'argument';
  return 'writing'; // clarity and others
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
  highlightedParagraphId,
  onParagraphClick,
  onSelectIssue,
  onBubbleSelect,
  onRevertRewrite,
  onUserEdit,
  onRevertUserEdit,
  onClearHighlight
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
    const isHighlighted = paragraph.paragraph_id === highlightedParagraphId;

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
              textDecorationThickness: '3px',
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

    // Word-level diff using Longest Common Subsequence (LCS)
    // Returns array of { text, type } where type is 'same', 'added', or 'removed'
    const computeWordDiff = (original: string, edited: string): Array<{ text: string; type: 'same' | 'added' | 'removed' }> => {
      // Split into words while preserving whitespace
      const tokenize = (str: string) => str.split(/(\s+)/).filter(t => t.length > 0);
      const originalTokens = tokenize(original);
      const editedTokens = tokenize(edited);

      // Build LCS table
      const m = originalTokens.length;
      const n = editedTokens.length;
      const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (originalTokens[i - 1] === editedTokens[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
          } else {
            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          }
        }
      }

      // Backtrack to build diff
      const result: Array<{ text: string; type: 'same' | 'added' | 'removed' }> = [];
      let i = m, j = n;

      const tempResult: Array<{ text: string; type: 'same' | 'added' | 'removed' }> = [];
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalTokens[i - 1] === editedTokens[j - 1]) {
          tempResult.push({ text: originalTokens[i - 1], type: 'same' });
          i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          tempResult.push({ text: editedTokens[j - 1], type: 'added' });
          j--;
        } else {
          tempResult.push({ text: originalTokens[i - 1], type: 'removed' });
          i--;
        }
      }

      // Reverse to get correct order and merge consecutive same-type tokens
      for (let k = tempResult.length - 1; k >= 0; k--) {
        const item = tempResult[k];
        if (result.length > 0 && result[result.length - 1].type === item.type) {
          result[result.length - 1].text += item.text;
        } else {
          result.push({ ...item });
        }
      }

      return result;
    };

    // Render diff view for AI rewrites - compare full original with full rewritten text
    const renderDiffView = () => {
      if (!rewrittenText) {
        return <span className="text-gray-200">{originalText}</span>;
      }

      // Use word-level diff to compare original paragraph with rewritten paragraph
      const diffParts = computeWordDiff(originalText, rewrittenText);

      return (
        <>
          {diffParts.map((part, i) => {
            if (part.type === 'same') {
              return <span key={i} className="text-gray-200">{part.text}</span>;
            } else if (part.type === 'removed') {
              return <span key={i} className="text-red-400 bg-red-400/10 px-0.5 line-through">{part.text}</span>;
            } else {
              return <span key={i} className="text-emerald-400 bg-emerald-400/10 px-0.5">{part.text}</span>;
            }
          })}
        </>
      );
    };

    // Determine paragraph styling based on state
    const getParagraphStyle = () => {
      // Highlighted user edit (from goto)
      if (isHighlighted && isUserEdited) {
        return {
          backgroundColor: 'rgba(250, 204, 21, 0.08)',
          border: '2px solid rgba(250, 204, 21, 0.4)',
          borderLeft: '6px solid #facc15'
        };
      }
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
          backgroundColor: 'rgba(255, 255, 255, 0.015)',
          border: '2px solid rgba(136, 202, 202, 0.4)',
          borderLeft: '6px solid #88CACA'
        };
      }
      return {
        backgroundColor: 'rgba(255, 255, 255, 0.015)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.06)'
      };
    };

    // Render user edit diff view - word-level diff
    const renderUserEditDiffView = () => {
      const diffParts = computeWordDiff(originalText, userEditedText || '');

      return (
        <>
          {diffParts.map((part, i) => {
            if (part.type === 'same') {
              return <span key={i} className="text-gray-200">{part.text}</span>;
            } else if (part.type === 'removed') {
              return <span key={i} className="text-red-400 bg-red-400/10 px-0.5 line-through">{part.text}</span>;
            } else {
              return <span key={i} className="text-emerald-400 bg-emerald-400/10 px-0.5">{part.text}</span>;
            }
          })}
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
        // rewrittenText is now the full paragraph text
        return <span>{rewrittenText}</span>;
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
        onClick={() => {
          // Clear highlight when clicking any paragraph
          if (highlightedParagraphId && onClearHighlight) {
            onClearHighlight();
          }
          if (hasActiveIssues && !isRewritten && !isUserEdited && !isEditing) {
            onParagraphClick(paragraph.paragraph_id);
          }
        }}
      >
        {/* Edit button - top right, subtle, visible on hover */}
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // For edited/rewritten paragraphs, start with the current displayed text
              // rewrittenText is now the full paragraph text (not just a snippet)
              const currentText = isUserEdited
                ? (userEditedText || paragraph.text)
                : isRewritten
                  ? (rewrittenText || paragraph.text)
                  : paragraph.text;
              startEditing(paragraph.paragraph_id, currentText);
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-colors p-1.5 rounded text-gray-500 hover:text-yellow-400 z-20"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}

        <div className="py-4 px-4 pr-4">
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

              {/* User edited badge + controls */}
              {isUserEdited && (
                <div className="flex items-center justify-between mt-3">
                  {/* Badge - bottom left */}
                  {isShowingFinal ? (
                    <div className="flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-[10px] font-medium text-yellow-400 uppercase tracking-wide">
                        Edited
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                  {/* Controls - bottom right */}
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            if (onClearHighlight) onClearHighlight();
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
                <div className="flex items-center justify-between mt-3">
                  {/* Badge - bottom left */}
                  {isShowingFinal ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                        REWRITE APPLIED
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                  {/* Controls - bottom right */}
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
        {hasActiveIssues && (
          <div
            className="absolute right-0 top-10 flex flex-col gap-1 z-50 pointer-events-auto"
            style={{ transform: 'translateX(100%)' }}
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
                    if (onBubbleSelect) {
                      onBubbleSelect(issue);
                    }
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110 pointer-events-auto"
                  style={{
                    backgroundColor: isThisSelected ? `${config.color}30` : `${config.color}15`,
                    border: isThisSelected ? `3px solid ${config.color}` : `1px solid ${config.color}`,
                    boxShadow: isThisSelected ? `0 0 8px ${config.color}40` : 'none'
                  }}
                >
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: isMajor ? '#f97316' : '#9ca3af' }}
                  >
                    {isMajor ? '!' : 'i'}
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
    <div className="py-8 px-4 overflow-visible">
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
                  font-semibold text-white mb-5 mt-8 tracking-tight px-4
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
