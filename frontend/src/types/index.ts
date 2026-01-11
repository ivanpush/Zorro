/**
 * ZORRO Review System - TypeScript Type Definitions
 * Source of truth: DATA_CONTRACTS.md
 * Date: 2024-12-12
 */

// ============================================================================
// Document Structures
// ============================================================================

export interface DocObj {
  document_id: string;             // UUID v4, generated at parse time
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
  section_id: string;              // e.g., "sec_001"
  section_index: number;           // 0-based order
  section_title: string | null;    // May be null for untitled sections
  level: number;                   // Heading level (1-6)
  paragraph_ids: string[];         // References to contained paragraphs
}

export interface Paragraph {
  paragraph_id: string;            // e.g., "p_001"
  section_id: string | null;       // May be null if no clear section
  paragraph_index: number;         // Global paragraph index
  text: string;                    // Full paragraph text
  sentences: Sentence[];

  // For export mapping (PDF)
  boundingBox?: BoundingBox;
  pageNumber?: number;

  // For export mapping (DOCX)
  xmlPath?: string;                // XPath to <w:p> element
}

export interface Sentence {
  sentence_id: string;             // e.g., "p_001_s_002"
  paragraph_id: string;
  sentence_index: number;          // Index within paragraph
  text: string;
  start_char: number;              // Character offset in paragraph
  end_char: number;
}

export interface Figure {
  figure_id: string;               // e.g., "fig_001"
  figure_index: number;
  caption: string | null;
  caption_paragraph_id: string | null;  // If caption is a separate paragraph

  // Location info
  page_number?: number;            // PDF
  after_paragraph_id?: string;     // Approximate position

  // Extraction metadata
  extraction_method: 'inline' | 'textbox' | 'float' | 'unknown';
  bounding_box?: BoundingBox;
}

export interface Reference {
  reference_id: string;            // e.g., "ref_001"
  reference_index: number;
  raw_text: string;
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
  page_count?: number;
  word_count: number;
  character_count: number;
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
  | 'briefing'
  | 'clarity'
  | 'rigor_find'
  | 'rigor_rewrite'
  | 'adversary'
  | 'adversary_panel'
  | 'domain';

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
  paragraphId: string;             // REQUIRED (camelCase from backend)
  sentenceId?: string;             // More specific if available
  startChar?: number;              // Character offset in paragraph
  endChar?: number;
  quotedText: string;              // REQUIRED: the actual text
}

export interface ProposedEdit {
  type: 'replace' | 'delete' | 'insert_before' | 'insert_after' | 'suggestion';
  anchor: Anchor;                  // What to modify
  newText?: string;                // For replace/insert
  rationale: string;               // WHY this suggestion/fix is good
  suggestion?: string;             // WHAT to do - actionable guidance
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
  document_id: string;
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
  finding_id: string;
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
  document_id: string;
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
  | ChunkCompletedEvent
  | FindingDiscoveredEvent
  | ReviewCompletedEvent
  | ErrorEvent;

export interface PhaseStartedEvent {
  type: 'phase_started';
  phase: string;  // "researching", "assessing", "evaluating", "synthesizing"
  description: string;
  timestamp: string;
}

export interface PhaseCompletedEvent {
  type: 'phase_completed';
  phase: string;
  timestamp: string;
}

export interface AgentStartedEvent {
  type: 'agent_started';
  agent_id: string;  // Backend uses snake_case
  title: string;
  subtitle: string;
  timestamp: string;
}

export interface AgentCompletedEvent {
  type: 'agent_completed';
  agent_id: string;
  findings_count: number;
  time_ms?: number;
  cost_usd?: number;
  timestamp: string;
}

export interface ChunkCompletedEvent {
  type: 'chunk_completed';
  agent_id: string;
  chunk_index: number;
  total_chunks: number;
  findings_count: number;
  failed: boolean;
  error?: string;
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
  findings?: Finding[];  // Final deduplicated findings
  metrics?: {
    total_time_ms: number;
    total_cost_usd: number;
    agents_run: string[];  // List of agent IDs that ran
    agent_metrics?: Record<string, { time_ms: number; cost_usd: number; findings_count: number }>;
  };
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
  document_id: string;
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
  document_id: string;
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
  briefing: 'Briefing',
  clarity: 'Clarity Inspector',
  rigor_find: 'Rigor Analysis',
  rigor_rewrite: 'Rigor Suggestions',
  adversary: 'Adversarial Review',
  adversary_panel: 'Panel Review',
  domain: 'Domain Validation',
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