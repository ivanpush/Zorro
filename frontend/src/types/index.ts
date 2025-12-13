/**
 * ZORRO Review System - TypeScript Type Definitions
 * Source of truth: DATA_CONTRACTS.md
 * Date: 2024-12-12
 */

// ============================================================================
// Document Structures
// ============================================================================

export interface DocObj {
  id: string;                      // UUID v4, generated at parse time
  filename: string;                // Original filename
  type: 'pdf' | 'docx';
  title: string;                   // Extracted or user-provided

  sections: Section[];
  paragraphs: Paragraph[];
  figures: Figure[];
  references: Reference[];

  metadata: DocumentMetadata;

  createdAt: string;               // ISO 8601
}

export interface Section {
  id: string;                      // e.g., "sec_001"
  index: number;                   // 0-based order
  title: string | null;            // May be null for untitled sections
  level: number;                   // Heading level (1-6)
  paragraphIds: string[];          // References to contained paragraphs
}

export interface Paragraph {
  id: string;                      // e.g., "p_001"
  sectionId: string | null;        // May be null if no clear section
  index: number;                   // Global paragraph index
  text: string;                    // Full paragraph text
  sentences: Sentence[];

  // For export mapping (PDF)
  boundingBox?: BoundingBox;
  pageNumber?: number;

  // For export mapping (DOCX)
  xmlPath?: string;                // XPath to <w:p> element
}

export interface Sentence {
  id: string;                      // e.g., "p_001_s_002"
  paragraphId: string;
  index: number;                   // Index within paragraph
  text: string;
  startChar: number;               // Character offset in paragraph
  endChar: number;
}

export interface Figure {
  id: string;                      // e.g., "fig_001"
  index: number;
  caption: string | null;
  captionParagraphId: string | null;  // If caption is a separate paragraph

  // Location info
  pageNumber?: number;             // PDF
  afterParagraphId?: string;       // Approximate position

  // Extraction metadata
  extractionMethod: 'inline' | 'textbox' | 'float' | 'unknown';
  boundingBox?: BoundingBox;
}

export interface Reference {
  id: string;                      // e.g., "ref_001"
  index: number;
  rawText: string;
  // Future: parsed citation fields
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pageNumber: number;
}

export interface DocumentMetadata {
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  author?: string;
  createdDate?: string;
  modifiedDate?: string;
}

// ============================================================================
// Finding Structures
// ============================================================================

export interface Finding {
  id: string;                      // UUID
  agentId: AgentId;
  category: FindingCategory;
  severity: Severity;
  confidence: number;              // 0.0 - 1.0

  title: string;                   // Short summary (< 100 chars)
  description: string;             // Full explanation

  anchors: Anchor[];               // REQUIRED: at least one anchor

  proposedEdit?: ProposedEdit;

  metadata?: Record<string, unknown>;  // Agent-specific data

  createdAt: string;
}

export type AgentId =
  | 'context_builder'
  | 'clarity_inspector'
  | 'rigor_inspector'
  | 'adversarial_critic'
  | 'domain_validator';

export type FindingCategory =
  | 'clarity_sentence'
  | 'clarity_paragraph'
  | 'clarity_section'
  | 'clarity_flow'
  | 'rigor_methodology'
  | 'rigor_logic'
  | 'rigor_evidence'
  | 'rigor_statistics'
  | 'scope_overclaim'
  | 'scope_underclaim'
  | 'scope_missing'
  | 'domain_convention'
  | 'domain_terminology'
  | 'domain_factual'
  | 'adversarial_weakness'
  | 'adversarial_gap'
  | 'adversarial_alternative';

export type Severity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface Anchor {
  paragraphId: string;             // REQUIRED
  sentenceId?: string;             // More specific if available
  startChar?: number;              // Character offset in paragraph
  endChar?: number;
  quotedText: string;              // REQUIRED: the actual text
}

export interface ProposedEdit {
  type: 'replace' | 'delete' | 'insert_before' | 'insert_after';
  anchor: Anchor;                  // What to modify
  newText?: string;                // For replace/insert
  rationale: string;               // Why this change
}

// ============================================================================
// Review Structures
// ============================================================================

export interface ReviewConfig {
  tier: 'standard' | 'deep';
  focusDimensions: FocusDimension[];
  domainHint?: string;
  steeringMemo?: string;           // From config chat
  reviewMode?: 'single-reviewer' | 'panel-review'; // Review mode selection

  // Feature flags
  enableAdversarial: boolean;
  enableDomainValidation: boolean;
}

export type FocusDimension =
  | 'argumentation'
  | 'methodology'
  | 'clarity'
  | 'completeness';

export interface ReviewJob {
  id: string;                      // UUID
  documentId: string;
  config: ReviewConfig;
  status: ReviewStatus;

  currentPhase?: string;
  agentStatuses: Record<AgentId, AgentStatus>;

  findings: Finding[];

  startedAt: string;
  completedAt?: string;
  error?: string;
}

export type ReviewStatus =
  | 'pending'
  | 'parsing'
  | 'analyzing'
  | 'synthesizing'
  | 'completed'
  | 'failed';

export interface AgentStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  findingsCount: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ============================================================================
// User Decision Structures
// ============================================================================

export interface Decision {
  id: string;
  findingId: string;
  action: DecisionAction;

  // For 'accept_edit' with modifications
  finalText?: string;

  timestamp: string;
}

export type DecisionAction =
  | 'accept'                       // Accept finding, no edit
  | 'accept_edit'                  // Accept proposed edit (possibly modified)
  | 'dismiss';                     // Reject finding

export interface ReviewSession {
  documentId: string;
  document: DocObj;
  findings: Finding[];
  decisions: Decision[];

  // Derived
  pendingFindings: Finding[];
  acceptedFindings: Finding[];
  dismissedFindings: Finding[];
}

// ============================================================================
// SSE Event Structures
// ============================================================================

export type SSEEvent =
  | PhaseStartedEvent
  | PhaseCompletedEvent
  | AgentStartedEvent
  | AgentCompletedEvent
  | FindingDiscoveredEvent
  | ReviewCompletedEvent
  | ErrorEvent;

export interface PhaseStartedEvent {
  type: 'phase_started';
  phase: string;
  timestamp: string;
}

export interface PhaseCompletedEvent {
  type: 'phase_completed';
  phase: string;
  timestamp: string;
}

export interface AgentStartedEvent {
  type: 'agent_started';
  agentId: AgentId;
  timestamp: string;
}

export interface AgentCompletedEvent {
  type: 'agent_completed';
  agentId: AgentId;
  findingsCount: number;
  timestamp: string;
}

export interface FindingDiscoveredEvent {
  type: 'finding_discovered';
  finding: Finding;
  timestamp: string;
}

export interface ReviewCompletedEvent {
  type: 'review_completed';
  totalFindings: number;
  timestamp: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  recoverable: boolean;
  timestamp: string;
}

// ============================================================================
// Export Structures
// ============================================================================

export interface ExportRequest {
  documentId: string;
  decisions: Decision[];
  format: 'docx' | 'pdf';
  options: ExportOptions;
}

export interface ExportOptions {
  includeUnresolvedAsComments: boolean;
  trackChangesAuthor: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ParseDocumentRequest {
  file: File;
  titleOverride?: string;
}

export interface ParseDocumentResponse {
  document: DocObj;
}

export interface StartReviewRequest {
  documentId: string;
  config: ReviewConfig;
}

export interface StartReviewResponse {
  jobId: string;
}

export interface ReviewResultResponse {
  job: ReviewJob;
  document: DocObj;
  findings: Finding[];
}

// ============================================================================
// UI State Types
// ============================================================================

export type FilterState = {
  severity: Severity | 'all';
  category: FindingCategory | 'all';
  status: 'pending' | 'accepted' | 'dismissed' | 'all';
};

export type ReviewMode = 'demo' | 'dynamic';

// ============================================================================
// Utility Types
// ============================================================================

export type FindingWithDecision = Finding & {
  decision?: Decision;
};

export type DocumentStats = {
  totalFindings: number;
  pendingCount: number;
  acceptedCount: number;
  dismissedCount: number;
  bySeverity: Record<Severity, number>;
  byCategory: Partial<Record<FindingCategory, number>>;
};

// ============================================================================
// Constants
// ============================================================================

export const SEVERITY_LEVELS: Severity[] = ['critical', 'major', 'minor', 'suggestion'];

export const AGENT_NAMES: Record<AgentId, string> = {
  context_builder: 'Context Builder',
  clarity_inspector: 'Clarity Inspector',
  rigor_inspector: 'Rigor Inspector',
  adversarial_critic: 'Adversarial Critic',
  domain_validator: 'Domain Validator',
};

export const CATEGORY_GROUPS: Record<string, FindingCategory[]> = {
  clarity: ['clarity_sentence', 'clarity_paragraph', 'clarity_section', 'clarity_flow'],
  rigor: ['rigor_methodology', 'rigor_logic', 'rigor_evidence', 'rigor_statistics'],
  scope: ['scope_overclaim', 'scope_underclaim', 'scope_missing'],
  domain: ['domain_convention', 'domain_terminology', 'domain_factual'],
  adversarial: ['adversarial_weakness', 'adversarial_gap', 'adversarial_alternative'],
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ef4444',  // red-500
  major: '#f97316',     // orange-500
  minor: '#eab308',     // yellow-500
  suggestion: '#3b82f6', // blue-500
};