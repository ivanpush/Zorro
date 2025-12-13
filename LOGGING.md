# Logging & Observability Standards

This document defines logging practices, structured logging formats, and observability patterns for ZORRO.

---

## Core Principles

1. **Structured Logging** — Always use key-value pairs, never interpolated strings
2. **Contextual** — Include request/job context in all logs
3. **Leveled** — Use appropriate log levels consistently
4. **Safe** — Never log document content, PII, or secrets
5. **Actionable** — Logs should help debug issues

---

## Backend Logging (Python)

### Setup

Use `structlog` for structured JSON logging:

```python
# apps/api/src/logging_config.py

import structlog
import logging

def configure_logging(log_level: str = "INFO"):
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )
```

### Getting a Logger

```python
import structlog

logger = structlog.get_logger()

# Basic usage
logger.info("server_started", port=8000, env="production")

# With context
logger.info("document_parsed", 
    doc_id="abc123",
    doc_type="docx",
    paragraph_count=47,
    duration_ms=234
)
```

### Log Levels

| Level | Use Case | Examples |
|-------|----------|----------|
| DEBUG | Detailed debugging info | Parser internal state, prompt details |
| INFO | Normal operations | Request received, agent started, job completed |
| WARNING | Unexpected but recoverable | Retry triggered, fallback used |
| ERROR | Failures requiring attention | Agent failed, parse error, API error |

### Request Context

Bind context for all logs within a request:

```python
# apps/api/src/middleware/logging.py

from starlette.middleware.base import BaseHTTPMiddleware
import structlog
from uuid import uuid4

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = str(uuid4())[:8]
        
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
        
        logger.info("request_started")
        
        try:
            response = await call_next(request)
            logger.info("request_completed", status=response.status_code)
            return response
        except Exception as e:
            logger.exception("request_failed")
            raise
```

---

## Standard Log Events

### Document Lifecycle

```python
# Parse started
logger.info("document_parse_started",
    filename="paper.docx",
    file_size_bytes=245678
)

# Parse completed
logger.info("document_parse_completed",
    doc_id="abc123",
    doc_type="docx",
    section_count=6,
    paragraph_count=47,
    figure_count=3,
    word_count=5234,
    duration_ms=1234
)

# Parse failed
logger.error("document_parse_failed",
    filename="paper.docx",
    error="Invalid DOCX structure",
    error_type="ParseError"
)
```

### Review Lifecycle

```python
# Review started
logger.info("review_started",
    job_id="job123",
    doc_id="abc123",
    tier="standard",
    focus_dimensions=["clarity", "rigor"]
)

# Phase transition
logger.info("review_phase_started",
    job_id="job123",
    phase="analysis",
    agents=["clarity_inspector", "rigor_inspector"]
)

# Agent started
logger.info("agent_started",
    job_id="job123",
    agent="clarity_inspector",
    model="claude-3-haiku"
)

# Agent completed
logger.info("agent_completed",
    job_id="job123",
    agent="clarity_inspector",
    findings_count=12,
    duration_ms=3456,
    tokens_used=1234
)

# Agent failed
logger.error("agent_failed",
    job_id="job123",
    agent="domain_validator",
    error="Rate limit exceeded",
    will_retry=True
)

# Review completed
logger.info("review_completed",
    job_id="job123",
    total_findings=34,
    by_severity={"critical": 2, "major": 8, "minor": 15, "suggestion": 9},
    total_duration_ms=12345
)
```

### LLM API Calls

```python
# API call started
logger.debug("llm_request_started",
    model="claude-3-sonnet",
    prompt_tokens_estimate=2345,
    purpose="clarity_local_pass"
)

# API call completed
logger.info("llm_request_completed",
    model="claude-3-sonnet",
    input_tokens=2345,
    output_tokens=567,
    duration_ms=2345,
    purpose="clarity_local_pass"
)

# API call failed
logger.warning("llm_request_failed",
    model="claude-3-sonnet",
    error="rate_limit",
    retry_after_ms=5000,
    attempt=2
)
```

### Export

```python
# Export started
logger.info("export_started",
    doc_id="abc123",
    format="docx",
    findings_count=34,
    edits_count=12
)

# Export completed
logger.info("export_completed",
    doc_id="abc123",
    format="docx",
    output_size_bytes=267890,
    duration_ms=890
)
```

---

## What NOT to Log

### Never Log

- **Document content** — No paragraph text, sentences, or quotes
- **Finding details** — No descriptions or proposed edits
- **API keys** — Never, even partially
- **User-provided text** — Steering memos, domain hints (truncate if necessary)

### Truncation Rules

If you must log user input:

```python
def safe_truncate(text: str, max_len: int = 50) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len] + "..."

logger.info("config_received",
    domain_hint=safe_truncate(config.domain_hint, 30),
    has_steering_memo=bool(config.steering_memo)
)
```

---

## Frontend Logging (TypeScript)

### Setup

Use a simple structured logger:

```typescript
// apps/web/src/lib/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel = 'info';
  
  setLevel(level: LogLevel) {
    this.level = level;
  }
  
  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    };
    
    if (process.env.NODE_ENV === 'development') {
      console[level](JSON.stringify(entry));
    }
    
    // In production, could send to logging service
  }
  
  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }
  
  error(message: string, data?: Record<string, unknown>) {
    this.log('error', message, data);
  }
}

export const logger = new Logger();
```

### Usage

```typescript
// Navigation
logger.info('screen_viewed', { screen: 'upload' });

// User actions
logger.info('file_selected', { 
  type: file.type, 
  sizeBytes: file.size 
});

logger.info('finding_accepted', { 
  findingId: finding.id,
  severity: finding.severity 
});

// API calls
logger.info('api_request_started', { 
  endpoint: '/review/start',
  method: 'POST' 
});

logger.error('api_request_failed', { 
  endpoint: '/review/start',
  status: 500,
  error: 'Internal server error'
});

// SSE events
logger.debug('sse_event_received', { 
  type: event.type,
  jobId: jobId 
});
```

---

## Metrics & Tracing

### Key Metrics to Track

| Metric | Type | Description |
|--------|------|-------------|
| `document_parse_duration_ms` | Histogram | Time to parse documents |
| `review_duration_ms` | Histogram | Total review time |
| `agent_duration_ms` | Histogram | Per-agent duration (labeled by agent) |
| `llm_tokens_used` | Counter | Token usage (labeled by model) |
| `llm_request_duration_ms` | Histogram | LLM latency |
| `findings_per_review` | Histogram | Finding count distribution |
| `error_count` | Counter | Errors (labeled by type) |

### Implementation (Optional)

```python
# apps/api/src/metrics.py

from prometheus_client import Counter, Histogram

DOCUMENT_PARSE_DURATION = Histogram(
    'document_parse_duration_ms',
    'Document parsing duration in milliseconds',
    ['doc_type']
)

LLM_REQUEST_DURATION = Histogram(
    'llm_request_duration_ms',
    'LLM request duration in milliseconds',
    ['model', 'agent']
)

LLM_TOKENS_USED = Counter(
    'llm_tokens_used_total',
    'Total tokens used',
    ['model', 'direction']  # direction: input/output
)

# Usage
with DOCUMENT_PARSE_DURATION.labels(doc_type="docx").time():
    doc = await parse_docx(path)

LLM_TOKENS_USED.labels(model="claude-3-sonnet", direction="input").inc(2345)
```

---

## Error Handling & Alerts

### Error Categories

```python
class ErrorCategory(str, Enum):
    PARSE_ERROR = "parse_error"
    LLM_ERROR = "llm_error"
    VALIDATION_ERROR = "validation_error"
    EXPORT_ERROR = "export_error"
    INTERNAL_ERROR = "internal_error"

logger.error("operation_failed",
    category=ErrorCategory.LLM_ERROR,
    operation="agent_analysis",
    agent="rigor_inspector",
    error_message="Rate limit exceeded",
    recoverable=True
)
```

### Alert Conditions

Configure alerts for:

| Condition | Threshold | Severity |
|-----------|-----------|----------|
| Error rate | >5% of requests | Warning |
| Error rate | >10% of requests | Critical |
| LLM latency p99 | >30 seconds | Warning |
| Parse failure rate | >2% | Warning |
| Review completion rate | <90% | Warning |

---

## Log Retention

| Environment | Retention | Format |
|-------------|-----------|--------|
| Development | Session only | Console |
| Staging | 7 days | JSON files |
| Production | 30 days | Cloud logging service |

---

## Debugging Tips

### Tracing a Request

1. Get request_id from response headers or logs
2. Filter logs by request_id
3. Follow the timeline: request → parse → agents → synthesis → response

### Debugging Agent Issues

```python
# Enable debug logging for specific agent
logger.debug("agent_input",
    agent="rigor_inspector",
    paragraph_count=len(doc.paragraphs),
    context_available=context is not None
)

logger.debug("agent_prompt_sent",
    agent="rigor_inspector",
    prompt_tokens=estimate_tokens(prompt),
    model=model
)

logger.debug("agent_response_received",
    agent="rigor_inspector",
    response_tokens=response.usage.output_tokens,
    findings_raw_count=len(response.findings)
)
```

### Common Log Queries

```bash
# Find all errors for a job
grep '"job_id":"job123"' logs.json | grep '"level":"error"'

# Find slow LLM requests
jq 'select(.duration_ms > 10000 and .message == "llm_request_completed")' logs.json

# Count findings by severity
jq 'select(.message == "review_completed") | .by_severity' logs.json
```
