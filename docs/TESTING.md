# Testing Guide

This document outlines the testing strategy for ZORRO, including what to test, how to test, and testing best practices.

---

## Testing Philosophy

1. **Test behavior, not implementation** — Focus on what the code does, not how
2. **Meaningful coverage** — Aim for high coverage of critical paths, not 100% everywhere
3. **Fast feedback** — Unit tests should run in seconds
4. **Realistic integration** — Integration tests use realistic data and scenarios
5. **Deterministic** — Tests must be reproducible; mock external services

---

## Test Pyramid

```
         /\
        /  \     E2E Tests (few, slow, high confidence)
       /----\    
      /      \   Integration Tests (moderate, verify components work together)
     /--------\
    /          \ Unit Tests (many, fast, test individual functions)
   --------------
```

| Level | Backend | Frontend | Purpose |
|-------|---------|----------|---------|
| Unit | pytest | Vitest | Individual functions, models |
| Integration | pytest-asyncio | React Testing Library | API routes, hooks, services |
| E2E | - | Playwright | Full user flows |

---

## Backend Testing (`apps/api/tests/`)

### Directory Structure

```
tests/
├── conftest.py              # Shared fixtures
├── unit/
│   ├── models/             # Pydantic model validation
│   ├── parsers/            # Parser unit tests
│   └── services/           # Service logic tests
├── integration/
│   ├── test_document_flow.py
│   ├── test_review_flow.py
│   └── test_export_flow.py
├── agents/
│   ├── test_context_builder.py
│   ├── test_clarity_inspector.py
│   ├── test_rigor_inspector.py
│   ├── test_adversarial_critic.py
│   └── test_domain_validator.py
└── fixtures/
    ├── sample_docx/
    ├── sample_pdf/
    └── mock_responses/
```

### Shared Fixtures (`conftest.py`)

```python
import pytest
from pathlib import Path

@pytest.fixture
def sample_docx_path():
    return Path(__file__).parent / "fixtures" / "sample_docx" / "simple.docx"

@pytest.fixture
def sample_pdf_path():
    return Path(__file__).parent / "fixtures" / "sample_pdf" / "simple.pdf"

@pytest.fixture
def sample_doc_obj():
    """Pre-parsed DocObj for testing agents"""
    return DocObj(
        id="test-doc-001",
        filename="test.docx",
        type="docx",
        title="Test Document",
        sections=[...],
        paragraphs=[...],
        figures=[],
        references=[],
        metadata=DocumentMetadata(word_count=1000, character_count=5000),
    )

@pytest.fixture
def mock_anthropic_client(mocker):
    """Mock Anthropic client that returns deterministic responses"""
    ...

@pytest.fixture
def mock_perplexity_client(mocker):
    """Mock Perplexity client for domain validation tests"""
    ...
```

### Unit Tests

#### Model Validation Tests

```python
# tests/unit/models/test_finding.py

def test_finding_requires_anchor():
    """Findings must have at least one anchor"""
    with pytest.raises(ValidationError):
        Finding(
            agent_id=AgentId.CLARITY_INSPECTOR,
            category=FindingCategory.CLARITY_SENTENCE,
            severity=Severity.MINOR,
            confidence=0.8,
            title="Test",
            description="Test description",
            anchors=[],  # Empty - should fail
        )

def test_finding_confidence_bounds():
    """Confidence must be between 0 and 1"""
    with pytest.raises(ValidationError):
        Finding(..., confidence=1.5)

def test_anchor_requires_quoted_text():
    """Anchors must include quoted text"""
    with pytest.raises(ValidationError):
        Anchor(paragraph_id="p_001", quoted_text="")
```

#### Parser Unit Tests

```python
# tests/unit/parsers/test_docx_parser.py

async def test_parse_simple_docx(sample_docx_path):
    """Basic DOCX parsing produces valid DocObj"""
    doc = await parse_docx(sample_docx_path)
    
    assert doc.type == "docx"
    assert len(doc.paragraphs) > 0
    assert all(p.id.startswith("p_") for p in doc.paragraphs)
    assert all(p.text for p in doc.paragraphs)

async def test_paragraph_sentence_ids_are_valid(sample_docx_path):
    """Sentence IDs follow expected pattern"""
    doc = await parse_docx(sample_docx_path)
    
    for para in doc.paragraphs:
        for sent in para.sentences:
            assert sent.id.startswith(para.id)
            assert sent.paragraph_id == para.id

async def test_character_offsets_are_accurate(sample_docx_path):
    """Sentence character offsets match actual text positions"""
    doc = await parse_docx(sample_docx_path)
    
    for para in doc.paragraphs:
        for sent in para.sentences:
            extracted = para.text[sent.start_char:sent.end_char]
            assert extracted == sent.text

async def test_xml_paths_are_valid(sample_docx_path):
    """XML paths can locate original elements"""
    doc = await parse_docx(sample_docx_path)
    
    # Re-parse and verify paths
    for para in doc.paragraphs:
        if para.xml_path:
            # Verify we can find this element
            assert validate_xml_path(sample_docx_path, para.xml_path)
```

### Integration Tests

#### Document Flow

```python
# tests/integration/test_document_flow.py

async def test_upload_and_parse_docx(client, sample_docx_path):
    """Complete flow: upload DOCX → parse → retrieve"""
    # Upload
    with open(sample_docx_path, "rb") as f:
        response = await client.post(
            "/document/parse",
            files={"file": ("test.docx", f, "application/vnd.openxmlformats...")}
        )
    
    assert response.status_code == 200
    doc_id = response.json()["document"]["id"]
    
    # Retrieve
    response = await client.get(f"/document/{doc_id}")
    assert response.status_code == 200
    doc = response.json()
    
    assert doc["type"] == "docx"
    assert len(doc["paragraphs"]) > 0

async def test_parse_handles_complex_docx(client):
    """Parser handles documents with figures, tables, etc."""
    # Use a more complex fixture
    ...
```

#### Review Flow

```python
# tests/integration/test_review_flow.py

async def test_review_lifecycle(client, sample_doc_obj, mock_anthropic_client):
    """Complete review: start → events → result"""
    # Store document
    await job_manager.store_document(sample_doc_obj)
    
    # Start review
    response = await client.post("/review/start", json={
        "documentId": sample_doc_obj.id,
        "config": {
            "tier": "standard",
            "focusDimensions": ["clarity"],
            "enableAdversarial": False,
            "enableDomainValidation": False,
        }
    })
    
    assert response.status_code == 200
    job_id = response.json()["jobId"]
    
    # Collect SSE events
    events = []
    async with client.stream("GET", f"/review/{job_id}/events") as response:
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:]))
            if any(e.get("type") == "review_completed" for e in events):
                break
    
    # Verify event sequence
    event_types = [e["type"] for e in events]
    assert "phase_started" in event_types
    assert "review_completed" in event_types
    
    # Get result
    response = await client.get(f"/review/{job_id}/result")
    assert response.status_code == 200
    result = response.json()
    
    assert len(result["job"]["findings"]) > 0
```

### Agent Tests

Agent tests use mock LLM responses to ensure deterministic behavior.

```python
# tests/agents/test_clarity_inspector.py

@pytest.fixture
def mock_clarity_response():
    """Deterministic response for clarity analysis"""
    return {
        "findings": [{
            "category": "clarity_sentence",
            "severity": "minor",
            "confidence": 0.85,
            "title": "Ambiguous pronoun",
            "description": "The pronoun 'it' is unclear",
            "anchors": [{
                "paragraph_id": "p_001",
                "sentence_id": "p_001_s_002",
                "quoted_text": "it showed improvement"
            }],
            "proposed_edit": {
                "type": "replace",
                "new_text": "the model showed improvement",
                "rationale": "Clarifies subject"
            }
        }]
    }

async def test_clarity_inspector_produces_valid_findings(
    sample_doc_obj, 
    mock_anthropic_client,
    mock_clarity_response
):
    """Clarity inspector returns properly structured findings"""
    mock_anthropic_client.complete_structured.return_value = mock_clarity_response
    
    agent = ClarityInspector(mock_anthropic_client, ReviewTier.STANDARD)
    findings = await agent.analyze(sample_doc_obj, ReviewConfig(...))
    
    assert len(findings) == 1
    assert findings[0].category == FindingCategory.CLARITY_SENTENCE
    assert findings[0].anchors[0].paragraph_id == "p_001"

async def test_clarity_inspector_handles_empty_document(mock_anthropic_client):
    """Clarity inspector handles documents with no content"""
    empty_doc = DocObj(paragraphs=[], ...)
    
    agent = ClarityInspector(mock_anthropic_client, ReviewTier.STANDARD)
    findings = await agent.analyze(empty_doc, ReviewConfig(...))
    
    assert findings == []
```

### Testing with Real LLMs (Optional)

For occasional validation against real models:

```python
# tests/agents/test_clarity_inspector_live.py

@pytest.mark.live_llm  # Skip in CI
@pytest.mark.slow
async def test_clarity_inspector_with_real_model():
    """Validate agent behavior with actual LLM"""
    client = AnthropicClient()  # Real client
    
    doc = create_doc_with_known_issues()
    agent = ClarityInspector(client, ReviewTier.STANDARD)
    
    findings = await agent.analyze(doc, ReviewConfig(...))
    
    # Verify it finds the known issues
    assert any("ambiguous" in f.title.lower() for f in findings)
```

Run with: `pytest -m live_llm`

---

## Frontend Testing (`apps/web/src/__tests__/`)

### Directory Structure

```
__tests__/
├── setup.ts                 # Test setup, mocks
├── components/
│   ├── ui/
│   └── domain/
│       ├── DocumentViewer.test.tsx
│       └── FindingCard.test.tsx
├── hooks/
│   ├── useReviewState.test.ts
│   └── useSSE.test.ts
├── screens/
│   ├── UploadScreen.test.tsx
│   ├── SetupScreen.test.tsx
│   └── ReviewScreen.test.tsx
└── e2e/
    ├── demo-flow.spec.ts
    └── review-flow.spec.ts
```

### Component Tests

```typescript
// __tests__/components/domain/FindingCard.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { FindingCard } from '@/components/domain/FindingCard';

const mockFinding: Finding = {
  id: 'f_001',
  agentId: 'clarity_inspector',
  category: 'clarity_sentence',
  severity: 'minor',
  confidence: 0.85,
  title: 'Ambiguous pronoun',
  description: 'The pronoun is unclear',
  anchors: [{ paragraphId: 'p_001', quotedText: 'it showed' }],
};

describe('FindingCard', () => {
  it('displays finding information', () => {
    render(<FindingCard finding={mockFinding} />);
    
    expect(screen.getByText('Ambiguous pronoun')).toBeInTheDocument();
    expect(screen.getByText('minor')).toBeInTheDocument();
  });
  
  it('calls onAccept when accept button clicked', () => {
    const onAccept = vi.fn();
    render(<FindingCard finding={mockFinding} onAccept={onAccept} />);
    
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    
    expect(onAccept).toHaveBeenCalledWith(mockFinding.id);
  });
  
  it('shows proposed edit when available', () => {
    const findingWithEdit = {
      ...mockFinding,
      proposedEdit: {
        type: 'replace',
        newText: 'the model showed',
        rationale: 'Clarifies subject',
      },
    };
    
    render(<FindingCard finding={findingWithEdit} />);
    
    expect(screen.getByText(/view suggestion/i)).toBeInTheDocument();
  });
});
```

### Hook Tests

```typescript
// __tests__/hooks/useReviewState.test.ts

import { renderHook, act } from '@testing-library/react';
import { useReviewState } from '@/hooks/useReviewState';

describe('useReviewState', () => {
  const mockDoc = { id: 'doc_001', paragraphs: [] };
  const mockFindings = [
    { id: 'f_001', severity: 'major' },
    { id: 'f_002', severity: 'minor' },
  ];

  it('initializes with correct counts', () => {
    const { result } = renderHook(() => 
      useReviewState(mockDoc, mockFindings)
    );
    
    expect(result.current.stats.total).toBe(2);
    expect(result.current.stats.pending).toBe(2);
    expect(result.current.stats.accepted).toBe(0);
  });

  it('updates stats when finding accepted', () => {
    const { result } = renderHook(() => 
      useReviewState(mockDoc, mockFindings)
    );
    
    act(() => {
      result.current.acceptFinding('f_001');
    });
    
    expect(result.current.stats.accepted).toBe(1);
    expect(result.current.stats.pending).toBe(1);
  });

  it('filters findings by severity', () => {
    const { result } = renderHook(() => 
      useReviewState(mockDoc, mockFindings)
    );
    
    act(() => {
      result.current.setFilter({ severity: 'major' });
    });
    
    expect(result.current.filteredFindings).toHaveLength(1);
    expect(result.current.filteredFindings[0].id).toBe('f_001');
  });
});
```

### E2E Tests (Playwright)

```typescript
// __tests__/e2e/demo-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Demo Mode Flow', () => {
  test('complete demo review flow', async ({ page }) => {
    // Upload screen
    await page.goto('/upload');
    await page.selectOption('[data-testid="demo-select"]', 'manuscript');
    await page.click('[data-testid="upload-button"]');
    
    // Setup screen
    await expect(page).toHaveURL('/setup');
    await page.click('[data-testid="demo-toggle"]');
    await page.click('[data-testid="start-review"]');
    
    // Review screen (skips process in demo mode)
    await expect(page).toHaveURL('/review');
    await expect(page.locator('[data-testid="finding-card"]')).toHaveCount.greaterThan(0);
    
    // Accept a finding
    await page.click('[data-testid="finding-card"]:first-child [data-testid="accept-btn"]');
    await expect(page.locator('[data-testid="accepted-count"]')).toContainText('1');
    
    // Go to export
    await page.click('[data-testid="export-button"]');
    await expect(page).toHaveURL('/export');
  });
});
```

---

## Test Data Management

### Mock LLM Responses

Store deterministic mock responses for each agent:

```
tests/fixtures/mock_responses/
├── context_builder/
│   ├── simple_manuscript.json
│   └── complex_manuscript.json
├── clarity_inspector/
│   ├── clear_document.json
│   └── unclear_document.json
├── rigor_inspector/
│   └── ...
└── ...
```

### Sample Documents

```
tests/fixtures/
├── sample_docx/
│   ├── simple.docx           # Basic document
│   ├── with_figures.docx     # Has inline figures
│   ├── with_textboxes.docx   # Figures in text boxes
│   └── complex.docx          # Tables, references, etc.
└── sample_pdf/
    ├── simple.pdf
    └── multi_column.pdf
```

---

## Running Tests

### Backend

```bash
cd apps/api

# All tests
pytest

# With coverage
pytest --cov=src --cov-report=html

# Specific file
pytest tests/unit/parsers/test_docx_parser.py

# Specific test
pytest -k "test_parse_simple_docx"

# Skip slow/live tests
pytest -m "not slow and not live_llm"

# Parallel execution
pytest -n auto
```

### Frontend

```bash
cd apps/web

# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# E2E tests
npx playwright test
```

### CI Configuration

```yaml
# .github/workflows/test.yml

name: Tests
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: |
          cd apps/api
          pip install -e ".[dev]"
          pytest --cov=src -m "not live_llm"
  
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: |
          cd apps/web
          npm ci
          npm test -- --coverage
```

---

## Coverage Goals

| Component | Target | Priority |
|-----------|--------|----------|
| Pydantic models | 100% | High |
| Parsers | 90%+ | High |
| Agents | 80%+ | High |
| API routes | 90%+ | High |
| UI components | 70%+ | Medium |
| E2E critical paths | 100% | High |

Focus coverage on:
- Data model validation
- Parser correctness
- Agent output structure
- Error handling paths
