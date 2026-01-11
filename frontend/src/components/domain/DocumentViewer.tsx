import { useMemo, useRef, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocObj, Finding, Severity } from '@/types';

interface DocumentViewerProps {
  document: DocObj;
  findings: Finding[];
  selectedFindingId: string | null;
  onParagraphClick?: (paragraphId: string) => void;
}

export function DocumentViewer({
  document,
  findings,
  selectedFindingId,
  onParagraphClick,
}: DocumentViewerProps) {
  const selectedRef = useRef<HTMLDivElement>(null);
  const [collapsedFigures, setCollapsedFigures] = useState(true);

  // Create a map of paragraph highlights
  const paragraphHighlights = useMemo(() => {
    const highlights = new Map<
      string,
      Array<{
        finding: Finding;
        startChar?: number;
        endChar?: number;
        sentenceId?: string;
      }>
    >();

    findings.forEach((finding) => {
      finding.anchors.forEach((anchor) => {
        const existing = highlights.get(anchor.paragraphId) || [];
        existing.push({
          finding,
          startChar: anchor.startChar,
          endChar: anchor.endChar,
          sentenceId: anchor.sentenceId,
        });
        highlights.set(anchor.paragraphId, existing);
      });
    });

    return highlights;
  }, [findings]);

  // Scroll to selected finding
  useEffect(() => {
    if (selectedFindingId && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedFindingId]);

  // Render highlighted text
  const renderHighlightedText = (
    _paragraphId: string,
    text: string,
    paragraphHighlights?: Array<{
      finding: Finding;
      startChar?: number;
      endChar?: number;
    }>
  ) => {
    if (!paragraphHighlights || paragraphHighlights.length === 0) {
      return <span>{text}</span>;
    }

    // Sort highlights by start position
    const sortedHighlights = [...paragraphHighlights].sort((a, b) => {
      const startA = a.startChar ?? 0;
      const startB = b.startChar ?? 0;
      return startA - startB;
    });

    const segments: React.ReactElement[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, idx) => {
      const startChar = highlight.startChar ?? 0;
      const endChar = highlight.endChar ?? text.length;

      // Add text before highlight
      if (startChar > lastIndex) {
        segments.push(
          <span key={`text-${idx}-before`}>
            {text.substring(lastIndex, startChar)}
          </span>
        );
      }

      // Add highlighted text
      const highlightClasses = getHighlightClass(highlight.finding.severity);
      const isSelected = highlight.finding.id === selectedFindingId;

      segments.push(
        <span
          key={`highlight-${idx}`}
          className={cn(
            highlightClasses,
            'relative cursor-pointer transition-all',
            isSelected && 'ring-2 ring-primary ring-offset-1'
          )}
          ref={isSelected ? selectedRef : undefined}
          title={highlight.finding.title}
        >
          {text.substring(startChar, endChar)}
          {/* Show badge for multiple findings on same text */}
          {paragraphHighlights.filter(
            (h) =>
              h.startChar === startChar && h.endChar === endChar
          ).length > 1 && (
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {
                paragraphHighlights.filter(
                  (h) =>
                    h.startChar === startChar && h.endChar === endChar
                ).length
              }
            </span>
          )}
        </span>
      );

      lastIndex = endChar;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push(
        <span key="text-final">{text.substring(lastIndex)}</span>
      );
    }

    return <>{segments}</>;
  };

  const getHighlightClass = (severity: Severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-200/50 hover:bg-red-200/70';
      case 'major':
        return 'bg-orange-200/50 hover:bg-orange-200/70';
      case 'minor':
        return 'bg-yellow-200/50 hover:bg-yellow-200/70';
      case 'suggestion':
        return 'bg-blue-200/50 hover:bg-blue-200/70';
      default:
        return '';
    }
  };

  // Track rendered paragraph IDs to avoid duplicates
  const renderedParagraphIds = useMemo(() => new Set<string>(), []);

  return (
    <div className="bg-white rounded-lg border p-6 h-full overflow-y-auto">
      {/* Document Title */}
      <h1 className="text-2xl font-bold mb-6">{document.title}</h1>

      {/* Sections and Paragraphs */}
      {document.sections.map((section, sectionIdx) => {
        const sectionParagraphs = document.paragraphs.filter((p) => {
          // Only include if this paragraph belongs to this section AND hasn't been rendered yet
          const belongsToSection = section.paragraph_ids?.includes(p.paragraph_id) || false;
          if (belongsToSection && !renderedParagraphIds.has(p.paragraph_id)) {
            renderedParagraphIds.add(p.paragraph_id);
            return true;
          }
          return false;
        });

        return (
          <div key={section.section_id || `section-${sectionIdx}`} className="mb-6">
            {/* Section Title */}
            {section.section_title && (
              <h2
                className={cn(
                  'font-semibold mb-3',
                  section.level === 1 && 'text-xl',
                  section.level === 2 && 'text-lg',
                  section.level >= 3 && 'text-base'
                )}
              >
                {section.section_title}
              </h2>
            )}

            {/* Section Paragraphs */}
            {sectionParagraphs.map((paragraph, paraIdx) => {
              const highlights = paragraphHighlights.get(paragraph.paragraph_id);
              const hasFindings = highlights && highlights.length > 0;

              return (
                <div
                  key={`${section.section_id}-${paragraph.paragraph_id}-${paraIdx}`}
                  className={cn(
                    'mb-4 flex group',
                    hasFindings && 'cursor-pointer hover:bg-muted/50',
                    'transition-colors rounded-md'
                  )}
                  onClick={() => onParagraphClick?.(paragraph.paragraph_id)}
                >
                  {/* Line Number */}
                  <div className="w-12 flex-shrink-0 text-xs text-muted-foreground mr-4 pt-1">
                    {typeof paragraph.paragraph_index === 'number' ? paragraph.paragraph_index + 1 : ''}
                  </div>

                  {/* Paragraph Text */}
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">
                      {renderHighlightedText(
                        paragraph.paragraph_id,
                        paragraph.text,
                        highlights
                      )}
                    </p>

                    {/* Finding count indicator */}
                    {hasFindings && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {highlights.length} finding
                        {highlights.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Orphaned Paragraphs (not in any section) */}
      {(() => {
        // Only show paragraphs that haven't been rendered yet
        const orphanedParagraphs = document.paragraphs.filter(p =>
          p.paragraph_id && !renderedParagraphIds.has(p.paragraph_id)
        );

        if (orphanedParagraphs.length === 0) return null;

        return (
          <>
            {orphanedParagraphs.map((paragraph, idx) => {
              const highlights = paragraphHighlights.get(paragraph.paragraph_id);
              const hasFindings = highlights && highlights.length > 0;

              return (
                <div
                  key={`orphan-${paragraph.paragraph_id}-${idx}`}
                  className={cn(
                    'mb-4 flex group',
                    hasFindings && 'cursor-pointer hover:bg-muted/50',
                    'transition-colors rounded-md'
                  )}
                  onClick={() => onParagraphClick?.(paragraph.paragraph_id)}
                >
                  {/* Line Number */}
                  <div className="w-12 flex-shrink-0 text-xs text-muted-foreground mr-4 pt-1">
                    {typeof paragraph.paragraph_index === 'number' ? paragraph.paragraph_index + 1 : ''}
                  </div>

                  {/* Paragraph Text */}
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">
                      {renderHighlightedText(
                        paragraph.paragraph_id,
                        paragraph.text || '',
                        highlights
                      )}
                    </p>

                    {/* Finding count indicator */}
                    {hasFindings && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {highlights?.length || 0} finding
                        {(highlights?.length || 0) > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        );
      })()}

      {/* Figures Section */}
      {document.figures.length > 0 && (
        <div className="mt-8 border-t pt-4">
          <button
            className="flex items-center gap-2 text-sm font-semibold mb-3 hover:text-primary transition-colors"
            onClick={() => setCollapsedFigures(!collapsedFigures)}
          >
            {collapsedFigures ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Figures ({document.figures.length})
          </button>

          {!collapsedFigures && (
            <div className="space-y-3 pl-6">
              {document.figures.map((figure) => (
                <div
                  key={figure.figure_id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Image className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      Figure {figure.figure_index + 1}
                    </p>
                    {figure.caption && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {figure.caption}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}