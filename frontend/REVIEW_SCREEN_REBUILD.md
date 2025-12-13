# ReviewScreen Rebuild Summary

**Date**: 2024-12-13

## What Was Built

### 1. **ReviewScreen.tsx** - Main layout component
- 70/30 split layout (manuscript left, issues right)
- Loads data from `/reviews/manuscript_pdf_fullreview.json` fixture
- Manages selected issue state and accept/dismiss actions
- Handles bidirectional linking between paragraphs and issues
- Auto-builds document structure from issues data

### 2. **ManuscriptView.tsx** - Left panel component
- Renders document sections and paragraphs
- Highlights paragraphs that have issues (yellow background)
- Highlights selected paragraph (orange background with border)
- Shows severity badges on paragraphs with issues
- Clicking a paragraph selects its first issue

### 3. **IssuesPanel.tsx** - Right panel component
- Lists all issues with severity badges
- Expandable cards showing full details
- Accept/Dismiss buttons for each issue
- Shows status (Accepted/Dismissed) badges
- Undo functionality for accepted/dismissed issues

## Data Flow

1. **On mount**: ReviewScreen checks sessionStorage for mode
   - If static/demo: Loads from `/reviews/manuscript_pdf_fullreview.json`
   - Builds document structure from issues data
   - Maps issues to Finding format

2. **Issue Selection**:
   - Click issue → Scroll manuscript to paragraph
   - Click paragraph → Select first issue, scroll panel to it

3. **State Management**:
   - Local state for selectedIssueId, acceptedIssueIds, dismissedIssueIds
   - Document and findings stored in Zustand store

## Key Features

### Functionality-First Design
- Simple, clean layout without excessive styling
- Focus on core interactions
- Responsive scrolling and highlighting
- Clear visual feedback for states

### Smart Data Parsing
- Automatically builds document structure from issues
- Handles missing data gracefully
- Maps JSON fields to TypeScript types correctly

### Issue-Paragraph Linking
- Bidirectional navigation
- Smooth scrolling to targets
- Visual highlighting of connections

## Files Created/Modified

1. `/src/screens/ReviewScreen.tsx` - Complete rewrite
2. `/src/components/domain/ManuscriptView.tsx` - New component
3. `/src/components/domain/IssuesPanel.tsx` - New component

## Testing

The application is running at http://localhost:5176/

To test:
1. Navigate to the app
2. Go through upload flow or go directly to /review
3. Should see document on left, issues on right
4. Click issues to highlight paragraphs
5. Click paragraphs to select issues
6. Accept/Dismiss issues and see status updates

## Next Steps (if needed)

- Add export functionality
- Add figures panel at bottom
- Enhance styling if desired
- Add keyboard shortcuts
- Add filtering for issues panel