import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Check, X, ChevronDown, ChevronRight, ChevronUp, Undo2, Edit3, Pencil, ArrowRight, HelpCircle } from 'lucide-react';
import type { Finding, DocObj } from '@/types';

interface UserEdit {
  paragraphId: string;
  originalText: string;
  editedText: string;
}

interface IssuesPanelProps {
  issues: Finding[];
  document: DocObj;
  selectedIssueId: string | null;
  acceptedIssueIds: Set<string>;
  dismissedIssueIds: Set<string>;
  rewrittenParagraphs: Map<string, string>;
  userEditedParagraphs: Map<string, string>;
  filterSeverity: string | null;
  onFilterChange: (severity: string | null) => void;
  onSelectIssue: (issueId: string) => void;
  selectIssueRef?: React.MutableRefObject<((issue: Finding) => void) | null>;
  onAcceptIssue: (issueId: string) => void;
  onAcceptRewrite: (issueId: string, editedText?: string) => void;
  onDismissIssue: (issueId: string) => void;
  onUndoIssue: (issueId: string) => void;
  onGotoEdit?: (paragraphId: string) => void;
}

// Category type mapping
type IssueType = 'critical' | 'argument' | 'writing';

const getCategoryType = (category: string): IssueType => {
  if (category.includes('adversarial') || category.includes('counterpoint')) return 'critical';
  if (category.includes('rigor')) return 'argument';
  return 'writing'; // clarity and others
};

// Type configuration
const typeConfig: Record<IssueType, { label: string; color: string; bg: string; letter: string }> = {
  critical: { label: 'Critical', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', letter: 'C' },
  argument: { label: 'Argument', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', letter: 'A' },
  writing: { label: 'Writing', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', letter: 'W' }
};

// Severity configuration (kept for future use)
// const severityConfig = { major: { label: 'Major', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' }, minor: { label: 'Minor', color: '#E6E6E6', bg: 'rgba(230, 230, 230, 0.15)' } };

// Universal selection color - #88CACA (cyan/teal, matching ManuscriptView)
// const selectionColor = { bg: 'rgba(136, 202, 202, 0.06)', border: 'rgba(136, 202, 202, 0.4)', accent: '#88CACA' };

export function IssuesPanel({
  issues,
  document,
  selectedIssueId,
  acceptedIssueIds,
  dismissedIssueIds,
  rewrittenParagraphs,
  userEditedParagraphs,
  onSelectIssue,
  selectIssueRef,
  onAcceptIssue,
  onAcceptRewrite,
  onDismissIssue,
  onUndoIssue,
  onGotoEdit
}: IssuesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<IssueType | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track previous selectedIssueId to detect actual changes
  const prevSelectedIssueIdRef = useRef<string | null>(null);

  // Register callback for ManuscriptView bubble clicks
  useEffect(() => {
    if (selectIssueRef) {
      selectIssueRef.current = (issue: Finding) => {
        const issueType = getCategoryType(issue.category);
        const severity = issue.severity === 'critical' || issue.severity === 'major' ? 'major' : 'minor';

        // 1. Clear filter if it would hide this issue
        if (categoryFilter && categoryFilter !== issueType) {
          setCategoryFilter(null);
        }

        // 2. Expand the relevant sections
        setExpandedSections(prev => {
          const next = new Set(prev);
          next.add(severity);
          next.add('needs-attention');
          if (acceptedIssueIds.has(issue.id)) next.add('accepted');
          if (dismissedIssueIds.has(issue.id)) next.add('dismissed');
          return next;
        });

        // 3. Expand the card
        setExpandedIssueId(issue.id);

        // 4. Scroll to the card after DOM updates
        setTimeout(() => {
          const element = window.document.getElementById(`issue-${issue.id}`);
          const container = scrollContainerRef.current;
          if (element && container) {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - 100;
            container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
          }
        }, 100);
      };
    }

    return () => {
      if (selectIssueRef) {
        selectIssueRef.current = null;
      }
    };
  }, [selectIssueRef, categoryFilter, acceptedIssueIds, dismissedIssueIds]);

  // Auto-expand issue when selected (e.g., from clicking bubble in manuscript)
  useEffect(() => {
    // Only run when selectedIssueId actually changes
    if (selectedIssueId === prevSelectedIssueIdRef.current) return;
    prevSelectedIssueIdRef.current = selectedIssueId;

    if (!selectedIssueId) return;

    const selectedIssue = issues.find(i => i.id === selectedIssueId);
    if (!selectedIssue) return;

    const issueType = getCategoryType(selectedIssue.category);
    const severity = selectedIssue.severity === 'critical' || selectedIssue.severity === 'major' ? 'major' : 'minor';

    // Clear filter if it would hide this issue
    if (categoryFilter && categoryFilter !== issueType) {
      setCategoryFilter(null);
    }

    // Expand the relevant sections
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.add(severity);
      next.add('needs-attention');
      if (acceptedIssueIds.has(selectedIssueId)) next.add('accepted');
      if (dismissedIssueIds.has(selectedIssueId)) next.add('dismissed');
      return next;
    });

    // Expand the card
    setExpandedIssueId(selectedIssueId);

    // Scroll to the card after a delay for DOM to update
    setTimeout(() => {
      const element = window.document.getElementById(`issue-${selectedIssueId}`);
      const container = scrollContainerRef.current;
      if (element && container) {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - 100;
        container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }, 300);

  }, [selectedIssueId, issues, acceptedIssueIds, dismissedIssueIds, categoryFilter]);

  // Build user edits list with original text
  const userEdits = useMemo(() => {
    const edits: UserEdit[] = [];
    userEditedParagraphs.forEach((editedText, paragraphId) => {
      const paragraph = document.paragraphs.find(p => p.paragraph_id === paragraphId);
      if (paragraph) {
        edits.push({
          paragraphId,
          originalText: paragraph.text,
          editedText
        });
      }
    });
    return edits;
  }, [userEditedParagraphs, document.paragraphs]);

  // Compute inline diff
  const computeInlineDiff = (original: string, edited: string) => {
    let prefixEnd = 0;
    while (prefixEnd < original.length && prefixEnd < edited.length && original[prefixEnd] === edited[prefixEnd]) {
      prefixEnd++;
    }
    let suffixStart = 0;
    while (
      suffixStart < (original.length - prefixEnd) &&
      suffixStart < (edited.length - prefixEnd) &&
      original[original.length - 1 - suffixStart] === edited[edited.length - 1 - suffixStart]
    ) {
      suffixStart++;
    }
    return {
      prefix: original.substring(0, prefixEnd),
      suffix: original.substring(original.length - suffixStart),
      removedPart: original.substring(prefixEnd, original.length - suffixStart),
      addedPart: edited.substring(prefixEnd, edited.length - suffixStart)
    };
  };

  // Organize issues into groups
  const organizedIssues = useMemo(() => {
    const needsAttention = {
      major: [] as Finding[],
      minor: [] as Finding[]
    };
    const accepted: Finding[] = [];
    const dismissed: Finding[] = [];

    issues.forEach(issue => {
      // Apply category filter
      if (categoryFilter && getCategoryType(issue.category) !== categoryFilter) {
        return;
      }

      if (acceptedIssueIds.has(issue.id)) {
        accepted.push(issue);
      } else if (dismissedIssueIds.has(issue.id)) {
        dismissed.push(issue);
      } else {
        const severity = issue.severity === 'critical' || issue.severity === 'major' ? 'major' : 'minor';
        needsAttention[severity].push(issue);
      }
    });

    return { needsAttention, accepted, dismissed };
  }, [issues, acceptedIssueIds, dismissedIssueIds, categoryFilter]);

  const totalUnresolved = issues.length - acceptedIssueIds.size - dismissedIssueIds.size;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleEditRewrite = (issue: Finding) => {
    setEditingIssueId(issue.id);
    setEditText(issue.proposedEdit?.newText || '');
  };

  const handleSaveEdit = (issueId: string) => {
    onAcceptRewrite(issueId, editText);
    setEditingIssueId(null);
    setEditText('');
  };

  const renderIssueCard = (issue: Finding, isResolved = false) => {
    const isSelected = issue.id === selectedIssueId;
    const isExpanded = issue.id === expandedIssueId;
    const isEditing = issue.id === editingIssueId;
    const type = getCategoryType(issue.category);
    const config = typeConfig[type];
    const severity = issue.severity === 'critical' || issue.severity === 'major' ? 'major' : 'minor';

    // Check if the paragraph for this issue has been user-edited
    const paragraphId = issue.anchors[0]?.paragraphId;
    const isParagraphUserEdited = paragraphId ? userEditedParagraphs.has(paragraphId) : false;
    const isRewriteDisabled = isParagraphUserEdited && !!issue.proposedEdit?.newText;

    return (
      <div
        key={issue.id}
        id={`issue-${issue.id}`}
        className={`
          group relative mb-3 rounded-lg transition-all duration-200 cursor-pointer
          ${isResolved ? 'opacity-50' : ''}
        `}
        style={{
          backgroundColor: isSelected ? 'rgba(136, 202, 202, 0.06)' : 'rgba(255, 255, 255, 0.04)',
          border: isSelected ? '2px solid rgba(136, 202, 202, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
          borderLeft: isSelected ? '4px solid #88CACA' : `4px solid ${config.color}40`,
          boxShadow: isSelected ? '0 0 16px 3px rgba(232, 152, 85, 0.25)' : 'none'
        }}
        onClick={() => onSelectIssue(issue.id)}
      >
        <div className="p-4">
          {/* Header with badges */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Severity icon - ! for major, i for minor */}
              <span
                className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: severity === 'major' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                  border: severity === 'major' ? '2px solid #f97316' : '2px solid #9ca3af',
                  color: severity === 'major' ? '#f97316' : '#9ca3af'
                }}
              >
                {severity === 'major' ? '!' : 'i'}
              </span>
              {/* Type badge */}
              <span
                className="px-2 py-0.5 text-[11px] font-semibold rounded"
                style={{ backgroundColor: config.bg, color: config.color }}
              >
                {config.label}
              </span>
              {/* Location indicator - paragraph IDs */}
              {issue.anchors.length > 0 && (
                <>
                  <span className="text-[10px] text-gray-500">in</span>
                  {issue.anchors.map((anchor, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-gray-700/50 text-gray-400"
                    >
                      {anchor.paragraphId}
                    </span>
                  ))}
                </>
              )}
              {isResolved && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-600/50 text-gray-300">
                  {rewrittenParagraphs.has(issue.anchors[0]?.paragraphId || '') ? 'EDITED' : 'RESOLVED'}
                </span>
              )}
            </div>

            {/* Quick actions or Undo */}
            {!isResolved ? (
              <div className={`
                flex items-center gap-1 transition-opacity
                ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
              `}>
                {/* Accept Issue button - outline style */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcceptIssue(issue.id);
                  }}
                  className="p-1.5 rounded-md border border-transparent hover:border-teal-400 text-teal-400 transition-colors"
                  title="Accept Issue"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismissIssue(issue.id);
                  }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUndoIssue(issue.id);
                }}
                className="p-1.5 rounded-md hover:bg-gray-600/50 text-gray-400 hover:text-gray-300 transition-colors"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Title */}
          <h4 className="text-[17px] font-semibold text-white leading-snug mb-2">
            {issue.title}
          </h4>

          {/* Preview when collapsed */}
          {!isExpanded && (
            <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
              {issue.description}
            </p>
          )}

          {/* Expanded content */}
          {isExpanded && (
            <div className="space-y-4 mt-3">
              {/* Quoted text - light gray with left accent */}
              {issue.anchors[0]?.quotedText && (
                <div
                  className="pl-3 py-1 italic text-xs leading-relaxed"
                  style={{
                    color: '#c0c0c0',
                    borderLeft: '3px solid rgba(232, 152, 85, 0.6)'
                  }}
                >
                  "{issue.anchors[0].quotedText}"
                </div>
              )}

              {/* Critique - plain text, no decoration */}
              {issue.description && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  {issue.description}
                </p>
              )}

              {/* SUGGESTED REWRITE section */}
              {issue.proposedEdit?.newText && !isEditing && (
                <div
                  className={`p-3 rounded-md ${isRewriteDisabled ? 'opacity-60' : ''}`}
                  style={{ backgroundColor: 'rgba(136, 202, 202, 0.08)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#88CACA' }}>
                        Suggested Rewrite
                      </h5>
                      {issue.proposedEdit.rationale && (
                        <div className="relative group/tooltip">
                          <HelpCircle
                            className="w-3.5 h-3.5 cursor-help"
                            style={{ color: '#88CACA' }}
                          />
                          <div className="absolute left-0 bottom-full mb-2 w-64 p-2 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-300 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 delay-500 z-50 shadow-lg">
                            <div className="font-semibold text-gray-200 mb-1">Rationale</div>
                            {issue.proposedEdit.rationale}
                          </div>
                        </div>
                      )}
                      {isRewriteDisabled && (
                        <span className="text-[11px] text-amber-400/80 font-normal">(disabled)</span>
                      )}
                    </div>
                    {!isResolved && !isRewriteDisabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRewrite(issue);
                        }}
                        className="flex items-center gap-1 text-[11px] text-gray-400 transition-colors"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#88CACA'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {issue.proposedEdit.newText}
                  </p>
                </div>
              )}

              {/* SUGGESTION (amber) - collapsible compact card */}
              {issue.proposedEdit && !issue.proposedEdit.newText && issue.proposedEdit.suggestion && !isEditing && (
                <details
                  className={`group rounded border ${isRewriteDisabled ? 'opacity-60' : ''}`}
                  style={{ backgroundColor: 'rgba(251, 191, 36, 0.05)', borderColor: 'rgba(251, 191, 36, 0.2)' }}
                >
                  <summary className="flex items-center justify-between px-2 py-1.5 cursor-pointer list-none select-none">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" style={{ color: '#FBBF24' }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#FBBF24' }}>
                        Suggestion
                      </span>
                      {issue.proposedEdit.rationale && (
                        <div className="relative group/tooltip">
                          <HelpCircle className="w-3 h-3 cursor-help opacity-60" style={{ color: '#FBBF24' }} />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 rounded bg-gray-800 border border-gray-700 text-[11px] text-gray-300 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 shadow-lg">
                            {issue.proposedEdit.rationale}
                          </div>
                        </div>
                      )}
                    </div>
                  </summary>
                  <div className="px-2 pb-2 pt-1">
                    <p className="text-[12px] text-gray-300 leading-relaxed">
                      {issue.proposedEdit.suggestion}
                    </p>
                  </div>
                </details>
              )}

              {/* Edit mode */}
              {isEditing && (
                <div className="p-3 rounded-md" style={{ backgroundColor: 'rgba(136, 202, 202, 0.1)', border: '1px solid rgba(136, 202, 202, 0.2)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Edit3 className="w-3 h-3" style={{ color: '#88CACA' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#88CACA' }}>Edit Rewrite</span>
                  </div>
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                    value={editText}
                    onChange={(e) => {
                      setEditText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full p-3 text-sm text-gray-100 bg-gray-800/50 border border-gray-600 rounded-md resize-y focus:outline-none focus:border-gray-500"
                    style={{ minHeight: '100px', overflow: 'hidden' }}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(issue.id);
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                      style={{ backgroundColor: 'rgba(136, 202, 202, 0.2)', color: '#88CACA' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(136, 202, 202, 0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(136, 202, 202, 0.2)'}
                    >
                      Apply Now
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIssueId(null);
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-md text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isResolved && !isEditing && (
                <div className="space-y-2 pt-2">
                  {/* Disabled rewrite notice */}
                  {isRewriteDisabled && (
                    <div className="text-xs text-amber-400/80 bg-amber-400/10 px-3 py-1.5 rounded-md border border-amber-400/20">
                      Paragraph edited — rewrite disabled
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Accept Rewrite - teal filled button (hidden for suggestions) */}
                    {issue.proposedEdit?.newText && issue.proposedEdit.type !== 'suggestion' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isRewriteDisabled) {
                            onAcceptRewrite(issue.id);
                          }
                        }}
                        disabled={isRewriteDisabled}
                        className="px-4 py-2 text-sm font-medium rounded-md transition-all"
                        style={isRewriteDisabled
                          ? { backgroundColor: 'rgba(107, 114, 128, 0.3)', color: '#6b7280', cursor: 'not-allowed' }
                          : { backgroundColor: '#6fb3b3', color: '#ffffff' }
                        }
                        onMouseEnter={(e) => {
                          if (!isRewriteDisabled) {
                            e.currentTarget.style.backgroundColor = '#5a9e9e';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isRewriteDisabled) {
                            e.currentTarget.style.backgroundColor = '#6fb3b3';
                          }
                        }}
                        title={isRewriteDisabled ? 'Rewrite disabled because paragraph was edited' : 'Accept the AI-suggested rewrite'}
                      >
                        Accept Rewrite
                      </button>
                    )}
                    {/* Accept Issue - outline button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptIssue(issue.id);
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-md transition-colors border"
                      style={{
                        color: '#95A8D4',
                        borderColor: 'rgba(149, 168, 212, 0.5)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(149, 168, 212, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Accept Issue
                    </button>
                    {/* Dismiss - text only */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissIssue(issue.id);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show more/less toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedIssueId(isExpanded ? null : issue.id);
            }}
            className="mt-3 text-xs transition-colors flex items-center gap-1"
            style={{ color: '#E89855' }}
          >
            {isExpanded ? (
              <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>Show more <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>
      </div>
    );
  };

  const needsAttentionTotal = organizedIssues.needsAttention.major.length + organizedIssues.needsAttention.minor.length;

  return (
    <div className="h-full flex flex-col bg-[#16161a]">
      {/* Tab filters - like PeerPreview */}
      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-colors
              ${!categoryFilter
                ? 'text-white border-b-2 border-[#53A4A4]'
                : 'text-gray-400 hover:text-gray-200'}
            `}
          >
            All <span className="text-white">({totalUnresolved})</span>
          </button>
          {Object.entries(typeConfig).map(([type, config]) => {
            return (
              <button
                key={type}
                onClick={() => setCategoryFilter(categoryFilter === type ? null : type as IssueType)}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                  ${categoryFilter === type
                    ? 'border-b-2'
                    : 'text-gray-400 hover:text-gray-200'}
                `}
                style={{
                  color: categoryFilter === type ? config.color : undefined,
                  borderColor: categoryFilter === type ? config.color : undefined
                }}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Issues list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain pb-16">
        {/* Needs Attention Section */}
        {needsAttentionTotal > 0 && (
          <div className="border-b border-gray-700/30 py-2">
            {/* Section header */}
            <div className="px-4 py-2">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                Needs Attention — Accept to include in export
              </span>
            </div>

            {/* Major subsection */}
            {organizedIssues.needsAttention.major.length > 0 && (
              <div className="ml-3">
                <button
                  onClick={() => toggleSection('major')}
                  className="w-full px-4 py-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
                >
                  {expandedSections.has('major') ? (
                    <ChevronDown className="w-4 h-4 text-orange-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-orange-400" />
                  )}
                  <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">
                    Major Issues ({organizedIssues.needsAttention.major.length})
                  </span>
                </button>
                {expandedSections.has('major') && (
                  <div className="px-4 py-3">
                    {organizedIssues.needsAttention.major.map(issue => renderIssueCard(issue))}
                  </div>
                )}
              </div>
            )}

            {/* Minor subsection */}
            {organizedIssues.needsAttention.minor.length > 0 && (
              <div className="ml-3">
                <button
                  onClick={() => toggleSection('minor')}
                  className="w-full px-4 py-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
                >
                  {expandedSections.has('minor') ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    Minor Issues ({organizedIssues.needsAttention.minor.length})
                  </span>
                </button>
                {expandedSections.has('minor') && (
                  <div className="px-4 py-3">
                    {organizedIssues.needsAttention.minor.map(issue => renderIssueCard(issue))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accepted Section - compact one-liner rows */}
        {organizedIssues.accepted.length > 0 && (
          <div className="border-b border-gray-700/30 py-2">
            <button
              onClick={() => toggleSection('accepted')}
              className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
            >
              {expandedSections.has('accepted') ? (
                <ChevronDown className="w-4 h-4 text-teal-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-teal-400" />
              )}
              <Check className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wide">
                Accepted ({organizedIssues.accepted.length})
              </span>
            </button>

            {expandedSections.has('accepted') && (
              <div className="px-4 py-3 space-y-1">
                {organizedIssues.accepted.map(issue => {
                  const type = getCategoryType(issue.category);
                  const config = typeConfig[type];
                  const severity = issue.severity === 'critical' || issue.severity === 'major' ? 'major' : 'minor';
                  const isRewritten = rewrittenParagraphs.has(issue.anchors[0]?.paragraphId || '');
                  return (
                    <div
                      key={issue.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-emerald-500/30 opacity-70 hover:opacity-90 transition-opacity"
                    >
                      {/* Severity icon */}
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          backgroundColor: severity === 'major' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                          border: severity === 'major' ? '2px solid #f97316' : '2px solid #9ca3af',
                          color: severity === 'major' ? '#f97316' : '#9ca3af'
                        }}
                      >
                        {severity === 'major' ? '!' : 'i'}
                      </span>
                      {/* Type badge */}
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: config.bg, color: config.color }}
                      >
                        {config.letter}
                      </span>
                      {/* Status label - bright for rewrite, dull for accepted */}
                      <span className={`text-[9px] font-medium flex-shrink-0 ${isRewritten ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {isRewritten ? 'REWRITE APPLIED' : 'ACCEPTED'}
                      </span>
                      <span className="text-xs text-gray-400 truncate flex-1">{issue.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUndoIssue(issue.id);
                          // Select, expand, and scroll to the issue after undo
                          setTimeout(() => {
                            onSelectIssue(issue.id);
                            const element = window.document.getElementById(`issue-${issue.id}`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 100);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-teal-400 border border-gray-600 hover:border-teal-400/50 rounded transition-colors flex-shrink-0"
                      >
                        <Undo2 className="w-3 h-3" /> Undo
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dismissed Section - compact one-liner rows */}
        {organizedIssues.dismissed.length > 0 && (
          <div className="border-b border-gray-700/30 py-2">
            <button
              onClick={() => toggleSection('dismissed')}
              className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
            >
              {expandedSections.has('dismissed') ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
              <X className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Dismissed ({organizedIssues.dismissed.length})
              </span>
            </button>

            {expandedSections.has('dismissed') && (
              <div className="px-4 py-3 space-y-1">
                {organizedIssues.dismissed.map(issue => {
                  const type = getCategoryType(issue.category);
                  const config = typeConfig[type];
                  const severity = issue.severity === 'critical' || issue.severity === 'major' ? 'major' : 'minor';
                  return (
                    <div
                      key={issue.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-gray-700/50 opacity-40 hover:opacity-60 transition-opacity"
                    >
                      {/* Severity icon */}
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          backgroundColor: severity === 'major' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                          border: severity === 'major' ? '2px solid #f97316' : '2px solid #9ca3af',
                          color: severity === 'major' ? '#f97316' : '#9ca3af'
                        }}
                      >
                        {severity === 'major' ? '!' : 'i'}
                      </span>
                      {/* Type badge */}
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: config.bg, color: config.color }}
                      >
                        {config.letter}
                      </span>
                      {/* Status label */}
                      <span className="text-[9px] font-medium text-gray-500 flex-shrink-0">
                        DISMISSED
                      </span>
                      <span className="text-xs text-gray-500 truncate flex-1">{issue.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUndoIssue(issue.id);
                          // Select, expand, and scroll to the issue after undo
                          setTimeout(() => {
                            onSelectIssue(issue.id);
                            const element = window.document.getElementById(`issue-${issue.id}`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 100);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 border border-gray-600 hover:border-gray-500 rounded transition-colors flex-shrink-0"
                      >
                        <Undo2 className="w-3 h-3" /> Undo
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* User Edits Section */}
        {userEdits.length > 0 && (
          <div className="border-b border-gray-700/30 py-2">
            <button
              onClick={() => toggleSection('user-edits')}
              className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
            >
              {expandedSections.has('user-edits') ? (
                <ChevronDown className="w-4 h-4 text-yellow-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-yellow-400" />
              )}
              <Pencil className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide">
                User Edits ({userEdits.length})
              </span>
            </button>

            {expandedSections.has('user-edits') && (
              <div className="px-4 py-3 space-y-2">
                {userEdits.map((edit) => {
                  const isExpanded = expandedEditId === edit.paragraphId;
                  return (
                    <div
                      key={edit.paragraphId}
                      className="rounded-lg bg-white/[0.02] border border-gray-700/50"
                    >
                      {/* Collapsed row */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02]"
                        onClick={() => setExpandedEditId(isExpanded ? null : edit.paragraphId)}
                      >
                        <ChevronRight
                          className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        {/* Paragraph ID pill */}
                        <span className="px-2 py-0.5 text-[9px] font-medium text-yellow-400 bg-yellow-400/10 rounded flex-shrink-0">
                          {edit.paragraphId}
                        </span>
                        <span className="text-xs text-gray-400 truncate flex-1">
                          {edit.editedText}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onGotoEdit) {
                              onGotoEdit(edit.paragraphId);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-yellow-400 border border-gray-600 hover:border-yellow-400/50 rounded transition-colors flex-shrink-0"
                        >
                          Go to <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Expanded diff view */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-2 border-t border-gray-700/30">
                          <p className="text-sm leading-relaxed text-gray-400">
                            {(() => {
                              const diff = computeInlineDiff(edit.originalText, edit.editedText);
                              return (
                                <>
                                  <span>{diff.prefix}</span>
                                  {diff.removedPart && (
                                    <span className="text-red-400 bg-red-400/10 px-0.5 line-through">{diff.removedPart}</span>
                                  )}
                                  {diff.addedPart && (
                                    <span className="text-emerald-400 bg-emerald-400/10 px-0.5">{diff.addedPart}</span>
                                  )}
                                  <span>{diff.suffix}</span>
                                </>
                              );
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {issues.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No issues found</p>
          </div>
        )}

        {/* Filtered empty state */}
        {issues.length > 0 && needsAttentionTotal === 0 && organizedIssues.accepted.length === 0 && organizedIssues.dismissed.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No {categoryFilter ? typeConfig[categoryFilter].label.toLowerCase() : ''} issues</p>
          </div>
        )}
      </div>
    </div>
  );
}
