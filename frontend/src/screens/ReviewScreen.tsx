import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Filter, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentViewer } from '@/components/domain/DocumentViewer';
import { FindingCard } from '@/components/domain/FindingCard';
import { useAppStore } from '@/store';
import type {
  Finding,
  Decision,
  Severity,
  FindingCategory,
  FilterState,
} from '@/types';
import { SEVERITY_LEVELS, CATEGORY_GROUPS } from '@/types';

export function ReviewScreen() {
  const navigate = useNavigate();
  const {
    currentDocument,
    findings,
    decisions,
    addDecision,
    selectedFindingId,
    setSelectedFindingId,
  } = useAppStore();

  const [filters, setFilters] = useState<FilterState>({
    severity: 'all',
    category: 'all',
    status: 'all',
  });

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeUnresolved: true,
    author: 'ZORRO Review',
  });

  useEffect(() => {
    if (!currentDocument || findings.length === 0) {
      navigate('/upload');
    }
  }, [currentDocument, findings, navigate]);

  // Filter findings
  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      // Filter by severity
      if (filters.severity !== 'all' && finding.severity !== filters.severity) {
        return false;
      }

      // Filter by category
      if (filters.category !== 'all' && finding.category !== filters.category) {
        return false;
      }

      // Filter by status
      const decision = decisions.get(finding.id);
      if (filters.status !== 'all') {
        if (filters.status === 'pending' && decision) return false;
        if (
          filters.status === 'accepted' &&
          (!decision ||
            (decision.action !== 'accept' &&
              decision.action !== 'accept_edit'))
        )
          return false;
        if (filters.status === 'dismissed' && decision?.action !== 'dismiss')
          return false;
      }

      return true;
    });
  }, [findings, decisions, filters]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = findings.length;
    let pending = 0;
    let accepted = 0;
    let dismissed = 0;

    findings.forEach((finding) => {
      const decision = decisions.get(finding.id);
      if (!decision) {
        pending++;
      } else if (
        decision.action === 'accept' ||
        decision.action === 'accept_edit'
      ) {
        accepted++;
      } else if (decision.action === 'dismiss') {
        dismissed++;
      }
    });

    return { total, pending, accepted, dismissed };
  }, [findings, decisions]);

  const handleAccept = useCallback(
    (finding: Finding) => {
      const decision: Decision = {
        id: `decision_${Date.now()}`,
        findingId: finding.id,
        action: 'accept',
        timestamp: new Date().toISOString(),
      };
      addDecision(decision);
    },
    [addDecision]
  );

  const handleDismiss = useCallback(
    (finding: Finding) => {
      const decision: Decision = {
        id: `decision_${Date.now()}`,
        findingId: finding.id,
        action: 'dismiss',
        timestamp: new Date().toISOString(),
      };
      addDecision(decision);
    },
    [addDecision]
  );

  const handleAcceptEdit = useCallback(
    (finding: Finding, finalText: string) => {
      const decision: Decision = {
        id: `decision_${Date.now()}`,
        findingId: finding.id,
        action: 'accept_edit',
        finalText,
        timestamp: new Date().toISOString(),
      };
      addDecision(decision);
    },
    [addDecision]
  );

  const handleExport = () => {
    // Check for critical pending findings
    const hasCriticalPending = findings.some(
      (f) => f.severity === 'critical' && !decisions.has(f.id)
    );

    if (hasCriticalPending) {
      if (
        !confirm(
          'You have unreviewed critical findings. Are you sure you want to export?'
        )
      ) {
        return;
      }
    }

    // In demo mode, just download a mock file
    const exportData = {
      document: currentDocument,
      decisions: Array.from(decisions.values()),
      exportOptions,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDocument?.title}_ZORRO_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setShowExportDialog(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if no input is focused
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const currentIndex = filteredFindings.findIndex(
        (f) => f.id === selectedFindingId
      );

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          if (currentIndex < filteredFindings.length - 1) {
            setSelectedFindingId(filteredFindings[currentIndex + 1].id);
          }
          break;
        case 'k':
        case 'ArrowUp':
          if (currentIndex > 0) {
            setSelectedFindingId(filteredFindings[currentIndex - 1].id);
          }
          break;
        case 'a':
          if (selectedFindingId) {
            const finding = findings.find((f) => f.id === selectedFindingId);
            if (finding && !decisions.has(finding.id)) {
              handleAccept(finding);
            }
          }
          break;
        case 'd':
          if (selectedFindingId) {
            const finding = findings.find((f) => f.id === selectedFindingId);
            if (finding && !decisions.has(finding.id)) {
              handleDismiss(finding);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    filteredFindings,
    selectedFindingId,
    setSelectedFindingId,
    findings,
    decisions,
    handleAccept,
    handleDismiss,
  ]);

  if (!currentDocument) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-180px)] flex gap-6">
      {/* Left: Document Viewer (70%) */}
      <div className="flex-1" style={{ flex: '0 0 70%' }}>
        <DocumentViewer
          document={currentDocument}
          findings={findings}
          selectedFindingId={selectedFindingId}
          onParagraphClick={(paragraphId) => {
            // Filter to show only findings for this paragraph
            const paragraphFinding = findings.find((f) =>
              f.anchors.some((a) => a.paragraphId === paragraphId)
            );
            if (paragraphFinding) {
              setSelectedFindingId(paragraphFinding.id);
            }
          }}
        />
      </div>

      {/* Right: Findings Panel (30%) */}
      <div className="flex-1" style={{ flex: '0 0 30%' }}>
        <div className="bg-white rounded-lg border h-full flex flex-col">
          {/* Stats Bar */}
          <div className="p-4 border-b">
            <div className="text-sm font-medium text-center">
              {stats.total} findings • {stats.accepted} accepted •{' '}
              {stats.dismissed} dismissed • {stats.pending} pending
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 border-b space-y-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Severity Filter */}
              <select
                className="text-xs px-2 py-1 border rounded"
                value={filters.severity}
                onChange={(e) =>
                  setFilters({ ...filters, severity: e.target.value as any })
                }
              >
                <option value="all">All Severities</option>
                {SEVERITY_LEVELS.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                className="text-xs px-2 py-1 border rounded"
                value={filters.category}
                onChange={(e) =>
                  setFilters({ ...filters, category: e.target.value as any })
                }
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_GROUPS).map(([group, categories]) => (
                  <optgroup key={group} label={group}>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="text-xs px-2 py-1 border rounded"
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value as any })
                }
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          {/* Findings List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredFindings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No findings match your filters</p>
              </div>
            ) : (
              filteredFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  decision={decisions.get(finding.id) || null}
                  isSelected={selectedFindingId === finding.id}
                  onSelect={() => setSelectedFindingId(finding.id)}
                  onAccept={() => handleAccept(finding)}
                  onDismiss={() => handleDismiss(finding)}
                  onAcceptEdit={(text) => handleAcceptEdit(finding, text)}
                />
              ))
            )}
          </div>

          {/* Export Button */}
          <div className="p-4 border-t">
            {stats.pending > 0 && (
              <div className="flex items-start gap-2 mb-3 p-2 bg-yellow-50 rounded text-yellow-800">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">
                  {stats.pending} findings still pending review
                </p>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Document
            </Button>
          </div>
        </div>
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Export Options</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Format</label>
                <div className="mt-1 space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="format"
                      value="docx"
                      defaultChecked
                    />
                    <span>DOCX (with track changes)</span>
                  </label>
                  <label className="flex items-center gap-2 opacity-50">
                    <input
                      type="radio"
                      name="format"
                      value="pdf"
                      disabled
                    />
                    <span>PDF (coming soon)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeUnresolved}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        includeUnresolved: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm">
                    Include unresolved findings as comments
                  </span>
                </label>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Track Changes Author
                </label>
                <input
                  type="text"
                  className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                  value={exportOptions.author}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      author: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowExportDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleExport}>Download</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}