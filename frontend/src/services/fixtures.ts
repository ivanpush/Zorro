import type { DocObj, Finding, AgentId, FindingCategory } from '@/types';

// Demo document options
export const DEMO_DOCUMENTS = [
  {
    id: 'manuscript_pdf',
    label: 'Scientific Manuscript - Mechanobiology Atlas',
    description: 'Full research paper on kinase inhibitor effects',
  },
  {
    id: 'simple_demo',
    label: 'Simple Demo Document',
    description: 'Shorter example for quick testing',
  },
] as const;

export type DemoDocumentId = typeof DEMO_DOCUMENTS[number]['id'];

/**
 * Load a demo document fixture
 */
export async function loadDemoDocument(id: DemoDocumentId): Promise<DocObj> {
  // Simulate network delay for realism
  await simulateDelay(300, 500);

  if (id === 'manuscript_pdf') {
    const response = await fetch('/fixtures/manuscript_pdf.json');
    if (!response.ok) {
      throw new Error('Failed to load demo document');
    }
    return response.json();
  }

  if (id === 'simple_demo') {
    // Return a simpler demo document
    return createSimpleDemoDocument();
  }

  throw new Error(`Unknown demo document: ${id}`);
}

/**
 * Load demo findings for a document
 */
export async function loadDemoFindings(id: DemoDocumentId): Promise<Finding[]> {
  // Simulate network delay
  await simulateDelay(400, 600);

  if (id === 'manuscript_pdf') {
    const response = await fetch('/reviews/manuscript_pdf_fullreview.json');
    if (!response.ok) {
      throw new Error('Failed to load demo findings');
    }
    const data = await response.json();

    // The review file has "issues" array, convert to Finding format
    const findings: Finding[] = [];

    // Convert issues to findings
    if (data.issues && Array.isArray(data.issues)) {
      data.issues.forEach((issue: any) => {
        // Skip issues without proper paragraph anchoring
        if (!issue.paragraph_id) {
          console.warn('Skipping issue without paragraph_id:', issue);
          return;
        }

        // Map issue to Finding format
        // Handle different field names across issue types
        const description = issue.message || issue.critique || '';

        // Map all suggestion types into proposedEdit.newText
        // - suggested_rewrite/proposed_rewrite: actual text replacements
        // - suggested_revision: actionable advice (counterpoint)
        // - outline_suggestion: structural recommendations
        const rewriteText = issue.suggested_rewrite || issue.proposed_rewrite;
        const suggestionText = issue.suggested_revision ||
          (issue.outline_suggestion && Array.isArray(issue.outline_suggestion)
            ? issue.outline_suggestion.map((s: string) => `• ${s}`).join('\n')
            : null);

        // Use rewrite if available, otherwise use suggestion
        const proposedText = rewriteText || suggestionText;

        // Determine if this is a suggestion (not a direct rewrite)
        const isSuggestion = !rewriteText && !!suggestionText;

        const finding: Finding = {
          id: issue.id || `finding_${Date.now()}_${Math.random()}`,
          agentId: mapScopeToAgent(issue.scope),
          category: mapIssueTypeToCategory(issue.issue_type, issue.scope),
          severity: issue.severity || 'minor',
          confidence: issue.confidence || 0.8,
          title: issue.title || 'Untitled Issue',
          description,
          anchors: [
            {
              paragraph_id: issue.paragraph_id,
              sentence_id: issue.sentence_ids?.[0],
              quoted_text: issue.original_text || issue.quoted_text || '',
            }
          ],
          createdAt: new Date().toISOString(),
        };

        // Add proposed edit if available (rewrite or suggestion)
        if (proposedText) {
          finding.proposedEdit = {
            type: isSuggestion ? 'suggestion' : 'replace',
            anchor: finding.anchors[0],
            newText: proposedText,
            rationale: issue.rationale || '',
          };
        }

        findings.push(finding);
      });
    }

    // If still no findings, try other possible structures
    if (findings.length === 0 && data.findings) {
      findings.push(...data.findings);
    }

    console.log(`Loaded ${findings.length} demo findings for ${id}`);
    return findings;
  }

  if (id === 'simple_demo') {
    return createSimpleDemoFindings();
  }

  throw new Error(`Unknown demo document: ${id}`);
}

/**
 * Get list of available demo documents
 */
export function getDemoDocuments() {
  return DEMO_DOCUMENTS;
}

/**
 * Map scope to agent ID
 */
function mapScopeToAgent(scope: string): AgentId {
  switch (scope?.toLowerCase()) {
    case 'rigor':
      return 'rigor_find';
    case 'clarity':
      return 'clarity';
    case 'counterpoint':
    case 'adversarial':
      return 'adversary';
    case 'domain':
      return 'domain';
    case 'context':
      return 'briefing';
    default:
      return 'rigor_find';
  }
}

/**
 * Map issue type and scope to finding category
 */
function mapIssueTypeToCategory(issueType: string, scope: string): FindingCategory {
  const scopeLower = scope?.toLowerCase() || '';
  const typeLower = issueType?.toLowerCase() || '';

  if (scopeLower === 'clarity') {
    if (typeLower.includes('sentence')) return 'clarity_sentence';
    if (typeLower.includes('paragraph')) return 'clarity_paragraph';
    if (typeLower.includes('section')) return 'clarity_section';
    return 'clarity_flow';
  }

  if (scopeLower === 'rigor') {
    if (typeLower.includes('method')) return 'rigor_methodology';
    if (typeLower.includes('logic')) return 'rigor_logic';
    if (typeLower.includes('evidence')) return 'rigor_evidence';
    if (typeLower.includes('statistic')) return 'rigor_statistics';
    return 'rigor_methodology';
  }

  if (scopeLower === 'counterpoint' || scopeLower === 'adversarial') {
    if (typeLower.includes('weakness')) return 'adversarial_weakness';
    if (typeLower.includes('gap')) return 'adversarial_gap';
    return 'adversarial_alternative';
  }

  if (scopeLower === 'domain') {
    if (typeLower.includes('convention')) return 'domain_convention';
    if (typeLower.includes('terminology')) return 'domain_terminology';
    return 'domain_factual';
  }

  // Default based on scope
  return 'rigor_methodology';
}

/**
 * Simulate network delay for realism
 */
function simulateDelay(min: number, max: number): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Create a simple demo document for quick testing
 */
function createSimpleDemoDocument(): DocObj {
  const timestamp = new Date().toISOString();

  return {
    document_id: 'demo_simple_001',
    filename: 'simple_demo.docx',
    type: 'docx',
    title: 'A Simple Demo Document',
    sections: [
      {
        section_id: 'sec_001',
        section_index: 0,
        section_title: 'Introduction',
        level: 1,
        paragraph_ids: ['p_001', 'p_002'],
      },
      {
        section_id: 'sec_002',
        section_index: 1,
        section_title: 'Methods',
        level: 1,
        paragraph_ids: ['p_003', 'p_004'],
      },
      {
        section_id: 'sec_003',
        section_index: 2,
        section_title: 'Results',
        level: 1,
        paragraph_ids: ['p_005', 'p_006'],
      },
      {
        section_id: 'sec_004',
        section_index: 3,
        section_title: 'Conclusion',
        level: 1,
        paragraph_ids: ['p_007'],
      },
    ],
    paragraphs: [
      {
        paragraph_id: 'p_001',
        section_id: 'sec_001',
        paragraph_index:0,
        text: 'This study investigates the impact of various factors on system performance. We present a comprehensive analysis of the underlying mechanisms.',
        sentences: [
          {
            sentence_id: 'p_001_s_001',
            paragraph_id: 'p_001',
            sentence_index:0,
            text: 'This study investigates the impact of various factors on system performance.',
            start_char: 0,
            end_char: 77,
          },
          {
            sentence_id: 'p_001_s_002',
            paragraph_id: 'p_001',
            sentence_index:1,
            text: 'We present a comprehensive analysis of the underlying mechanisms.',
            start_char: 78,
            end_char: 144,
          },
        ],
      },
      {
        paragraph_id: 'p_002',
        section_id: 'sec_001',
        paragraph_index:1,
        text: 'Previous research has shown mixed results. However, a clear consensus has not been reached regarding the optimal approach.',
        sentences: [
          {
            sentence_id: 'p_002_s_001',
            paragraph_id: 'p_002',
            sentence_index:0,
            text: 'Previous research has shown mixed results.',
            start_char: 0,
            end_char: 43,
          },
          {
            sentence_id: 'p_002_s_002',
            paragraph_id: 'p_002',
            sentence_index:1,
            text: 'However, a clear consensus has not been reached regarding the optimal approach.',
            start_char: 44,
            end_char: 123,
          },
        ],
      },
      {
        paragraph_id: 'p_003',
        section_id: 'sec_002',
        paragraph_index:2,
        text: 'We employed a rigorous experimental design with three treatment groups. Statistical analysis was performed using standard methods.',
        sentences: [
          {
            sentence_id: 'p_003_s_001',
            paragraph_id: 'p_003',
            sentence_index:0,
            text: 'We employed a rigorous experimental design with three treatment groups.',
            start_char: 0,
            end_char: 71,
          },
          {
            sentence_id: 'p_003_s_002',
            paragraph_id: 'p_003',
            sentence_index:1,
            text: 'Statistical analysis was performed using standard methods.',
            start_char: 72,
            end_char: 131,
          },
        ],
      },
      {
        paragraph_id: 'p_004',
        section_id: 'sec_002',
        paragraph_index:3,
        text: 'Data was collected over a period of six months. All participants provided informed consent.',
        sentences: [
          {
            sentence_id: 'p_004_s_001',
            paragraph_id: 'p_004',
            sentence_index:0,
            text: 'Data was collected over a period of six months.',
            start_char: 0,
            end_char: 48,
          },
          {
            sentence_id: 'p_004_s_002',
            paragraph_id: 'p_004',
            sentence_index:1,
            text: 'All participants provided informed consent.',
            start_char: 49,
            end_char: 92,
          },
        ],
      },
      {
        paragraph_id: 'p_005',
        section_id: 'sec_003',
        paragraph_index:4,
        text: 'Our results demonstrate a significant improvement in performance metrics. The effect size was substantial across all conditions.',
        sentences: [
          {
            sentence_id: 'p_005_s_001',
            paragraph_id: 'p_005',
            sentence_index:0,
            text: 'Our results demonstrate a significant improvement in performance metrics.',
            start_char: 0,
            end_char: 73,
          },
          {
            sentence_id: 'p_005_s_002',
            paragraph_id: 'p_005',
            sentence_index:1,
            text: 'The effect size was substantial across all conditions.',
            start_char: 74,
            end_char: 129,
          },
        ],
      },
      {
        paragraph_id: 'p_006',
        section_id: 'sec_003',
        paragraph_index:5,
        text: 'Figure 1 shows the main findings. These results contradict some previous studies but align with recent theoretical predictions.',
        sentences: [
          {
            sentence_id: 'p_006_s_001',
            paragraph_id: 'p_006',
            sentence_index:0,
            text: 'Figure 1 shows the main findings.',
            start_char: 0,
            end_char: 33,
          },
          {
            sentence_id: 'p_006_s_002',
            paragraph_id: 'p_006',
            sentence_index:1,
            text: 'These results contradict some previous studies but align with recent theoretical predictions.',
            start_char: 34,
            end_char: 127,
          },
        ],
      },
      {
        paragraph_id: 'p_007',
        section_id: 'sec_004',
        paragraph_index:6,
        text: 'In conclusion, our findings provide strong evidence for the proposed hypothesis. Future research should explore the underlying mechanisms in greater detail.',
        sentences: [
          {
            sentence_id: 'p_007_s_001',
            paragraph_id: 'p_007',
            sentence_index:0,
            text: 'In conclusion, our findings provide strong evidence for the proposed hypothesis.',
            start_char: 0,
            end_char: 80,
          },
          {
            sentence_id: 'p_007_s_002',
            paragraph_id: 'p_007',
            sentence_index:1,
            text: 'Future research should explore the underlying mechanisms in greater detail.',
            start_char: 81,
            end_char: 157,
          },
        ],
      },
    ],
    figures: [
      {
        figure_id: 'fig_001',
        figure_index: 0,
        caption: 'Main experimental results showing performance improvements',
        caption_paragraph_id: null,
        after_paragraph_id: 'p_005',
        extraction_method: 'inline',
      },
    ],
    references: [],
    metadata: {
      wordCount: 250,
      characterCount: 1200,
      author: 'Demo Author',
      createdDate: timestamp,
      modifiedDate: timestamp,
    },
    createdAt: timestamp,
  };
}

/**
 * Create simple demo findings for the simple demo document
 */
function createSimpleDemoFindings(): Finding[] {
  const timestamp = new Date().toISOString();

  return [
    {
      id: 'finding_001',
      agentId: 'clarity',
      category: 'clarity_sentence',
      severity: 'minor',
      confidence: 0.85,
      title: 'Vague language in introduction',
      description: 'The phrase "various factors" is too vague. Consider specifying which factors are being investigated.',
      anchors: [
        {
          paragraph_id: 'p_001',
          sentence_id: 'p_001_s_001',
          quoted_text: 'various factors',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_001',
          sentence_id: 'p_001_s_001',
          quoted_text: 'various factors',
        },
        newText: 'temperature, pressure, and humidity',
        rationale: 'Specificity improves clarity and reader understanding',
      },
      createdAt: timestamp,
    },
    {
      id: 'finding_002',
      agentId: 'rigor_find',
      category: 'rigor_methodology',
      severity: 'major',
      confidence: 0.92,
      title: 'Insufficient methodological detail',
      description: '"Standard methods" is too vague for reproducibility. Specific statistical tests and software should be mentioned.',
      anchors: [
        {
          paragraph_id: 'p_003',
          sentence_id: 'p_003_s_002',
          quoted_text: 'standard methods',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_003',
          sentence_id: 'p_003_s_002',
          quoted_text: 'using standard methods',
        },
        newText: 'using ANOVA with Bonferroni correction (SPSS v28)',
        rationale: 'Specific methods are required for reproducibility',
      },
      createdAt: timestamp,
    },
    {
      id: 'finding_003',
      agentId: 'adversary',
      category: 'adversarial_weakness',
      severity: 'critical',
      confidence: 0.88,
      title: 'Unsupported causal claim',
      description: 'The conclusion claims "strong evidence" but the methodology only supports correlation, not causation.',
      anchors: [
        {
          paragraph_id: 'p_007',
          sentence_id: 'p_007_s_001',
          quoted_text: 'strong evidence for the proposed hypothesis',
        },
      ],
      createdAt: timestamp,
    },
    {
      id: 'finding_004',
      agentId: 'clarity',
      category: 'clarity_flow',
      severity: 'suggestion',
      confidence: 0.75,
      title: 'Abrupt transition',
      description: 'The transition from methods to results could be smoother. Consider adding a bridging sentence.',
      anchors: [
        {
          paragraph_id: 'p_004',
          quoted_text: 'All participants provided informed consent.',
        },
      ],
      createdAt: timestamp,
    },
    {
      id: 'finding_005',
      agentId: 'rigor_find',
      category: 'rigor_statistics',
      severity: 'major',
      confidence: 0.90,
      title: 'Missing effect size details',
      description: 'Claims "substantial" effect size without providing specific values or confidence intervals.',
      anchors: [
        {
          paragraph_id: 'p_005',
          sentence_id: 'p_005_s_002',
          quoted_text: 'substantial across all conditions',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_005',
          sentence_id: 'p_005_s_002',
          quoted_text: 'The effect size was substantial across all conditions.',
        },
        newText: "Cohen's d = 0.82 (95% CI: 0.65-0.99) across all conditions.",
        rationale: 'Quantitative metrics are needed for scientific rigor',
      },
      createdAt: timestamp,
    },
    {
      id: 'finding_006',
      agentId: 'domain',
      category: 'domain_convention',
      severity: 'minor',
      confidence: 0.82,
      title: 'Passive voice in methods',
      description: 'Active voice is preferred in modern scientific writing for clarity.',
      anchors: [
        {
          paragraph_id: 'p_004',
          sentence_id: 'p_004_s_001',
          quoted_text: 'Data was collected',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_004',
          sentence_id: 'p_004_s_001',
          quoted_text: 'Data was collected',
        },
        newText: 'We collected data',
        rationale: 'Active voice improves clarity and readability',
      },
      createdAt: timestamp,
    },
  ];
}