import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, ArrowRight, User, Users } from 'lucide-react';
import { useAppStore } from '@/store';
import type { ReviewConfig, FocusDimension } from '@/types';

type DocumentClass = 'research-article' | 'grant-proposal' | 'thesis-chapter' | 'review-article';
type ReviewMode = 'single-reviewer' | 'panel-review';

const DOCUMENT_CLASSES: Record<DocumentClass, string> = {
  'research-article': 'Research Article',
  'grant-proposal': 'Grant Proposal',
  'thesis-chapter': 'Thesis Chapter',
  'review-article': 'Review Article',
};

export function SetupScreen() {
  const navigate = useNavigate();
  const { currentDocument, setReviewConfig, setReviewMode } = useAppStore();

  const [documentClass, setDocumentClass] = useState<DocumentClass>('research-article');
  const [directive, setDirective] = useState('');
  const [selectedFoci, setSelectedFoci] = useState<Set<string>>(new Set());
  const [reviewDepth, setReviewDepth] = useState<ReviewMode | null>('single-reviewer');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [isDemo, setIsDemo] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentDocument) {
      navigate('/upload');
      return;
    }

    // Auto-detect document class
    const wordCount = currentDocument.metadata?.wordCount || 0;
    if (currentDocument.metadata?.documentType === 'grant') {
      setDocumentClass('grant-proposal');
    } else if (wordCount > 15000) {
      setDocumentClass('thesis-chapter');
    }
  }, [currentDocument, navigate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClassDropdown(false);
      }
    };

    if (showClassDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showClassDropdown]);

  const toggleFocus = (focusId: string) => {
    setSelectedFoci(prev => {
      const next = new Set(prev);
      if (next.has(focusId)) {
        next.delete(focusId);
      } else {
        next.add(focusId);
      }
      return next;
    });
  };

  const handleInitiateReview = () => {
    if (!reviewDepth) return;

    const focusDimensions: FocusDimension[] = ['argumentation', 'methodology', 'clarity', 'completeness'];

    const config: ReviewConfig = {
      tier: reviewDepth === 'single-reviewer' ? 'deep' : 'standard',
      focusDimensions,
      steeringMemo: directive || undefined,
      enableAdversarial: reviewDepth === 'single-reviewer',
      enableDomainValidation: reviewDepth === 'single-reviewer',
      reviewMode: reviewDepth, // Pass the review mode to config
    };

    setReviewConfig(config);
    setReviewMode(isDemo ? 'demo' : 'dynamic');

    if (isDemo) {
      navigate('/review');
    } else {
      navigate('/process');
    }
  };

  if (!currentDocument) return null;

  return (
    <div className="min-h-screen bg-background antialiased">
      <div className="max-w-3xl mx-auto px-8 py-12">

        {/* Document Classification - Refined */}
        <section className="mb-14">
          <label className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(232, 85, 85, 0.7)' }}>
            Document Type
          </label>

          <div className="mt-3 relative" ref={dropdownRef}>
            <button
              onClick={() => setShowClassDropdown(!showClassDropdown)}
              className="group flex items-center gap-2 text-2xl font-bold text-foreground
                       transition-all duration-200"
              style={{ color: showClassDropdown ? '#e85555' : undefined }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#e85555'}
              onMouseLeave={(e) => e.currentTarget.style.color = showClassDropdown ? '#e85555' : ''}
            >
              {DOCUMENT_CLASSES[documentClass]}
              <ChevronDown className={`w-5 h-5 transition-transform duration-200
                ${showClassDropdown ? 'rotate-180' : ''}`}
                style={{ color: 'rgba(232, 85, 85, 0.6)' }} />
            </button>

            {showClassDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border
                            rounded-xl shadow-2xl z-10 overflow-hidden animate-in fade-in slide-in-from-top-1">
                {Object.entries(DOCUMENT_CLASSES).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setDocumentClass(key as DocumentClass);
                      setShowClassDropdown(false);
                    }}
                    className={`w-full text-left px-5 py-3 hover:bg-accent/50
                              transition-colors duration-150 ${
                      documentClass === key ? 'bg-accent/30' : ''
                    }`}
                  >
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground font-medium">
            {currentDocument.metadata?.pageCount || 0} pages · {currentDocument.metadata?.wordCount?.toLocaleString() || 0} words
          </p>
        </section>

        {/* Review Directive - Enhanced Primary Element */}
        <section className="mb-14">
          <label className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(232, 85, 85, 0.7)' }}>
            Review Directive
          </label>

          <div className="mt-3">
            <textarea
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              placeholder="Tell the reviewer how to read this paper"
              className="w-full h-32 px-6 py-4 bg-card border-2 border-border/40
                       rounded-xl text-base placeholder-muted-foreground
                       focus:outline-none focus:bg-card
                       focus:placeholder-muted-foreground/60
                       resize-none transition-all duration-200 leading-relaxed font-medium"
              style={{
                '--tw-ring-color': 'rgba(232, 85, 85, 0.2)',
              } as React.CSSProperties}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#e85555';
                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(232, 85, 85, 0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.boxShadow = '';
              }}
            />
          </div>
        </section>

        {/* Focus Pills - Refined */}
        <section className="mb-14">
          <div className="flex flex-wrap gap-2.5">
            {['Methods rigor', 'Statistics', 'Novelty', 'Desk-reject risk', 'Reproducibility'].map((label) => {
              const id = label.toLowerCase().replace(/\s+/g, '-');
              const isSelected = selectedFoci.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleFocus(id)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border-2 transition-all duration-200 ${
                    isSelected
                      ? 'shadow-md scale-105'
                      : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-card'
                  }`}
                  style={isSelected ? {
                    borderColor: '#e85555',
                    backgroundColor: '#e85555',
                    color: '#ffffff'
                  } : {
                    borderColor: undefined,
                    ':hover': { borderColor: 'rgba(232, 85, 85, 0.4)' }
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(232, 85, 85, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '';
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Review Mode - Polished Asymmetric Cards */}
        <section className="mb-14">
          <label className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(232, 85, 85, 0.7)' }}>
            Review Mode
          </label>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* Single Reviewer */}
            <button
              onClick={() => setReviewDepth('single-reviewer')}
              className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left group
                ${reviewDepth === 'single-reviewer'
                  ? 'shadow-xl scale-[1.02]'
                  : 'border-border/50 hover:bg-card hover:shadow-lg'
              }`}
              style={reviewDepth === 'single-reviewer' ? {
                borderColor: '#e85555',
                background: 'linear-gradient(to bottom right, rgba(232, 85, 85, 0.2), rgba(232, 85, 85, 0.05))'
              } : {
                ':hover': { borderColor: 'rgba(232, 85, 85, 0.5)' }
              }}
              onMouseEnter={(e) => {
                if (reviewDepth !== 'single-reviewer') {
                  e.currentTarget.style.borderColor = 'rgba(232, 85, 85, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (reviewDepth !== 'single-reviewer') {
                  e.currentTarget.style.borderColor = '';
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-bold text-lg mb-1.5 transition-colors flex items-center gap-2`}
                      style={{ color: reviewDepth === 'single-reviewer' ? '#e85555' : '' }}>
                    <User className="w-5 h-5" />
                    Single Reviewer
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold">
                    One comprehensive pass
                  </p>
                </div>
                {reviewDepth === 'single-reviewer' && (
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse"
                       style={{ backgroundColor: '#e85555', boxShadow: '0 4px 6px rgba(232, 85, 85, 0.5)' }} />
                )}
              </div>
            </button>

            {/* Panel Review */}
            <button
              onClick={() => setReviewDepth('panel-review')}
              className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left group
                ${reviewDepth === 'panel-review'
                  ? 'shadow-xl scale-[1.02]'
                  : 'border-border/50 hover:bg-card hover:shadow-lg'
              }`}
              style={reviewDepth === 'panel-review' ? {
                borderColor: '#e85555',
                background: 'linear-gradient(to bottom right, rgba(232, 85, 85, 0.2), rgba(232, 85, 85, 0.05))'
              } : {
                ':hover': { borderColor: 'rgba(232, 85, 85, 0.5)' }
              }}
              onMouseEnter={(e) => {
                if (reviewDepth !== 'panel-review') {
                  e.currentTarget.style.borderColor = 'rgba(232, 85, 85, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (reviewDepth !== 'panel-review') {
                  e.currentTarget.style.borderColor = '';
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-bold text-lg mb-1.5 transition-colors flex items-center gap-2`}
                      style={{ color: reviewDepth === 'panel-review' ? '#e85555' : '' }}
                      onMouseEnter={(e) => {
                        if (reviewDepth !== 'panel-review') {
                          e.currentTarget.style.color = '#e85555';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (reviewDepth !== 'panel-review') {
                          e.currentTarget.style.color = '';
                        }
                      }}>
                    <Users className="w-5 h-5" />
                    Panel Review
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold">
                    3 adversarial reviewers
                  </p>
                </div>
                {reviewDepth === 'panel-review' && (
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse"
                       style={{ backgroundColor: '#e85555', boxShadow: '0 4px 6px rgba(232, 85, 85, 0.5)' }} />
                )}
              </div>
            </button>
          </div>
        </section>

        {/* Actions - Polished Buttons */}
        <section className="flex justify-between items-center mb-10">
          <button
            onClick={() => navigate('/upload')}
            className="group flex items-center gap-2 px-6 py-2.5 text-sm font-medium
                     text-muted-foreground hover:text-foreground
                     transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
            Back
          </button>

          <button
            onClick={handleInitiateReview}
            disabled={!reviewDepth}
            className={`group flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold
                      transition-all duration-200 ${
              reviewDepth
                ? 'shadow-xl hover:shadow-2xl hover:scale-105'
                : 'bg-muted/20 text-muted-foreground cursor-not-allowed opacity-40'
            }`}
            style={reviewDepth ? {
              backgroundColor: '#e85555',
              color: '#ffffff',
              boxShadow: '0 20px 25px -5px rgba(232, 85, 85, 0.2)'
            } : {}}
            onMouseEnter={(e) => {
              if (reviewDepth) {
                e.currentTarget.style.backgroundColor = '#c43d3d';
              }
            }}
            onMouseLeave={(e) => {
              if (reviewDepth) {
                e.currentTarget.style.backgroundColor = '#e85555';
              }
            }}
          >
            Run Review
            <ArrowRight className={`w-4 h-4 transition-transform duration-200 ${
              reviewDepth ? 'group-hover:translate-x-1' : ''
            }`} />
          </button>
        </section>

        {/* Mode Toggle - More Visible */}
        <footer className="flex justify-center">
          <div className="inline-flex items-center gap-0.5 p-1 bg-card border border-border/40 rounded-full">
            <button
              onClick={() => setIsDemo(true)}
              className={`px-5 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                isDemo
                  ? 'shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={isDemo ? {
                backgroundColor: '#e85555',
                color: '#ffffff'
              } : {}}
            >
              Static Demo
            </button>
            <button
              onClick={() => setIsDemo(false)}
              className={`px-5 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                !isDemo
                  ? 'shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={!isDemo ? {
                backgroundColor: '#e85555',
                color: '#ffffff'
              } : {}}
            >
              Dynamic
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}