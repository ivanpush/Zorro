import type { DocObj, Finding } from '@/types';

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

    // The review file has a structure with tracks, we need to flatten findings
    const findings: Finding[] = [];

    // Extract findings from all tracks
    if (data.tracks) {
      Object.values(data.tracks).forEach((track: any) => {
        if (track.scopes) {
          Object.values(track.scopes).forEach((scope: any) => {
            if (scope.findings) {
              findings.push(...scope.findings);
            }
          });
        }
      });
    }

    // If the structure is different, try direct findings array
    if (findings.length === 0 && data.findings) {
      findings.push(...data.findings);
    }

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
        paragraph_index: 0,
        section_title: 'Introduction',
        level: 1,
        paragraph_ids: ['p_001', 'p_002'],
      },
      {
        section_id: 'sec_002',
        paragraph_index: 1,
        section_title: 'Methods',
        level: 1,
        paragraph_ids: ['p_003', 'p_004'],
      },
      {
        section_id: 'sec_003',
        paragraph_index:2,
        section_title: 'Results',
        level: 1,
        paragraph_ids: ['p_005', 'p_006'],
      },
      {
        section_id: 'sec_004',
        paragraph_index:3,
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
      agentId: 'clarity_inspector',
      category: 'clarity_sentence',
      severity: 'minor',
      confidence: 0.85,
      title: 'Vague language in introduction',
      description: 'The phrase "various factors" is too vague. Consider specifying which factors are being investigated.',
      anchors: [
        {
          paragraph_id: 'p_001',
          sentenceId: 'p_001_s_001',
          quoted_text: 'various factors',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_001',
          sentenceId: 'p_001_s_001',
          quoted_text: 'various factors',
        },
        newText: 'temperature, pressure, and humidity',
        rationale: 'Specificity improves clarity and reader understanding',
      },
      createdAt: timestamp,
    },
    {
      id: 'finding_002',
      agentId: 'rigor_inspector',
      category: 'rigor_methodology',
      severity: 'major',
      confidence: 0.92,
      title: 'Insufficient methodological detail',
      description: '"Standard methods" is too vague for reproducibility. Specific statistical tests and software should be mentioned.',
      anchors: [
        {
          paragraph_id: 'p_003',
          sentenceId: 'p_003_s_002',
          quoted_text: 'standard methods',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_003',
          sentenceId: 'p_003_s_002',
          quoted_text: 'using standard methods',
        },
        newText: 'using ANOVA with Bonferroni correction (SPSS v28)',
        rationale: 'Specific methods are required for reproducibility',
      },
      createdAt: timestamp,
    },
    {
      id: 'finding_003',
      agentId: 'adversarial_critic',
      category: 'adversarial_weakness',
      severity: 'critical',
      confidence: 0.88,
      title: 'Unsupported causal claim',
      description: 'The conclusion claims "strong evidence" but the methodology only supports correlation, not causation.',
      anchors: [
        {
          paragraph_id: 'p_007',
          sentenceId: 'p_007_s_001',
          quoted_text: 'strong evidence for the proposed hypothesis',
        },
      ],
      createdAt: timestamp,
    },
    {
      id: 'finding_004',
      agentId: 'clarity_inspector',
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
      agentId: 'rigor_inspector',
      category: 'rigor_statistics',
      severity: 'major',
      confidence: 0.90,
      title: 'Missing effect size details',
      description: 'Claims "substantial" effect size without providing specific values or confidence intervals.',
      anchors: [
        {
          paragraph_id: 'p_005',
          sentenceId: 'p_005_s_002',
          quoted_text: 'substantial across all conditions',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_005',
          sentenceId: 'p_005_s_002',
          quoted_text: 'The effect size was substantial across all conditions.',
        },
        newText: "Cohen's d = 0.82 (95% CI: 0.65-0.99) across all conditions.",
        rationale: 'Quantitative metrics are needed for scientific rigor',
      },
      createdAt: timestamp,
    },
    {
      id: 'finding_006',
      agentId: 'domain_validator',
      category: 'domain_convention',
      severity: 'minor',
      confidence: 0.82,
      title: 'Passive voice in methods',
      description: 'Active voice is preferred in modern scientific writing for clarity.',
      anchors: [
        {
          paragraph_id: 'p_004',
          sentenceId: 'p_004_s_001',
          quoted_text: 'Data was collected',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraph_id: 'p_004',
          sentenceId: 'p_004_s_001',
          quoted_text: 'Data was collected',
        },
        newText: 'We collected data',
        rationale: 'Active voice improves clarity and readability',
      },
      createdAt: timestamp,
    },
  ];
}