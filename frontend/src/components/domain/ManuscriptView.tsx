import { useMemo } from 'react';
import type { DocObj, Finding } from '@/types';

interface ManuscriptViewProps {
  document: DocObj;
  selectedIssueId: string | null;
  findings: Finding[];
  onParagraphClick: (paragraphId: string) => void;
}

export function ManuscriptView({
  document,
  selectedIssueId,
  findings,
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

    // Get the selected issue's sentence for highlighting
    const selectedIssue = selectedIssueId ? findings.find(f => f.id === selectedIssueId) : null;
    const highlightedSentence = selectedIssue?.anchors[0]?.quoted_text;

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
          <span className="bg-coral-500/30 text-foreground font-medium rounded px-0.5">
            {highlightedSentence}
          </span>
          {text.substring(index + highlightedSentence.length)}
        </>
      );
    };

    return (
      <div
        key={paragraph.paragraph_id}
        id={paragraph.paragraph_id}
        className={`
          p-3 mb-2 transition-all rounded bg-muted/10
          ${isSelected ? 'border-l-4 border-coral-500 bg-muted/25' : ''}
          ${hasIssues ? 'cursor-pointer hover:bg-muted/20' : 'hover:bg-muted/15'}
        `}
        onClick={() => {
          if (hasIssues) {
            onParagraphClick(paragraph.paragraph_id);
          }
        }}
      >
        <div className="flex items-start gap-3">
          <div className="text-xs text-muted-foreground/60 mt-1 select-none">
            {paragraph.paragraph_index + 1}
          </div>
          <div className="flex-1">
            <p className="text-sm leading-relaxed text-foreground/80">
              {renderTextWithHighlight(paragraph.text)}
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
      <h1 className="text-2xl font-bold mb-6">{document.title}</h1>

      {/* Render sections and paragraphs */}
      {document.sections.length > 0 ? (
        document.sections.map(section => (
          <div key={section.section_id} className="mb-8">
            {/* Section title */}
            {section.section_title && (
              <h2 className={`
                font-semibold mb-4
                ${section.level === 1 ? 'text-xl' : ''}
                ${section.level === 2 ? 'text-lg' : ''}
                ${section.level >= 3 ? 'text-base' : ''}
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