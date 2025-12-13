import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import {
  getDemoDocuments,
  loadDemoDocument,
  loadDemoFindings,
  type DemoDocumentId,
} from '@/services/fixtures';

export function UploadScreen() {
  const navigate = useNavigate();
  const { setCurrentDocument, setFindings, setReviewMode, reset } =
    useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDemos, setShowDemos] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const demoDropdownRef = useRef<HTMLDivElement>(null);
  const demoDocuments = getDemoDocuments();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (demoDropdownRef.current && !demoDropdownRef.current.contains(event.target as Node)) {
        setShowDemos(false);
      }
    };

    if (showDemos) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDemos]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    validateAndSetFile(file);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        validateAndSetFile(file);
      }
    },
    []
  );

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.pdf', '.docx'];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      setError('Only PDF and DOCX files are accepted.');
      return;
    }

    // Optional size limit - can be configured or removed entirely
    const MAX_FILE_SIZE = null; // Set to number in MB to enable limit, null to disable
    if (MAX_FILE_SIZE && file.size > MAX_FILE_SIZE * 1024 * 1024) {
      setError(`File exceeds ${MAX_FILE_SIZE}MB limit.`);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setIsProcessing(true);

    // Show processing state briefly then auto-advance
    setTimeout(() => {
      handleUpload(file);
    }, 1500);
  };

  const handleDemoSelect = async (demoId: DemoDocumentId) => {
    try {
      reset();
      setReviewMode('demo');
      const [document, findings] = await Promise.all([
        loadDemoDocument(demoId),
        loadDemoFindings(demoId),
      ]);
      setCurrentDocument(document);
      setFindings(findings);
      navigate('/setup');
    } catch (err) {
      setError('Failed to load demonstration document.');
    }
  };

  const handleUpload = async (file?: File) => {
    const fileToUpload = file || selectedFile;
    if (!fileToUpload) return;

    try {
      reset();
      setReviewMode('dynamic');
      // Backend not implemented - show error
      setError('Live processing unavailable. Select demonstration document.');
      setIsProcessing(false);
    } catch (err) {
      setError('Upload failed.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Demo Mode Toggle - Top Left for Dev */}
      <div className="absolute top-4 left-4 z-10" ref={demoDropdownRef}>
        <button
          onClick={() => setShowDemos(!showDemos)}
          className="text-sm transition-colors flex items-center gap-1 px-3 py-1 rounded-md backdrop-blur-sm"
          style={{
            color: '#a0a0b0',
            backgroundColor: 'rgba(37, 37, 66, 0.8)',
            border: '1px solid rgba(160, 160, 176, 0.2)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#f5f0e8'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#a0a0b0'}
        >
          <span className="uppercase tracking-wider">Demo</span>
          <span>{showDemos ? '×' : '▼'}</span>
        </button>

        {showDemos && (
          <div
            className="absolute top-10 left-0 shadow-lg rounded-md p-2 min-w-[280px]"
            style={{
              backgroundColor: '#252542',
              border: '1px solid rgba(160, 160, 176, 0.2)'
            }}
          >
            <div className="text-xs mb-2 px-2" style={{ color: '#a0a0b0' }}>Test Documents</div>
            {demoDocuments.map((demo) => (
              <button
                key={demo.id}
                onClick={() => {
                  handleDemoSelect(demo.id);
                  setShowDemos(false);
                }}
                className="block w-full text-left px-2 py-1.5 text-xs rounded transition-colors"
                style={{ color: '#f5f0e8' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(232, 85, 85, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div className="font-medium">{demo.label}</div>
                <div className="mt-0.5" style={{ color: '#a0a0b0' }}>
                  {demo.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start justify-center min-h-screen pt-24">
        <div className="w-full max-w-xl px-6">

          {/* Title with Compelling Tagline */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-serif tracking-tight mb-2" style={{ color: '#f5f0e8' }}>
              ZORRO
            </h1>
            <p className="text-base font-light max-w-md mx-auto" style={{ color: '#a0a0b0' }}>
              A <span style={{ color: '#E89855' }}>hostile reading</span> of your manuscript.<br />
              <span style={{ opacity: 0.65 }}>Surface the arguments reviewers will challenge.</span>
            </p>
          </div>

          {/* Upload Area - Compact Design with Processing State */}
          {!isProcessing ? (
            <div
              className={`relative border rounded-xl transition-all duration-300`}
              style={{
                borderColor: isDragging ? '#E89855' : 'rgba(160, 160, 176, 0.3)',
                backgroundColor: isDragging ? 'rgba(232, 152, 85, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                boxShadow: isHovering ? '0 0 40px rgba(232, 152, 85, 0.15)' : 'none',
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <div className="p-10 text-center">
                {selectedFile && !isProcessing ? (
                  <div className="animate-in fade-in duration-300">
                    <div
                      className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(232, 152, 85, 0.15)' }}
                    >
                      <svg className="w-5 h-5" style={{ color: '#E89855' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium mb-1" style={{ color: '#f5f0e8' }}>{selectedFile.name}</div>
                    <div className="text-xs" style={{ color: '#a0a0b0' }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Upload Icon */}
                    <div className="w-10 h-10 mx-auto mb-3">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#a0a0b0' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>

                    <div className="mb-4">
                      <div className="text-sm mb-1" style={{ color: '#f5f0e8' }}>
                        Drop your document here or
                      </div>
                    </div>

                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,.docx"
                      onChange={handleFileSelect}
                      disabled={isProcessing}
                    />
                    <label htmlFor="file-upload">
                      <span
                        className="px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all inline-block"
                        style={{
                          backgroundColor: '#E89855',
                          color: '#ffffff'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#D08045'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E89855'}
                      >
                        Select File
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Processing State */
            <div
              className="rounded-xl p-10"
              style={{
                border: '1px solid #e85555',
                backgroundColor: 'rgba(232, 85, 85, 0.1)',
              }}
            >
              <div className="text-center">
                {/* Animated Checkmark */}
                <div className="w-10 h-10 mx-auto mb-4">
                  <svg className="animate-in zoom-in duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#E89855' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm font-medium mb-1" style={{ color: '#f5f0e8' }}>
                  Uploading...
                </div>
                <div className="text-xs mb-4" style={{ color: '#a0a0b0' }}>
                  {selectedFile?.name}
                </div>
                <button
                  onClick={() => navigate('/setup')}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all inline-block"
                  style={{
                    backgroundColor: '#E89855',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#D08045'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E89855'}
                >
                  Continue to Setup
                </button>
              </div>
            </div>
          )}

          {/* Simplified file format text */}
          {!isProcessing && !selectedFile && (
            <div className="text-center mt-4">
              <p className="text-xs" style={{ color: '#a0a0b0' }}>
                ✓ Supports both DOCX and PDF files
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="mt-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgba(232, 152, 85, 0.1)',
                border: '1px solid rgba(232, 152, 85, 0.3)'
              }}
            >
              <div className="text-sm flex items-center gap-2" style={{ color: '#E89855' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}