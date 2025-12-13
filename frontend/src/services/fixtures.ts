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
    id: 'demo_simple_001',
    filename: 'simple_demo.docx',
    type: 'docx',
    title: 'A Simple Demo Document',
    sections: [
      {
        id: 'sec_001',
        index: 0,
        title: 'Introduction',
        level: 1,
        paragraphIds: ['p_001', 'p_002'],
      },
      {
        id: 'sec_002',
        index: 1,
        title: 'Methods',
        level: 1,
        paragraphIds: ['p_003', 'p_004'],
      },
      {
        id: 'sec_003',
        index: 2,
        title: 'Results',
        level: 1,
        paragraphIds: ['p_005', 'p_006'],
      },
      {
        id: 'sec_004',
        index: 3,
        title: 'Conclusion',
        level: 1,
        paragraphIds: ['p_007'],
      },
    ],
    paragraphs: [
      {
        id: 'p_001',
        sectionId: 'sec_001',
        index: 0,
        text: 'This study investigates the impact of various factors on system performance. We present a comprehensive analysis of the underlying mechanisms.',
        sentences: [
          {
            id: 'p_001_s_001',
            paragraphId: 'p_001',
            index: 0,
            text: 'This study investigates the impact of various factors on system performance.',
            startChar: 0,
            endChar: 77,
          },
          {
            id: 'p_001_s_002',
            paragraphId: 'p_001',
            index: 1,
            text: 'We present a comprehensive analysis of the underlying mechanisms.',
            startChar: 78,
            endChar: 144,
          },
        ],
      },
      {
        id: 'p_002',
        sectionId: 'sec_001',
        index: 1,
        text: 'Previous research has shown mixed results. However, a clear consensus has not been reached regarding the optimal approach.',
        sentences: [
          {
            id: 'p_002_s_001',
            paragraphId: 'p_002',
            index: 0,
            text: 'Previous research has shown mixed results.',
            startChar: 0,
            endChar: 43,
          },
          {
            id: 'p_002_s_002',
            paragraphId: 'p_002',
            index: 1,
            text: 'However, a clear consensus has not been reached regarding the optimal approach.',
            startChar: 44,
            endChar: 123,
          },
        ],
      },
      {
        id: 'p_003',
        sectionId: 'sec_002',
        index: 2,
        text: 'We employed a rigorous experimental design with three treatment groups. Statistical analysis was performed using standard methods.',
        sentences: [
          {
            id: 'p_003_s_001',
            paragraphId: 'p_003',
            index: 0,
            text: 'We employed a rigorous experimental design with three treatment groups.',
            startChar: 0,
            endChar: 71,
          },
          {
            id: 'p_003_s_002',
            paragraphId: 'p_003',
            index: 1,
            text: 'Statistical analysis was performed using standard methods.',
            startChar: 72,
            endChar: 131,
          },
        ],
      },
      {
        id: 'p_004',
        sectionId: 'sec_002',
        index: 3,
        text: 'Data was collected over a period of six months. All participants provided informed consent.',
        sentences: [
          {
            id: 'p_004_s_001',
            paragraphId: 'p_004',
            index: 0,
            text: 'Data was collected over a period of six months.',
            startChar: 0,
            endChar: 48,
          },
          {
            id: 'p_004_s_002',
            paragraphId: 'p_004',
            index: 1,
            text: 'All participants provided informed consent.',
            startChar: 49,
            endChar: 92,
          },
        ],
      },
      {
        id: 'p_005',
        sectionId: 'sec_003',
        index: 4,
        text: 'Our results demonstrate a significant improvement in performance metrics. The effect size was substantial across all conditions.',
        sentences: [
          {
            id: 'p_005_s_001',
            paragraphId: 'p_005',
            index: 0,
            text: 'Our results demonstrate a significant improvement in performance metrics.',
            startChar: 0,
            endChar: 73,
          },
          {
            id: 'p_005_s_002',
            paragraphId: 'p_005',
            index: 1,
            text: 'The effect size was substantial across all conditions.',
            startChar: 74,
            endChar: 129,
          },
        ],
      },
      {
        id: 'p_006',
        sectionId: 'sec_003',
        index: 5,
        text: 'Figure 1 shows the main findings. These results contradict some previous studies but align with recent theoretical predictions.',
        sentences: [
          {
            id: 'p_006_s_001',
            paragraphId: 'p_006',
            index: 0,
            text: 'Figure 1 shows the main findings.',
            startChar: 0,
            endChar: 33,
          },
          {
            id: 'p_006_s_002',
            paragraphId: 'p_006',
            index: 1,
            text: 'These results contradict some previous studies but align with recent theoretical predictions.',
            startChar: 34,
            endChar: 127,
          },
        ],
      },
      {
        id: 'p_007',
        sectionId: 'sec_004',
        index: 6,
        text: 'In conclusion, our findings provide strong evidence for the proposed hypothesis. Future research should explore the underlying mechanisms in greater detail.',
        sentences: [
          {
            id: 'p_007_s_001',
            paragraphId: 'p_007',
            index: 0,
            text: 'In conclusion, our findings provide strong evidence for the proposed hypothesis.',
            startChar: 0,
            endChar: 80,
          },
          {
            id: 'p_007_s_002',
            paragraphId: 'p_007',
            index: 1,
            text: 'Future research should explore the underlying mechanisms in greater detail.',
            startChar: 81,
            endChar: 157,
          },
        ],
      },
    ],
    figures: [
      {
        id: 'fig_001',
        index: 0,
        caption: 'Main experimental results showing performance improvements',
        captionParagraphId: null,
        afterParagraphId: 'p_005',
        extractionMethod: 'inline',
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
          paragraphId: 'p_001',
          sentenceId: 'p_001_s_001',
          quotedText: 'various factors',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraphId: 'p_001',
          sentenceId: 'p_001_s_001',
          quotedText: 'various factors',
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
          paragraphId: 'p_003',
          sentenceId: 'p_003_s_002',
          quotedText: 'standard methods',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraphId: 'p_003',
          sentenceId: 'p_003_s_002',
          quotedText: 'using standard methods',
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
          paragraphId: 'p_007',
          sentenceId: 'p_007_s_001',
          quotedText: 'strong evidence for the proposed hypothesis',
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
          paragraphId: 'p_004',
          quotedText: 'All participants provided informed consent.',
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
          paragraphId: 'p_005',
          sentenceId: 'p_005_s_002',
          quotedText: 'substantial across all conditions',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraphId: 'p_005',
          sentenceId: 'p_005_s_002',
          quotedText: 'The effect size was substantial across all conditions.',
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
          paragraphId: 'p_004',
          sentenceId: 'p_004_s_001',
          quotedText: 'Data was collected',
        },
      ],
      proposedEdit: {
        type: 'replace',
        anchor: {
          paragraphId: 'p_004',
          sentenceId: 'p_004_s_001',
          quotedText: 'Data was collected',
        },
        newText: 'We collected data',
        rationale: 'Active voice improves clarity and readability',
      },
      createdAt: timestamp,
    },
  ];
}