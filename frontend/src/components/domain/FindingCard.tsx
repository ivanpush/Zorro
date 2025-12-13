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
import type { Finding, Decision, AgentId, Severity } from '@/types';
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
          'border rounded-lg p-4 transition-all cursor-pointer',
          {
            'border-primary shadow-md': isSelected,
            'border-green-500 bg-green-50/50 opacity-75': isAccepted,
            'border-gray-300 bg-gray-50 opacity-50': isDismissed,
            'hover:border-primary/50': !isSelected && !isAccepted && !isDismissed,
          }
        )}
        onClick={onSelect}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-2 flex-1">
            {/* Severity Badge */}
            <Badge variant={finding.severity as any} className="mt-0.5">
              {finding.severity}
            </Badge>

            {/* Title */}
            <div className="flex-1">
              <h3
                className={cn(
                  'font-medium text-sm',
                  isDismissed && 'line-through'
                )}
              >
                {finding.title}
              </h3>

              {/* Category and Agent */}
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-muted-foreground">
                  {finding.category.replace(/_/g, ' ')}
                </span>
                <div
                  className={cn(
                    'flex items-center gap-1',
                    getAgentColor(finding.agentId)
                  )}
                  title={AGENT_NAMES[finding.agentId]}
                >
                  {getAgentIcon(finding.agentId)}
                  <span className="text-xs">
                    {AGENT_NAMES[finding.agentId]}
                  </span>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  Confidence:
                </span>
                <div className="flex-1 max-w-[100px] h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${finding.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round(finding.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quoted Text */}
        <div className="mt-3 p-2 bg-muted/50 rounded text-xs italic line-clamp-2">
          "{finding.anchors[0].quotedText}"
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
            {/* Description */}
            <div className="text-sm text-muted-foreground">
              {finding.description}
            </div>

            {/* All Anchors */}
            {finding.anchors.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">All referenced text:</p>
                {finding.anchors.map((anchor, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-muted/30 rounded text-xs italic"
                  >
                    "{anchor.quotedText}"
                  </div>
                ))}
              </div>
            )}

            {/* Proposed Edit */}
            {finding.proposedEdit && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Suggested Edit:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1">Original:</p>
                    <div className="p-2 bg-red-50 border border-red-200 rounded">
                      {finding.proposedEdit.anchor.quotedText}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Suggested:</p>
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      {finding.proposedEdit.newText}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  {finding.proposedEdit.rationale}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {!isAccepted && !isDismissed && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t">
            <Button
              size="sm"
              variant="ghost"
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
            >
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Dismiss
            </Button>
            {finding.proposedEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEditModal(true);
                  setEditedText(finding.proposedEdit?.newText || '');
                }}
              >
                <Edit className="w-4 h-4 mr-1" />
                View Suggestion
              </Button>
            )}
          </div>
        )}

        {/* Status Indicators */}
        {isAccepted && (
          <div className="flex items-center gap-2 mt-3 text-green-600">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Accepted</span>
          </div>
        )}
        {isDismissed && (
          <div className="flex items-center gap-2 mt-3 text-gray-500">
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">Dismissed</span>
          </div>
        )}
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
                  {finding.proposedEdit.anchor.quotedText}
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