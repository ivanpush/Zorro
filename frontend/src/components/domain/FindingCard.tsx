import { useState } from 'react';
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Edit,
  User,
  Brain,
  Eye,
  Shield,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Finding, Decision, AgentId } from '@/types';
import { AGENT_NAMES } from '@/types';

interface FindingCardProps {
  finding: Finding;
  decision: Decision | null;
  isSelected: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onDismiss: () => void;
  onAcceptEdit: (finalText: string) => void;
}

export function FindingCard({
  finding,
  decision,
  isSelected,
  onSelect,
  onAccept,
  onDismiss,
  onAcceptEdit,
}: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedText, setEditedText] = useState(
    finding.proposedEdit?.newText || ''
  );

  const getAgentIcon = (agentId: AgentId) => {
    switch (agentId) {
      case 'context_builder':
        return <User className="w-4 h-4" />;
      case 'clarity_inspector':
        return <Eye className="w-4 h-4" />;
      case 'rigor_inspector':
        return <Brain className="w-4 h-4" />;
      case 'adversarial_critic':
        return <Shield className="w-4 h-4" />;
      case 'domain_validator':
        return <Globe className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getAgentColor = (agentId: AgentId) => {
    switch (agentId) {
      case 'context_builder':
        return 'text-purple-600';
      case 'clarity_inspector':
        return 'text-blue-600';
      case 'rigor_inspector':
        return 'text-green-600';
      case 'adversarial_critic':
        return 'text-red-600';
      case 'domain_validator':
        return 'text-indigo-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'major':
        return 'bg-orange-600 text-white';
      case 'minor':
        return 'bg-yellow-600 text-white';
      case 'suggestion':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    // Purple/violet for argument category as shown in screenshot
    if (category.toLowerCase().includes('argument')) {
      return 'bg-purple-600 text-white';
    }
    return 'bg-gray-600 text-white';
  };

  const isAccepted = decision?.action === 'accept' || decision?.action === 'accept_edit';
  const isDismissed = decision?.action === 'dismiss';

  const handleAcceptEdit = () => {
    onAcceptEdit(editedText);
    setShowEditModal(false);
  };

  return (
    <>
      <div
        className={cn(
          'bg-gray-900 border border-gray-700 rounded-lg p-6 transition-all cursor-pointer',
          {
            'border-purple-500 shadow-md': isSelected,
            'border-green-500 bg-green-900/20 opacity-75': isAccepted,
            'border-gray-600 bg-gray-800/50 opacity-50': isDismissed,
            'hover:border-gray-600': !isSelected && !isAccepted && !isDismissed,
          }
        )}
        onClick={onSelect}
      >
        {/* Header with quick actions */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Severity Badge with exclamation */}
            <span className={cn(
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
              getSeverityBadgeColor(finding.severity)
            )}>
              {finding.severity === 'major' && '! '}
              {finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)}
            </span>

            {/* Divider */}
            <span className="text-gray-500">|</span>

            {/* Category Badge */}
            <span className={cn(
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
              getCategoryBadgeColor(finding.category)
            )}>
              {finding.category.replace(/_/g, ' ').charAt(0).toUpperCase() +
               finding.category.replace(/_/g, ' ').slice(1)}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              className="text-green-500 hover:text-green-400 transition-colors"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="text-gray-500 hover:text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Rewrite type if applicable */}
        {finding.proposedEdit && (
          <div className="text-gray-400 text-sm mb-2">
            Paragraph Rewrite
          </div>
        )}

        {/* Title */}
        <h3 className={cn(
          'text-white font-medium text-lg mb-4',
          isDismissed && 'line-through'
        )}>
          {finding.title}
        </h3>

        {/* Location badges */}
        {finding.anchors && finding.anchors.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {finding.anchors.slice(0, 3).map((anchor, idx) => (
              <span key={idx} className="bg-gray-800 text-gray-400 px-3 py-1 rounded-md text-sm">
                {anchor.paragraphId || `location_${idx + 1}`}
              </span>
            ))}
          </div>
        )}

        {/* Quoted Text */}
        {finding.anchors && finding.anchors.length > 0 && finding.anchors[0].quoted_text && (
          <blockquote className="border-l-4 border-gray-700 pl-4 mb-4">
            <p className="text-gray-300 italic">
              "{finding.anchors[0].quoted_text}"
            </p>
          </blockquote>
        )}

        {/* Description */}
        <div className="text-gray-400 mb-6">
          {finding.description}
        </div>

        {/* Expanded Content - Suggested Rewrite */}
        {isExpanded && finding.proposedEdit && (
          <div className="mb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <h4 className="text-teal-400 font-medium text-sm mb-3">SUGGESTED REWRITE</h4>
              <p className="text-gray-300">
                {finding.proposedEdit.newText}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isAccepted && !isDismissed && finding.proposedEdit && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAcceptEdit();
              }}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
            >
              Accept Rewrite
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(true);
                setEditedText(finding.proposedEdit?.newText || '');
              }}
              className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Accept Issue
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action buttons for non-rewrite issues */}
        {!isAccepted && !isDismissed && !finding.proposedEdit && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Accept Issue
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Status Indicators */}
        {isAccepted && (
          <div className="flex items-center gap-2 text-green-500 mb-4">
            <Check className="w-5 h-5" />
            <span className="font-medium">Accepted</span>
          </div>
        )}
        {isDismissed && (
          <div className="flex items-center gap-2 text-gray-500 mb-4">
            <X className="w-5 h-5" />
            <span className="font-medium">Dismissed</span>
          </div>
        )}

        {/* Expand/Collapse at bottom */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-400 transition-colors text-sm"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Edit Modal */}
      {showEditModal && finding.proposedEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit Suggestion</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Original Text:
                </label>
                <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded text-sm">
                  {finding.proposedEdit.anchor.quoted_text}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Suggested Edit:
                </label>
                <textarea
                  className="mt-1 w-full p-3 border rounded-md text-sm resize-none"
                  rows={4}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                />
              </div>

              <div className="text-sm text-muted-foreground italic">
                {finding.proposedEdit.rationale}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAcceptEdit}>Accept Edit</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}