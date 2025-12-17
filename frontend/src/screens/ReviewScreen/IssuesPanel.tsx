import { useState, useMemo } from 'react';
import { Check, X, ChevronDown, ChevronRight, ChevronUp, Undo2, Sparkles, Edit3 } from 'lucide-react';
import type { Finding } from '@/types';

interface IssuesPanelProps {
  issues: Finding[];
  selectedIssueId: string | null;
  acceptedIssueIds: Set<string>;
  dismissedIssueIds: Set<string>;
  rewrittenParagraphs: Map<string, string>;
  filterSeverity: string | null;
  onFilterChange: (severity: string | null) => void;
  onSelectIssue: (issueId: string) => void;
  onAcceptIssue: (issueId: string) => void;
  onAcceptRewrite: (issueId: string) => void;
  onDismissIssue: (issueId: string) => void;
  onUndoIssue: (issueId: string) => void;
}

// Category type mapping
type IssueType = 'critical' | 'argument' | 'writing';

const getCategoryType = (category: string): IssueType => {
  if (category.includes('adversarial') || category.includes('scope')) return 'critical';
  if (category.includes('rigor')) return 'argument';
  return 'writing';
};

// Type configuration
const typeConfig: Record<IssueType, { label: string; color: string; bg: string; letter: string }> = {
  critical: { label: 'Critical', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', letter: 'C' },
  argument: { label: 'Argument', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', letter: 'A' },
  writing: { label: 'Writing', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', letter: 'W' }
};

// Severity configuration
const severityConfig = {
  major: { label: 'Major', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' },
  minor: { label: 'Minor', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' }
};

export function IssuesPanel({
  issues,
  selectedIssueId,
  acceptedIssueIds,
  dismissedIssueIds,
  rewrittenParagraphs,
  onSelectIssue,
  onAcceptIssue,
  onAcceptRewrite,
  onDismissIssue,
  onUndoIssue
}: IssuesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['needs-attention', 'major']));
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<IssueType | null>(null);

  // Organize issues into groups
  const organizedIssues = useMemo(() => {
    const needsAttention = {
      major: [] as Finding[],
      minor: [] as Finding[]
    };
    const accepted: Finding[] = [];
    const userEdits: Finding[] = [];
    const dismissed: Finding[] = [];

    issues.forEach(issue => {
      // Apply category filter
      if (categoryFilter && getCategoryType(issue.category) !== categoryFilter) {
        return;
      }

      if (acceptedIssueIds.has(issue.id)) {
        if (rewrittenParagraphs.has(issue.anchors[0]?.paragraph_id || '')) {
          userEdits.push(issue);
        } else {
          accepted.push(issue);
        }
      } else if (dismissedIssueIds.has(issue.id)) {
        dismissed.push(issue);
      } else {
        const severity = issue.severity === 'critical' || issue.severity === 'major' ? 'major' : 'minor';
        needsAttention[severity].push(issue);
      }
    });

    return { needsAttention, accepted, userEdits, dismissed };
  }, [issues, acceptedIssueIds, dismissedIssueIds, rewrittenParagraphs, categoryFilter]);

  // Count issues by category (unfiltered, for filter badges)
  const categoryCounts = useMemo(() => {
    const counts = { critical: 0, argument: 0, writing: 0 };
    issues.forEach(issue => {
      if (!acceptedIssueIds.has(issue.id) && !dismissedIssueIds.has(issue.id)) {
        const type = getCategoryType(issue.category);
        counts[type]++;
      }
    });
    return counts;
  }, [issues, acceptedIssueIds, dismissedIssueIds]);

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
    onAcceptRewrite(issueId);
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
    const sevConfig = severityConfig[severity];

    return (
      <div
        key={issue.id}
        id={`issue-${issue.id}`}
        className={`
          group relative mb-3 rounded-lg transition-all duration-200 cursor-pointer
          ${isResolved ? 'opacity-50' : ''}
        `}
        style={{
          backgroundColor: isSelected ? 'rgba(232, 152, 85, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          border: isSelected ? '2px solid rgba(232, 152, 85, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
          borderLeft: isSelected ? '2px solid rgba(232, 152, 85, 0.5)' : `2px solid ${config.color}`
        }}
        onClick={() => onSelectIssue(issue.id)}
      >
        <div className="p-4">
          {/* Header with badges */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Severity badge */}
              <span
                className="px-2 py-0.5 text-[11px] font-semibold rounded"
                style={{ backgroundColor: sevConfig.bg, color: sevConfig.color }}
              >
                {sevConfig.label}
              </span>
              {/* Type badge */}
              <span
                className="px-2 py-0.5 text-[11px] font-semibold rounded"
                style={{ backgroundColor: config.bg, color: config.color }}
              >
                {config.label}
              </span>
              {isResolved && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-600/50 text-gray-300">
                  {rewrittenParagraphs.has(issue.anchors[0]?.paragraph_id || '') ? 'EDITED' : 'RESOLVED'}
                </span>
              )}
            </div>

            {/* Quick actions or Undo */}
            {!isResolved ? (
              <div className={`
                flex items-center gap-1 transition-opacity
                ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
              `}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (issue.proposedEdit) {
                      onAcceptRewrite(issue.id);
                    } else {
                      onAcceptIssue(issue.id);
                    }
                  }}
                  className="p-1.5 rounded-md bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
                  title="Accept"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismissIssue(issue.id);
                  }}
                  className="p-1.5 rounded-md hover:bg-gray-600/50 text-gray-400 hover:text-gray-300 transition-colors"
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
          <h4 className="text-[15px] font-semibold text-white leading-snug mb-2">
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
            <div className="space-y-4">
              {/* Quoted text - teal styling like PeerPreview */}
              {issue.anchors[0]?.quoted_text && (
                <div
                  className="p-3 rounded-md italic text-sm leading-relaxed"
                  style={{
                    backgroundColor: 'rgba(45, 212, 191, 0.08)',
                    color: '#5eead4',
                    borderLeft: '3px solid #2dd4bf'
                  }}
                >
                  "{issue.anchors[0].quoted_text}"
                </div>
              )}

              {/* CRITIQUE section */}
              <div>
                <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Critique
                </h5>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {issue.description}
                </p>
              </div>

              {/* STRATEGIC SOLUTION section */}
              {issue.proposedEdit?.newText && !isEditing && (
                <div
                  className="p-3 rounded-md"
                  style={{ backgroundColor: 'rgba(52, 211, 153, 0.08)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      Strategic Solution
                    </h5>
                    {!isResolved && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRewrite(issue);
                        }}
                        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-emerald-400 transition-colors"
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

              {/* Edit mode */}
              {isEditing && (
                <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Edit3 className="w-3 h-3 text-emerald-400" />
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Edit Solution</span>
                  </div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full p-3 text-sm text-gray-100 bg-gray-800/50 border border-gray-600 rounded-md resize-none focus:outline-none focus:border-emerald-400/50"
                    rows={4}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(issue.id);
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    >
                      Save & Accept
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
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (issue.proposedEdit?.newText) {
                        onAcceptRewrite(issue.id);
                      } else {
                        onAcceptIssue(issue.id);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors border border-teal-500/30"
                  >
                    Accept Issue
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissIssue(issue.id);
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
                  >
                    Dismiss
                  </button>
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
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-gray-400 hover:text-gray-200'}
            `}
          >
            All <span className="text-white">({totalUnresolved})</span>
          </button>
          {Object.entries(typeConfig).map(([type, config]) => {
            const count = categoryCounts[type as IssueType];
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
      <div className="flex-1 overflow-y-auto">
        {/* Needs Attention Section */}
        {needsAttentionTotal > 0 && (
          <div className="border-b border-gray-700/30">
            {/* Section header */}
            <div className="px-4 py-2 bg-gray-800/30">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Needs Attention — Accept to include in export
              </span>
            </div>

            {/* Major subsection */}
            {organizedIssues.needsAttention.major.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('major')}
                  className="w-full px-4 py-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
                >
                  {expandedSections.has('major') ? (
                    <ChevronDown className="w-4 h-4 text-orange-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-orange-400" />
                  )}
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">
                    Major Issues ({organizedIssues.needsAttention.major.length})
                  </span>
                </button>
                {expandedSections.has('major') && (
                  <div className="px-4 pb-2">
                    {organizedIssues.needsAttention.major.map(issue => renderIssueCard(issue))}
                  </div>
                )}
              </div>
            )}

            {/* Minor subsection */}
            {organizedIssues.needsAttention.minor.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('minor')}
                  className="w-full px-4 py-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
                >
                  {expandedSections.has('minor') ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Minor Issues ({organizedIssues.needsAttention.minor.length})
                  </span>
                </button>
                {expandedSections.has('minor') && (
                  <div className="px-4 pb-2">
                    {organizedIssues.needsAttention.minor.map(issue => renderIssueCard(issue))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accepted Section */}
        {organizedIssues.accepted.length > 0 && (
          <div className="border-b border-gray-700/30">
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
              <div className="px-4 pb-2">
                {organizedIssues.accepted.map(issue => renderIssueCard(issue, true))}
              </div>
            )}
          </div>
        )}

        {/* User Edits Section */}
        {organizedIssues.userEdits.length > 0 && (
          <div className="border-b border-gray-700/30">
            <button
              onClick={() => toggleSection('userEdits')}
              className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
            >
              {expandedSections.has('userEdits') ? (
                <ChevronDown className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              )}
              <Edit3 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                User Edits ({organizedIssues.userEdits.length})
              </span>
            </button>

            {expandedSections.has('userEdits') && (
              <div className="px-4 pb-2">
                {organizedIssues.userEdits.map(issue => renderIssueCard(issue, true))}
              </div>
            )}
          </div>
        )}

        {/* Dismissed Section */}
        {organizedIssues.dismissed.length > 0 && (
          <div className="border-b border-gray-700/30">
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
              <div className="px-4 pb-2">
                {organizedIssues.dismissed.map(issue => renderIssueCard(issue, true))}
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
        {issues.length > 0 && needsAttentionTotal === 0 && organizedIssues.accepted.length === 0 && organizedIssues.userEdits.length === 0 && organizedIssues.dismissed.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No {categoryFilter ? typeConfig[categoryFilter].label.toLowerCase() : ''} issues</p>
          </div>
        )}
      </div>
    </div>
  );
}
