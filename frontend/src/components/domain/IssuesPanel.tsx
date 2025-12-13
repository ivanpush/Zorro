import { useState, useMemo } from 'react';
import { Check, X, ChevronDown, ChevronRight, RotateCcw, Undo2, AlertCircle, Edit2 } from 'lucide-react';
import type { Finding } from '@/types';

interface IssuesPanelProps {
  issues: Finding[];
  selectedIssueId: string | null;
  acceptedIssueIds: Set<string>;
  dismissedIssueIds: Set<string>;
  onSelectIssue: (issueId: string) => void;
  onAcceptIssue: (issueId: string) => void;
  onDismissIssue: (issueId: string) => void;
}

export function IssuesPanel({
  issues,
  selectedIssueId,
  acceptedIssueIds,
  dismissedIssueIds,
  onSelectIssue,
  onAcceptIssue,
  onDismissIssue
}: IssuesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['need-attention', 'critical', 'major', 'minor'])
  );
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [editModalIssue, setEditModalIssue] = useState<Finding | null>(null);
  const [editedText, setEditedText] = useState<string>('');

  // Categorize issues
  const categorizedIssues = useMemo(() => {
    const needAttention = issues.filter(i =>
      !acceptedIssueIds.has(i.id) && !dismissedIssueIds.has(i.id)
    );

    const accepted = issues.filter(i => acceptedIssueIds.has(i.id));
    const dismissed = issues.filter(i => dismissedIssueIds.has(i.id));

    // Group need attention by severity
    const bySeverity = {
      critical: needAttention.filter(i => i.severity === 'critical'),
      major: needAttention.filter(i => i.severity === 'major'),
      minor: needAttention.filter(i => i.severity === 'minor' || i.severity === 'suggestion'),
    };

    return {
      needAttention,
      critical: bySeverity.critical,
      major: bySeverity.major,
      minor: bySeverity.minor,
      accepted,
      dismissed
    };
  }, [issues, acceptedIssueIds, dismissedIssueIds]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500';
      case 'major':
        return 'text-orange-500';
      case 'minor':
        return 'text-yellow-600';
      default:
        return 'text-gray-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'major':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'minor':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const renderIssue = (issue: Finding) => {
    const isSelected = issue.id === selectedIssueId;
    const isExpanded = issue.id === expandedIssueId;

    return (
      <div
        key={issue.id}
        id={`issue-${issue.id}`}
        className={`
          mb-2 rounded-lg transition-all cursor-pointer
          ${isSelected ? 'ring-1 ring-coral-500 bg-coral-500/5' : 'hover:bg-muted/5'}
        `}
        onClick={() => onSelectIssue(issue.id)}
      >
        <div className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2">
              <span className={`
                inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border
                ${getSeverityBadge(issue.severity)}
              `}>
                {issue.severity.toUpperCase()}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedIssueId(isExpanded ? null : issue.id);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          </div>

          <h4 className="text-sm font-medium mb-2">
            {issue.title}
          </h4>

          {issue.anchors.length > 0 && issue.anchors[0].quoted_text && !isExpanded && (
            <blockquote className="mt-2 pl-3 border-l-2 border-muted/30">
              <p className="text-xs text-muted-foreground/70 italic leading-relaxed line-clamp-2">
                {issue.anchors[0].quoted_text}
              </p>
            </blockquote>
          )}

          {isExpanded && (
            <div className="mt-3 space-y-3">
              {issue.anchors.length > 0 && issue.anchors[0].quoted_text && (
                <blockquote className="pl-3 border-l-2 border-muted/30">
                  <p className="text-xs text-muted-foreground/70 italic leading-relaxed">
                    {issue.anchors[0].quoted_text}
                  </p>
                </blockquote>
              )}

              <div className="text-sm text-muted-foreground">
                {issue.description}
              </div>

              {issue.proposedEdit && (
                <div className="bg-accent/5 p-2 rounded border border-accent/10">
                  <p className="text-xs font-medium text-accent mb-1">Suggested Rewrite:</p>
                  <p className="text-sm text-muted-foreground">
                    {issue.proposedEdit.newText}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                {issue.proposedEdit ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptIssue(issue.id);
                      }}
                      className="px-3 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                    >
                      Accept Rewrite
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditModalIssue(issue);
                        setEditedText(issue.proposedEdit.newText);
                      }}
                      className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptIssue(issue.id);
                      }}
                      className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      Accept Issue
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissIssue(issue.id);
                      }}
                      className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptIssue(issue.id);
                      }}
                      className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      Accept Issue
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissIssue(issue.id);
                      }}
                      className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCompactIssue = (issue: Finding, type: 'accepted' | 'dismissed') => {
    const isSelected = issue.id === selectedIssueId;

    return (
      <div
        key={issue.id}
        className={`
          flex items-center gap-2 px-3 py-2 mb-1 rounded transition-all cursor-pointer
          ${isSelected ? 'bg-coral-500/5 ring-1 ring-coral-500' : 'hover:bg-muted/5'}
          ${type === 'dismissed' ? 'opacity-50' : ''}
        `}
        onClick={() => onSelectIssue(issue.id)}
      >
        <span className={`
          inline-flex px-2 py-0.5 rounded text-[10px] font-medium
          ${type === 'accepted' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}
        `}>
          {type === 'accepted' ?
            (issue.proposedEdit ? 'REWRITE' : 'ACKNOWLEDGED') :
            'DISMISSED'
          }
        </span>
        <p className="text-sm flex-1 truncate">{issue.title}</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (type === 'accepted') {
              onAcceptIssue(issue.id);
            } else {
              onDismissIssue(issue.id);
            }
            onSelectIssue(issue.id);
            setExpandedSections(prev => new Set([...prev, 'need-attention', issue.severity]));
          }}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {type === 'accepted' ? 'Recall' : 'Undo'}
        </button>
      </div>
    );
  };

  // Count total active issues
  const activeCount = categorizedIssues.needAttention.length;

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-950 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">All Issues</h2>
          <span className="text-sm text-gray-400">
            {issues.length} total
          </span>
        </div>
      </div>

      {/* Issues sections */}
      <div className="flex-1 overflow-y-auto bg-gray-900">
        {/* Need Attention Section */}
        {categorizedIssues.needAttention.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('need-attention')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors sticky top-0 bg-gray-850 z-10 border-b border-gray-800"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-500">⦿</span>
                <span className="font-medium text-white">Need Attention</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {activeCount}
                </span>
                {expandedSections.has('need-attention') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {expandedSections.has('need-attention') && (
              <div className="px-2 py-2">
                {/* Critical subsection */}
                {categorizedIssues.critical.length > 0 && (
                  <div className="mb-2">
                    <button
                      onClick={() => toggleSection('critical')}
                      className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/5 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.has('critical') ? (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium text-red-500">Critical</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {categorizedIssues.critical.length}
                      </span>
                    </button>
                    {expandedSections.has('critical') && (
                      <div className="mt-1 ml-3">
                        {categorizedIssues.critical.map(issue => renderIssue(issue))}
                      </div>
                    )}
                  </div>
                )}

                {/* Major subsection */}
                {categorizedIssues.major.length > 0 && (
                  <div className="mb-2">
                    <button
                      onClick={() => toggleSection('major')}
                      className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/5 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.has('major') ? (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium text-orange-500">Major</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {categorizedIssues.major.length}
                      </span>
                    </button>
                    {expandedSections.has('major') && (
                      <div className="mt-1 ml-3">
                        {categorizedIssues.major.map(issue => renderIssue(issue))}
                      </div>
                    )}
                  </div>
                )}

                {/* Minor subsection */}
                {categorizedIssues.minor.length > 0 && (
                  <div className="mb-2">
                    <button
                      onClick={() => toggleSection('minor')}
                      className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/5 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.has('minor') ? (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium text-yellow-600">Minor</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {categorizedIssues.minor.length}
                      </span>
                    </button>
                    {expandedSections.has('minor') && (
                      <div className="mt-1 ml-3">
                        {categorizedIssues.minor.map(issue => renderIssue(issue))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accepted Section */}
        {categorizedIssues.accepted.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('accepted')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors border-b border-gray-800"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span className="font-medium text-green-500">Accepted</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {categorizedIssues.accepted.length}
                </span>
                {expandedSections.has('accepted') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {expandedSections.has('accepted') && (
              <div className="px-2 py-2">
                {categorizedIssues.accepted.map(issue => renderCompactIssue(issue, 'accepted'))}
              </div>
            )}
          </div>
        )}

        {/* Dismissed Section */}
        {categorizedIssues.dismissed.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('dismissed')}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/5 transition-colors border-b"
            >
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-500">Dismissed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {categorizedIssues.dismissed.length}
                </span>
                {expandedSections.has('dismissed') ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {expandedSections.has('dismissed') && (
              <div className="px-2 py-2">
                {categorizedIssues.dismissed.map(issue => renderCompactIssue(issue, 'dismissed'))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalIssue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModalIssue(null)}>
          <div
            className="bg-background border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Edit Suggested Rewrite</h3>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Original text:</p>
              <blockquote className="pl-3 border-l-2 border-muted/30">
                <p className="text-sm text-muted-foreground/70 italic">
                  {editModalIssue.anchors[0]?.quoted_text}
                </p>
              </blockquote>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Your edited version:</label>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full min-h-[150px] p-3 border rounded bg-background text-sm"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditModalIssue(null)}
                className="px-4 py-2 text-sm bg-muted/50 text-muted-foreground hover:bg-muted/70 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Need to add a new prop for handling edited rewrites
                  onAcceptIssue(editModalIssue.id);
                  setEditModalIssue(null);
                }}
                className="px-4 py-2 text-sm bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded transition-colors"
              >
                Apply Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}