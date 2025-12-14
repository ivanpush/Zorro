import { useState, useMemo } from 'react';
import { Check, X, ChevronDown, ChevronRight, RotateCcw, Undo2, AlertCircle, Edit2 } from 'lucide-react';
import type { Finding } from '@/types';

interface IssuesPanelProps {
  issues: Finding[];
  selectedIssueId: string | null;
  acceptedIssueIds: Set<string>;
  dismissedIssueIds: Set<string>;
  rewrittenParagraphs: Map<string, string>;
  onSelectIssue: (issueId: string) => void;
  onAcceptIssue: (issueId: string) => void;
  onAcceptRewrite: (issueId: string) => void;
  onDismissIssue: (issueId: string) => void;
}

export function IssuesPanel({
  issues,
  selectedIssueId,
  acceptedIssueIds,
  dismissedIssueIds,
  rewrittenParagraphs,
  onSelectIssue,
  onAcceptIssue,
  onAcceptRewrite,
  onDismissIssue
}: IssuesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['need-attention'])  // Only expand the main section by default
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
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'major':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'minor':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'suggestion':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getCategoryDisplayName = (category: string) => {
    // Map categories to simpler display names
    if (category.includes('clarity')) return 'Clarity';
    if (category.includes('rigor')) return 'Rigor';
    if (category.includes('adversarial') || category.includes('scope')) return 'Counterpoint';
    if (category.includes('domain')) return 'Domain';
    // Default: capitalize first word
    return category.split('_')[0].charAt(0).toUpperCase() + category.split('_')[0].slice(1);
  };

  const renderIssue = (issue: Finding) => {
    const isSelected = issue.id === selectedIssueId;
    const isExpanded = issue.id === expandedIssueId;

    const getBorderColor = () => {
      switch (issue.severity) {
        case 'critical': return '#ef4444'; // red-500
        case 'major': return '#f97316'; // orange-500
        case 'minor': return '#eab308'; // yellow-500
        case 'suggestion': return '#3b82f6'; // blue-500
        default: return '#6b7280'; // gray-500
      }
    };

    return (
      <div
        key={issue.id}
        id={`issue-${issue.id}`}
        className={`
          mb-2 rounded-lg transition-all cursor-pointer border-2 bg-gray-900/20
          ${isSelected
            ? 'bg-gray-900/40'
            : 'hover:bg-gray-900/30'}
        `}
        style={{
          borderColor: isSelected ? getBorderColor() : `${getBorderColor()}40`,
          ...(isSelected && {
            boxShadow: `0 10px 40px ${getBorderColor()}30`
          })
        }}
        onClick={() => onSelectIssue(issue.id)}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIssueId(isExpanded ? null : issue.id);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <div className="flex items-center gap-2">
                <span className={`
                  inline-flex px-2.5 py-1 rounded-md text-xs font-medium border
                  ${getSeverityBadge(issue.severity)}
                `}>
                  {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                </span>
                <span className="text-gray-500">|</span>
                <span className="px-2.5 py-1 rounded-md text-xs font-medium"
                      style={{ backgroundColor: 'rgba(147, 51, 234, 0.2)', color: '#a78bfa' }}>
                  {getCategoryDisplayName(issue.category)}
                </span>
              </div>
            </div>
            {/* Location badge in top right */}
            {issue.anchors.length > 0 && issue.anchors[0].paragraph_id && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }}>
                {issue.anchors[0].paragraph_id}
              </span>
            )}
          </div>

          <h4 className="text-sm font-semibold mb-3 text-white">
            {issue.title}
          </h4>

          {!isExpanded && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
                {issue.description}
              </p>
            </div>
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

              <div>
                <span className="text-xs font-semibold text-muted-foreground">Critique:</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {issue.description}
                </p>
              </div>

              {issue.proposedEdit && (
                <div className="bg-accent/5 p-2 rounded border border-accent/10">
                  <p className="text-xs font-medium text-accent mb-1">Suggested Rewrite:</p>
                  <p className="text-sm text-muted-foreground">
                    {issue.proposedEdit.newText}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                {issue.proposedEdit ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptIssue(issue.id);
                      }}
                      className="px-5 py-2 text-sm font-medium rounded-lg transition-all"
                      style={{
                        backgroundColor: 'rgba(96, 165, 250, 0.8)',
                        color: 'white'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.8)'}
                    >
                      Accept Rewrite
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditModalIssue(issue);
                        setEditedText(issue.proposedEdit.newText);
                      }}
                      className="px-5 py-2 text-sm font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptIssue(issue.id);
                      }}
                      className="px-5 py-2 text-sm font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all"
                    >
                      Accept Issue
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissIssue(issue.id);
                      }}
                      className="px-5 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all"
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
                      className="px-5 py-2 text-sm font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all"
                    >
                      Accept Issue
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissIssue(issue.id);
                      }}
                      className="px-5 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all"
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

    const getBorderColor = () => {
      switch (issue.severity) {
        case 'critical': return '#ef4444'; // red-500
        case 'major': return '#f97316'; // orange-500
        case 'minor': return '#eab308'; // yellow-500
        case 'suggestion': return '#3b82f6'; // blue-500
        default: return '#6b7280'; // gray-500
      }
    };

    return (
      <div
        key={issue.id}
        className={`
          flex items-center gap-2 px-3 py-2 mb-1 rounded-lg transition-all cursor-pointer border-2 bg-gray-900/15
          ${isSelected
            ? 'bg-gray-900/35'
            : 'hover:bg-gray-900/25'}
          ${type === 'dismissed' ? 'opacity-50' : ''}
        `}
        style={{
          borderColor: isSelected ? getBorderColor() : `${getBorderColor()}30`,
          ...(isSelected && {
            boxShadow: `0 8px 30px ${getBorderColor()}20`
          })
        }}
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
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="bg-background px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">All Issues ({issues.length})</h2>
        </div>
      </div>

      {/* Issues sections */}
      <div className="flex-1 overflow-y-auto bg-background">
        {/* Need Attention Section */}
        {categorizedIssues.needAttention.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('need-attention')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors sticky top-0 bg-background z-10 border-b border-border"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-500">⦿</span>
                <span className="font-medium text-white">Need Attention ({activeCount})</span>
              </div>
              <div className="flex items-center gap-3">
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
                        <span className="text-sm font-medium text-red-500">Critical ({categorizedIssues.critical.length})</span>
                      </div>
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
                        <span className="text-sm font-medium text-orange-500">Major ({categorizedIssues.major.length})</span>
                      </div>
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
                        <span className="text-sm font-medium text-yellow-600">Minor ({categorizedIssues.minor.length})</span>
                      </div>
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
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors border-b border-border"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span className="font-medium text-green-500">Accepted ({categorizedIssues.accepted.length})</span>
              </div>
              <div className="flex items-center gap-3">
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
                <span className="font-medium text-gray-500">Dismissed ({categorizedIssues.dismissed.length})</span>
              </div>
              <div className="flex items-center gap-2">
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