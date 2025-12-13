# ZORRO Review System

An automated review assistant that surfaces structural, logical, and communicative weaknesses in professional documents before formal peer review.

## What It Does

ZORRO runs a structured analysis pipeline of specialist AI agents that inspect documents from distinct perspectives:
- **Context Builder** — Extracts claims, scope, and limitations
- **Clarity Inspector** — Flags readability, flow, and structural issues  
- **Rigor Inspector** — Detects methodological and logical problems
- **Adversarial Critic** — Surfaces overclaims, missing controls, blind spots
- **Domain Validator** — Validates field-specific expectations via web search

Each agent produces text-anchored findings for human adjudication. Users accept, dismiss, or edit suggestions, then export reviewer-ready documents with tracked changes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React/Vite)                         │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────┤
│   Upload    │    Setup    │   Process   │   Review    │   Export   │
│   Screen    │   Screen    │   Screen    │  Workspace  │   Screen   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴─────┬──────┘
       │             │             │             │            │
       ▼             ▼             ▼             ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API LAYER (FastAPI)                            │
├─────────────────────────────────────────────────────────────────────┤
│  POST /document/parse    │  POST /review/start                      │
│  GET  /review/{id}/events (SSE)                                     │
│  GET  /review/{id}/result                                           │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ANALYSIS ENGINE                                  │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────┤
│   Context   │   Clarity   │    Rigor    │ Adversarial │   Domain   │
│   Builder   │  Inspector  │  Inspector  │   Critic    │ Validator  │
│  (Sonnet)   │  (Haiku)    │  (Sonnet)   │  (Sonnet)   │(Perplexity)│
└─────────────┴─────────────┴─────────────┴─────────────┴────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  SYNTHESIS ENGINE (Non-LLM)                         │
│  Deduplication → Normalization → Rubric Computation                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### DocObj (Document Object)
The immutable, indexed representation of a parsed document. Created once during upload, never modified. All agents read from it, all findings reference it by stable paragraph/sentence IDs.

### Demo Mode vs Dynamic Mode
- **Demo Mode**: Uses pre-built fixtures, no API calls. For UI development and demos.
- **Dynamic Mode**: Runs live agents with real API calls.

### Review Tiers
| Tier | Models | Agents | Use Case |
|------|--------|--------|----------|
| Standard | Haiku (clarity), Sonnet (others) | All | Pre-submission |
| Deep | Sonnet (clarity), Opus (others) | All + enhanced | High-stakes |

## Tech Stack

**Frontend**
- React 18+ with TypeScript
- Vite build
- Tailwind CSS
- Axios + SSE for real-time updates

**Backend**
- Python 3.11+
- FastAPI with async
- Pydantic v2 for validation
- PyMuPDF (PDF), python-docx (DOCX)

**AI Services**
- Anthropic API (Claude models for analysis)
- Perplexity API (web search for domain validation)

## Project Structure

```
zorro-review/
├── README.md
├── CLAUDE.md                 # Instructions for AI coding assistants
├── BUILD_PHASES.md           # Build plan with Claude Code prompts
├── docs/
│   ├── ARCHITECTURE.md       # Detailed system design
│   ├── DATA_CONTRACTS.md     # All types and schemas (DocObj, Finding, etc.)
│   ├── API_CONTRACTS.md      # OpenAPI specs for all endpoints
│   ├── BEHAVIORS.md          # Agent behavior specifications
│   ├── PROMPTS.md            # All LLM prompts with rationale
│   ├── TESTING.md            # Testing strategy
│   └── LOGGING.md            # Observability standards
├── apps/
│   ├── web/                  # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── screens/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── fixtures/     # Demo mode data
│   │   └── package.json
│   └── api/                  # FastAPI backend
│       ├── src/
│       │   ├── routers/
│       │   ├── services/
│       │   ├── agents/
│       │   ├── parsers/
│       │   └── models/
│       ├── tests/
│       └── pyproject.toml
└── packages/
    └── shared/               # Shared TypeScript types (generated from Pydantic)
```

## Quick Start

```bash
# Clone and install
git clone <repo>
cd zorro-review

# Backend
cd apps/api
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# Frontend
cd ../web
npm install

# Environment
cp .env.example .env
# Add ANTHROPIC_API_KEY and PERPLEXITY_API_KEY

# Run (separate terminals)
cd apps/api && uvicorn src.main:app --reload
cd apps/web && npm run dev
```

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...

# Optional
LOG_LEVEL=INFO
MAX_DOCUMENT_PAGES=100
```

## Development Modes

### Demo Mode (no API calls)
Select "Demo" toggle on setup screen. Uses pre-built fixtures for instant results.

### Dynamic Mode (live analysis)
Select "Dynamic" toggle. Runs full agent pipeline with real API calls.

## Documentation

- [Architecture Deep Dive](docs/ARCHITECTURE.md)
- [Data Contracts](docs/DATA_CONTRACTS.md)
- [API Reference](docs/API_CONTRACTS.md)
- [Agent Behaviors](docs/BEHAVIORS.md)
- [LLM Prompts](docs/PROMPTS.md)
- [Testing Guide](docs/TESTING.md)
- [Logging Standards](docs/LOGGING.md)
- [Build Phases](BUILD_PHASES.md)

## License

Proprietary - All rights reserved
