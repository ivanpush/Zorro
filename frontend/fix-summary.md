# Fix Summary: FindingCard Anchor Error

**Date**: 2024-12-13
**Error**: `Uncaught TypeError: Cannot read properties of undefined (reading 'quoted_text')`
**Location**: FindingCard.tsx:175

## Root Cause
The FindingCard component was trying to access `finding.anchors[0].quoted_text` without checking if:
1. The anchors array exists
2. The array has at least one element
3. The quoted_text property exists

Additionally, the `loadDemoFindings` function was creating findings without anchors when issues in the JSON didn't have a `paragraph_id`.

## Fixes Applied

### 1. FindingCard Component (FindingCard.tsx)
- Added null/undefined checks before accessing anchor properties
- Line 174-178: Added conditional rendering for quoted text display
- Line 189-203: Added checks for the anchors array in the expanded view
- Now only renders quoted text sections when data is available

### 2. Fixtures Service (fixtures.ts)
- Modified `loadDemoFindings` to skip issues without `paragraph_id`
- Ensures all findings have at least one anchor with quoted_text
- Added fallback text (using message) if quoted_text is missing
- Added console warning when skipping malformed issues

## Changes Made

### Before (FindingCard.tsx):
```tsx
<div className="mt-3 p-2 bg-muted/50 rounded text-xs italic line-clamp-2">
  "{finding.anchors[0].quoted_text}"
</div>
```

### After (FindingCard.tsx):
```tsx
{finding.anchors && finding.anchors.length > 0 && finding.anchors[0].quoted_text && (
  <div className="mt-3 p-2 bg-muted/50 rounded text-xs italic line-clamp-2">
    "{finding.anchors[0].quoted_text}"
  </div>
)}
```

### Before (fixtures.ts):
```typescript
anchors: [],
// ...
if (issue.paragraph_id) {
  finding.anchors.push({...});
}
```

### After (fixtures.ts):
```typescript
// Skip issues without proper paragraph anchoring
if (!issue.paragraph_id) {
  console.warn('Skipping issue without paragraph_id:', issue);
  return;
}

anchors: [
  {
    paragraph_id: issue.paragraph_id,
    sentence_id: issue.sentence_ids?.[0],
    quoted_text: issue.original_text || issue.quoted_text || issue.message || '',
  }
],
```

## Result
✅ No more undefined property errors
✅ Component gracefully handles missing data
✅ Only valid findings with proper anchors are displayed
✅ Console warnings for debugging malformed data