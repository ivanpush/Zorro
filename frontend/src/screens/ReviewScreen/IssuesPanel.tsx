import { useState, useMemo } from 'react';
import { Check, X, ChevronDown, ChevronUp, Undo2, Sparkles, Edit3 } from 'lucide-react';
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
const typeConfig: Record<IssueType, { label: string; color: string; bg: string }> = {
  critical: { label: 'Counterpoint', color: '#e879f9', bg: 'rgba(232, 121, 249, 0.1)' },
  argument: { label: 'Argument', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' },
  writing: { label: 'Writing', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)' }
};

// Severity configuration
const severityConfig = {
  major: { label: 'Major', color: '#f97316' },
  minor: { label: 'Minor', color: '#94a3b8' }
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['major']));
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  // Organize issues into groups
  const organizedIssues = useMemo(() => {
    const major: Record<IssueType, Finding[]> = { critical: [], argument: [], writing: [] };
    const minor: Record<IssueType, Finding[]> = { critical: [], argument: [], writing: [] };
    const accepted: Finding[] = [];
    const dismissed: Finding[] = [];
    const userEdits: Finding[] = [];

    issues.forEach(issue => {
      if (acceptedIssueIds.has(issue.id)) {
        if (rewrittenParagraphs.has(issue.anchors[0]?.paragraph_id || '')) {
          userEdits.push(issue);
        } else {
          accepted.push(issue);
        }
      } else if (dismissedIssueIds.has(issue.id)) {
        dismissed.push(issue);
      } else {
        const type = getCategoryType(issue.category);
        const severity = issue.severity === 'critical' || issue.severity === 'major' ? 'major' : 'minor';
        if (severity === 'major') {
          major[type].push(issue);
        } else {
          minor[type].push(issue);
        }
      }
    });

    return { major, minor, accepted, dismissed, userEdits };
  }, [issues, acceptedIssueIds, dismissedIssueIds, rewrittenParagraphs]);

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

  const getTotalCount = (group: Record<IssueType, Finding[]>) => {
    return group.critical.length + group.argument.length + group.writing.length;
  };

  const handleEditRewrite = (issue: Finding) => {
    setEditingIssueId(issue.id);
    setEditText(issue.proposedEdit?.newText || '');
  };

  const handleSaveEdit = (issueId: string) => {
    // For now, just accept with the original - full edit support would need state management
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

    return (
      <div
        key={issue.id}
        id={`issue-${issue.id}`}
        className={`
          group relative mb-2 rounded-lg transition-all duration-200 cursor-pointer
          ${isResolved ? 'opacity-60' : ''}
        `}
        style={{
          backgroundColor: isSelected ? config.bg : 'rgba(255, 255, 255, 0.02)',
          border: isSelected ? `1px solid ${config.color}40` : '1px solid transparent'
        }}
        onClick={() => onSelectIssue(issue.id)}
      >
        {/* Type indicator line */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ backgroundColor: config.color }}
        />

        <div className="pl-4 pr-3 py-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Type badge */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
                {isResolved && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                    {rewrittenParagraphs.has(issue.anchors[0]?.paragraph_id || '') ? 'EDITED' : 'RESOLVED'}
                  </span>
                )}
              </div>

              {/* Title */}
              <h4 className="text-sm font-medium text-white leading-snug">
                {issue.title}
              </h4>
            </div>

            {/* Quick actions */}
            {!isResolved && (
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
                  className="p-1.5 rounded-md hover:bg-green-500/20 text-gray-500 hover:text-green-400 transition-colors"
                  title="Accept"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismissIssue(issue.id);
                  }}
                  className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Undo for resolved */}
            {isResolved && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUndoIssue(issue.id);
                }}
                className="p-1.5 rounded-md hover:bg-gray-500/20 text-gray-600 hover:text-gray-400 transition-colors"
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Preview or expanded */}
          {!isExpanded ? (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
              {issue.description}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {/* Quoted text */}
              {issue.anchors[0]?.quoted_text && (
                <div className="pl-3 border-l-2 border-gray-700">
                  <p className="text-[11px] text-gray-500 italic leading-relaxed">
                    "{issue.anchors[0].quoted_text}"
                  </p>
                </div>
              )}

              {/* Description */}
              <p className="text-xs text-gray-400 leading-relaxed">
                {issue.description}
              </p>

              {/* Suggested rewrite */}
              {issue.proposedEdit?.newText && !isEditing && (
                <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-medium text-amber-500">Suggested Rewrite</span>
                    </div>
                    {!isResolved && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRewrite(issue);
                        }}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-amber-500 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {issue.proposedEdit.newText}
                  </p>
                </div>
              )}

              {/* Edit mode */}
              {isEditing && (
                <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Edit3 className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-medium text-amber-500">Edit Rewrite</span>
                  </div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full p-2 text-xs text-gray-200 bg-gray-900/50 border border-gray-700 rounded resize-none focus:outline-none focus:border-amber-500/50"
                    rows={4}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(issue.id);
                      }}
                      className="px-3 py-1 text-[10px] font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                    >
                      Save & Accept
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIssueId(null);
                      }}
                      className="px-3 py-1 text-[10px] font-medium rounded text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isResolved && !isEditing && (
                <div className="flex items-center gap-2 pt-2">
                  {issue.proposedEdit?.newText && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptRewrite(issue.id);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                      Accept Rewrite
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcceptIssue(issue.id);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissIssue(issue.id);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Expand toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedIssueId(isExpanded ? null : issue.id);
            }}
            className="mt-2 text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
          >
            {isExpanded ? (
              <>Less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>More <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderTypeGroup = (type: IssueType, issues: Finding[]) => {
    if (issues.length === 0) return null;
    const config = typeConfig[type];

    return (
      <div key={type} className="mb-3">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
          <span className="text-[11px] font-medium" style={{ color: config.color }}>
            {config.label}
          </span>
          <span className="text-[10px] text-gray-600">({issues.length})</span>
        </div>
        <div className="mt-1">
          {issues.map(issue => renderIssueCard(issue))}
        </div>
      </div>
    );
  };

  const renderSeveritySection = (
    severity: 'major' | 'minor',
    group: Record<IssueType, Finding[]>
  ) => {
    const total = getTotalCount(group);
    if (total === 0) return null;
    const config = severityConfig[severity];
    const isExpanded = expandedSections.has(severity);

    return (
      <div className="border-b border-gray-800/50">
        <button
          onClick={() => toggleSection(severity)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: config.color }}>
              {config.label}
            </span>
            <span className="text-xs text-gray-600">({total})</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3">
            {renderTypeGroup('critical', group.critical)}
            {renderTypeGroup('argument', group.argument)}
            {renderTypeGroup('writing', group.writing)}
          </div>
        )}
      </div>
    );
  };

  const renderResolvedSection = (
    label: string,
    issues: Finding[],
    sectionKey: string,
    icon?: React.ReactNode
  ) => {
    if (issues.length === 0) return null;
    const isExpanded = expandedSections.has(sectionKey);

    return (
      <div className="border-b border-gray-800/50">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-gray-500">{label}</span>
            <span className="text-xs text-gray-600">({issues.length})</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3">
            {issues.map(issue => renderIssueCard(issue, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Issues</h2>
          <span className="text-xs text-gray-600">
            {issues.length - acceptedIssueIds.size - dismissedIssueIds.size} remaining
          </span>
        </div>
        {/* Type legend */}
        <div className="flex items-center gap-4 mt-2">
          {Object.entries(typeConfig).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
              <span className="text-[10px] text-gray-500">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-y-auto">
        {renderSeveritySection('major', organizedIssues.major)}
        {renderSeveritySection('minor', organizedIssues.minor)}

        {/* Resolved sections */}
        {renderResolvedSection(
          'User Edits',
          organizedIssues.userEdits,
          'userEdits',
          <Edit3 className="w-3.5 h-3.5 text-amber-500" />
        )}
        {renderResolvedSection(
          'Accepted',
          organizedIssues.accepted,
          'accepted',
          <Check className="w-3.5 h-3.5 text-green-500" />
        )}
        {renderResolvedSection(
          'Dismissed',
          organizedIssues.dismissed,
          'dismissed',
          <X className="w-3.5 h-3.5 text-gray-500" />
        )}

        {/* Empty state */}
        {issues.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-sm">No issues found</p>
          </div>
        )}
      </div>
    </div>
  );
}
