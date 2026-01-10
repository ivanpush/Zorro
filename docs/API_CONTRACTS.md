# API Contracts

OpenAPI-style specifications for all ZORRO API endpoints.

---

## Base URL

```
Development: http://localhost:8000
Production: https://api.zorro.example.com
```

## Authentication

MVP: No authentication (single-user mode)
Phase 2: Bearer token authentication

---

## Endpoints Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/document/parse` | Upload and parse a document |
| GET | `/document/{id}` | Retrieve parsed document |
| POST | `/review/start` | Start a review job |
| GET | `/review/{id}/events` | SSE stream of review progress |
| GET | `/review/{id}/result` | Get completed review results |
| POST | `/review/{id}/cancel` | Cancel a running review |
| POST | `/export` | Generate reviewed document |

---

## Document Endpoints

### POST /document/parse

Upload and parse a document into a DocObj.

**Request**

```
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | .docx or .pdf file |
| title | string | No | Override document title |

**Response 200**

```json
{
  "document": {
    "id": "doc_a1b2c3d4",
    "filename": "manuscript.docx",
    "type": "docx",
    "title": "Effects of Climate Change on Migration Patterns",
    "sections": [
      {
        "id": "sec_001",
        "index": 0,
        "title": "Abstract",
        "level": 1,
        "paragraphIds": ["p_001"]
      }
    ],
    "paragraphs": [
      {
        "id": "p_001",
        "sectionId": "sec_001",
        "index": 0,
        "text": "This study examines...",
        "sentences": [
          {
            "id": "p_001_s_001",
            "paragraphId": "p_001",
            "index": 0,
            "text": "This study examines...",
            "startChar": 0,
            "endChar": 45
          }
        ]
      }
    ],
    "figures": [],
    "references": [],
    "metadata": {
      "pageCount": 12,
      "wordCount": 4523,
      "characterCount": 28456
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response 400**

```json
{
  "error": "Invalid file type",
  "code": "INVALID_FILE_TYPE",
  "details": {
    "received": "application/pdf",
    "accepted": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf"]
  }
}
```

---

### GET /document/{id}

Retrieve a previously parsed document.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Response 200**: Same as POST /document/parse response.

**Response 404**

```json
{
  "error": "Document not found",
  "code": "NOT_FOUND"
}
```

---

## Review Endpoints

### POST /review/start

Start a new review job.

**Request**

```json
{
  "documentId": "doc_a1b2c3d4",
  "config": {
    "tier": "standard",
    "focusDimensions": ["argumentation", "methodology", "clarity"],
    "domainHint": "biomedical research",
    "steeringMemo": "Focus on statistical methods",
    "enableAdversarial": true,
    "enableDomainValidation": true
  }
}
```

**Response 200**

```json
{
  "jobId": "job_x1y2z3",
  "status": "pending",
  "message": "Review job created"
}
```

---

### GET /review/{id}/events

Server-Sent Events stream of review progress.

**Response 200**

```
Content-Type: text/event-stream
```

**Event Types**

```
event: phase_started
data: {"type":"phase_started","phase":"briefing","timestamp":"..."}

event: agent_started
data: {"type":"agent_started","agentId":"clarity_inspector","timestamp":"..."}

event: finding_discovered
data: {"type":"finding_discovered","finding":{...},"timestamp":"..."}

event: review_completed
data: {"type":"review_completed","totalFindings":23,"timestamp":"..."}

event: error
data: {"type":"error","message":"Domain validation failed","recoverable":true}
```

---

### GET /review/{id}/result

Get the complete results of a review.

**Response 200** (completed)

```json
{
  "job": {
    "id": "job_x1y2z3",
    "documentId": "doc_a1b2c3d4",
    "status": "completed",
    "findings": [...],
    "startedAt": "...",
    "completedAt": "..."
  },
  "document": { ... }
}
```

**Response 202** (still running)

```json
{
  "job": {
    "id": "job_x1y2z3",
    "status": "analyzing",
    "currentPhase": "rigor_detection"
  },
  "message": "Review in progress"
}
```

---

### POST /review/{id}/cancel

Cancel a running review job.

**Response 200**

```json
{
  "jobId": "job_x1y2z3",
  "status": "cancelled"
}
```

---

## Export Endpoint

### POST /export

Generate a reviewed document with tracked changes.

**Request**

```json
{
  "documentId": "doc_a1b2c3d4",
  "decisions": [
    {
      "id": "dec_001",
      "findingId": "f_001",
      "action": "accept_edit",
      "finalText": "the model showed improved performance"
    },
    {
      "id": "dec_002",
      "findingId": "f_002",
      "action": "dismiss"
    }
  ],
  "format": "docx",
  "options": {
    "includeUnresolvedAsComments": true,
    "trackChangesAuthor": "ZORRO Review"
  }
}
```

**Response 200**

```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="manuscript_ZORRO_2024-01-15.docx"

[Binary DOCX content]
```

---

## Error Response Format

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "details": {}
}
```

| Code | HTTP | Description |
|------|------|-------------|
| NOT_FOUND | 404 | Resource not found |
| INVALID_FILE_TYPE | 400 | Unsupported file type |
| INVALID_CONFIG | 400 | Invalid review config |
| PARSE_ERROR | 422 | Document parsing failed |
| INTERNAL_ERROR | 500 | Server error |
