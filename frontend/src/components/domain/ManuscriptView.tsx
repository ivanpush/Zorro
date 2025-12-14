import { useMemo } from 'react';
import type { DocObj, Finding } from '@/types';

interface ManuscriptViewProps {
  document: DocObj;
  selectedIssueId: string | null;
  findings: Finding[];
  rewrittenParagraphs: Map<string, string>;
  onParagraphClick: (paragraphId: string) => void;
}

export function ManuscriptView({
  document,
  selectedIssueId,
  findings,
  rewrittenParagraphs,
  onParagraphClick
}: ManuscriptViewProps) {
  // Map paragraphs to their issues
  const paragraphIssuesMap = useMemo(() => {
    const map = new Map<string, Finding[]>();

    findings.forEach(finding => {
      finding.anchors.forEach(anchor => {
        if (anchor.paragraph_id) {
          const existing = map.get(anchor.paragraph_id) || [];
          existing.push(finding);
          map.set(anchor.paragraph_id, existing);
        }
      });
    });

    return map;
  }, [findings]);

  // Get selected paragraph ID
  const selectedParagraphId = useMemo(() => {
    if (!selectedIssueId) return null;

    const issue = findings.find(f => f.id === selectedIssueId);
    if (issue && issue.anchors.length > 0) {
      return issue.anchors[0].paragraph_id;
    }

    return null;
  }, [selectedIssueId, findings]);

  // Render paragraph with potential highlighting
  const renderParagraph = (paragraph: any) => {
    const hasIssues = paragraphIssuesMap.has(paragraph.paragraph_id);
    const isSelected = paragraph.paragraph_id === selectedParagraphId;
    const issues = paragraphIssuesMap.get(paragraph.paragraph_id) || [];
    const isRewritten = rewrittenParagraphs.has(paragraph.paragraph_id);
    const rewrittenText = rewrittenParagraphs.get(paragraph.paragraph_id);

    // Get the selected issue's sentence for highlighting
    const selectedIssue = selectedIssueId ? findings.find(f => f.id === selectedIssueId) : null;
    const highlightedSentence = selectedIssue?.anchors[0]?.quoted_text;

    // Get the selected issue's severity for coloring
    const getHighlightColor = () => {
      if (!selectedIssue) return 'rgba(232, 152, 85, 0.3)'; // default coral
      switch (selectedIssue.severity) {
        case 'critical': return 'rgba(239, 68, 68, 0.3)'; // red
        case 'major': return 'rgba(249, 115, 22, 0.3)'; // orange
        case 'minor': return 'rgba(234, 179, 8, 0.3)'; // yellow
        case 'suggestion': return 'rgba(59, 130, 246, 0.3)'; // blue
        default: return 'rgba(232, 152, 85, 0.3)';
      }
    };

    // Function to render text with sentence highlighting
    const renderTextWithHighlight = (text: string) => {
      if (!highlightedSentence || !isSelected) {
        return text;
      }

      // Find and highlight the sentence
      const index = text.indexOf(highlightedSentence);
      if (index === -1) return text;

      return (
        <>
          {text.substring(0, index)}
          <span className="text-foreground font-medium rounded px-0.5"
                style={{ backgroundColor: getHighlightColor() }}>
            {highlightedSentence}
          </span>
          {text.substring(index + highlightedSentence.length)}
        </>
      );
    };

    // Get border color based on selected issue's severity
    const getBorderColor = () => {
      if (!selectedIssue) return '#E89855'; // default coral
      switch (selectedIssue.severity) {
        case 'critical': return '#ef4444'; // red-500
        case 'major': return '#f97316'; // orange-500
        case 'minor': return '#eab308'; // yellow-500
        case 'suggestion': return '#3b82f6'; // blue-500
        default: return '#E89855';
      }
    };

    return (
      <div
        key={paragraph.paragraph_id}
        id={paragraph.paragraph_id}
        className={`
          p-3 mb-2 transition-all rounded-lg bg-gray-800/35 hover:bg-gray-800/50
          ${isSelected ? 'border-l-4 bg-gray-800/50' : ''}
          ${hasIssues ? 'cursor-pointer' : ''}
        `}
        style={isSelected ? { borderLeftColor: getBorderColor() } : {}}
        onClick={() => {
          if (hasIssues) {
            onParagraphClick(paragraph.paragraph_id);
          }
        }}
      >
        <div className="flex items-start gap-3">
          <div className="text-xs text-muted-foreground/60 mt-1 select-none">
            {typeof paragraph.paragraph_index === 'number' ? paragraph.paragraph_index + 1 : ''}
          </div>
          <div className="flex-1">
            {isRewritten && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mb-2">
                REWRITTEN
              </span>
            )}
            <p className="text-base leading-relaxed text-foreground/80">
              {isRewritten
                ? rewrittenText
                : renderTextWithHighlight(paragraph.text)}
            </p>
            {hasIssues && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {issues.map(issue => (
                  <span
                    key={issue.id}
                    className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${issue.severity === 'critical' ? 'bg-red-100 text-red-800' : ''}
                      ${issue.severity === 'major' ? 'bg-orange-100 text-orange-800' : ''}
                      ${issue.severity === 'minor' ? 'bg-yellow-100 text-yellow-800' : ''}
                    `}
                  >
                    {issue.severity}
                  </span>
                ))}
                <span className="text-xs text-muted-foreground">
                  {issues.length} issue{issues.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Document Title */}
      <h1 className="text-xl font-bold mb-6">{document.title}</h1>

      {/* Render sections and paragraphs */}
      {document.sections.length > 0 ? (
        document.sections.map(section => (
          <div key={section.section_id} className="mb-8">
            {/* Section title */}
            {section.section_title && (
              <h2 className={`
                font-semibold mb-4
                ${section.level === 1 ? 'text-2xl' : ''}
                ${section.level === 2 ? 'text-xl' : ''}
                ${section.level >= 3 ? 'text-lg' : ''}
              `}>
                {section.section_title}
              </h2>
            )}

            {/* Section paragraphs */}
            {section.paragraph_ids && section.paragraph_ids.map(paragraphId => {
              const paragraph = document.paragraphs.find(p => p.paragraph_id === paragraphId);
              return paragraph ? renderParagraph(paragraph) : null;
            })}
          </div>
        ))
      ) : (
        // If no sections, just render all paragraphs
        <div>
          {document.paragraphs.map(paragraph => renderParagraph(paragraph))}
        </div>
      )}

      {/* Empty state */}
      {document.paragraphs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No content available</p>
        </div>
      )}
    </div>
  );
}