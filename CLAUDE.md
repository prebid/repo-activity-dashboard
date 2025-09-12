# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A TypeScript Node.js application that fetches GitHub repository activity data, currently being transformed into a production-ready Next.js dashboard. The system maintains real-time tracking of open PRs/issues and archives merged PRs and closed issues organized by month. Features advanced rate limiting, pagination support, and concurrent request management.

## Current Status: Next.js Migration
The project is being migrated from a CLI data collection tool to a full-stack Next.js dashboard application. See `NEXTJS_INTEGRATION_PLAN.md` for the complete migration strategy.

## Key Architecture Decisions

### Storage Strategy
- **Open items** stored in single files (`open-prs.json`, `open-issues.json`) for quick access
- **Merged PRs** stored by merge month in `merged/YYYY-MM.json`
- **Closed issues** stored by close month in `closed/YYYY-MM.json`
- **Closed-but-not-merged PRs** are completely ignored (not fetched or stored)
- **Incremental batch saving** during processing to prevent data loss

### API Optimization
- **Full pagination support** for repositories with 100+ items
- **Concurrent request processing** with configurable limits (default: 3-5)
- **Adaptive rate limiting** based on remaining API quota
- **Request queue** with priority ordering and retry logic
- **Burst protection** to avoid secondary rate limits
- Only fetch merged PRs, not all closed PRs
- Use `since` parameter for incremental updates

## Development Commands
- `npm run dev` - Run with ts-node for development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled application
- `npm run clean` - Remove build artifacts

## Project Structure

### Core Services

1. **GitHub Service** (`src/services/githubService.ts`)
   - `fetchOpenPRs(repo, options)` - Get all open PRs with pagination
   - `fetchMergedPRs(repo, since, options)` - Get merged PRs only
   - `fetchOpenIssues(repo, options)` - Get all open issues
   - `fetchClosedIssues(repo, since, options)` - Get closed issues
   - Full pagination support via `fetchAllPages()`
   - Concurrent processing with `processPRs()` and `processIssues()`
   - Options support: `onBatch`, `onProgress`, `maxItems`

2. **Storage Service** (`src/services/storageService.ts`)
   - `saveOpenPRs/Issues()` - Save to single files
   - `saveMergedPRs()` - Archive by merge month with date parsing
   - `saveClosedIssues()` - Archive by close month with date parsing
   - `saveSyncState()` - Track sync metadata
   - Handles date serialization/deserialization when loading JSON
   - Manages file system operations and data deduplication

3. **Data Fetcher** (`src/services/dataFetcher.ts`)
   - `syncRepository()` - Full sync with batch saving
   - `incrementalSync()` - Update only changed items
   - `syncAllRepositories()` - Process all repos sequentially
   - Configurable max concurrent requests
   - Progress reporting and queue statistics

4. **Rate Limit Manager** (`src/services/rateLimitManager.ts`)
   - Tracks primary rate limit from GitHub headers
   - Implements burst protection (300 requests/minute)
   - Calculates optimal delays based on quota:
     - >50% remaining: 50ms delay
     - >20% remaining: 200ms delay  
     - >10% remaining: 500ms delay
     - <10% remaining: 1000ms delay
   - `waitIfNeeded()` - Automatic waiting when limits approached

5. **Request Queue** (`src/services/requestQueue.ts`)
   - Manages concurrent API requests
   - Priority-based request ordering
   - Automatic retry with exponential backoff (up to 3 attempts)
   - Configurable concurrency (default: 3-5)
   - Real-time queue statistics

### Type Definitions

**Core Types** (`src/types/index.ts`):
- `PRData` - Pull request with assignees, reviewers, commits by author Map
- `IssueData` - Issue with assignees array, closure reason
- `Repository` - Parsed repository information
- `CommitAuthorSummary` - Author commit count

**Storage Types** (`src/types/storage.ts`):
- `OpenItemsStorage` - Structure for open items files
- `MonthlyStorage` - Structure for monthly archive files  
- `SyncState` - Tracks sync status and item numbers
- `StorageIndex` - Master index of all repositories

### Data Flow

1. **Full Sync**:
   ```
   GitHub API → Fetch with pagination
   → Process in batches (10 PRs, 20 issues)
   → Save incrementally during pauses
   → Update sync state
   ```

2. **Incremental Sync**:
   ```
   Load sync state → Fetch updates since last sync
   → Compare open item numbers
   → Detect newly merged/closed items
   → Update files accordingly
   ```

## Implementation Guidelines

### TypeScript Best Practices
- Strict type checking enabled
- ES module imports with .js extensions
- Async/await for all asynchronous operations
- Proper error handling with try/catch
- Generic types for reusable components

### File Storage Conventions
- Use `store/` as root directory (not `data/`)
- Repository names sanitized for file system
- JSON files with 2-space indentation
- Maps serialized as objects, Sets as arrays
- Dates require parsing when loading from JSON

### API Usage
- Adaptive delays based on rate limit status
- Maximum 5 concurrent requests by default
- Burst protection at 300 requests/minute
- Check rate limits after each repository
- Filter out pull_request items from issues endpoint
- Handle 404 errors gracefully for missing repos

## Environment Setup
1. Requires `GITHUB_TOKEN` with repo scope
2. Configure repositories in `repos.json`
3. Token must have access to all configured repositories

## Testing

### Test Framework
The project uses **Vitest** for testing - a fast, TypeScript-first test runner with built-in mocking and coverage.

### Test Structure
```
tests/
├── setup.ts              # Global test setup/teardown, handles test store
├── fixtures/            
│   └── testData.ts      # Reusable test data (repos, PRs, issues)
├── unit/                # Unit tests for individual services
│   └── storageService.test.ts
├── integration/         # End-to-end GitHub API tests  
└── mocks/              # Mock services and API responses
```

### Running Tests
```bash
npm test                 # Run all tests once
npm run test:watch       # Watch mode for development
npm run test:ui          # Visual UI for debugging
npm run test:coverage    # Generate coverage report
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
```

### Test Configuration
- **Environment**: Node.js
- **Timeout**: 30 seconds (for API calls)
- **Coverage thresholds**: 80% for lines, functions, branches, statements
- **Isolation**: Tests run in isolation with automatic cleanup
- **Test store**: Temporary `tests/test-store/` directory (auto-cleaned)
- **Config file**: `vitest.config.ts` with path aliases and coverage settings

### Writing Tests
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TEST_STORE_DIR } from '../setup.js';
import { testRepository, mockPRData } from '../fixtures/testData.js';

describe('YourService', () => {
  let service: YourService;
  
  beforeEach(() => {
    service = new YourService(TEST_STORE_DIR);
  });

  it('should handle dateUpdated field correctly', async () => {
    // Test implementation
    expect(result.dateUpdated).toBeInstanceOf(Date);
  });
});
```

### Test Fixtures
The `tests/fixtures/testData.ts` file provides:
- `testRepository` - Sample repository object
- `mockPRData` - Sample PR with dateUpdated
- `mockIssueData` - Sample issue with dateUpdated  
- `generateMockPRs(count)` - Generate multiple test PRs
- `generateMockIssues(count)` - Generate multiple test issues
- `mockGitHubPRResponse` - Raw GitHub API response
- `mockGitHubIssueResponse` - Raw GitHub API response

### Key Test Scenarios
1. **Date field preservation** - Ensure dateUpdated survives save/load cycles
2. **Pagination handling** - Test with 100+ items
3. **Incremental sync** - Detect newly opened/closed items
4. **Deduplication** - Prevent duplicate entries
5. **Monthly organization** - Verify correct date-based filing
6. **Empty repositories** - Handle repos with no items
7. **Rate limiting** - Test adaptive delays and retries

### Test Coverage Areas
- **StorageService**: File operations, date parsing, deduplication
- **GitHubService**: Pagination, rate limiting, error handling
- **DataFetcher**: Sync logic, incremental updates, batch processing
- **RepoParser**: URL parsing, repository loading

## Next.js Dashboard Implementation

### Development Approach
1. **Incremental Implementation**: Add dependencies only when needed for specific features
2. **Hot Module Replacement**: Configured for rapid development with instant updates
3. **Theme System**: Automatic light/dark mode detection with manual override
4. **Data Source**: Use existing JSON files from `store/` directory
5. **Organization Mapping**: Excel file stored externally (S3/HTTP/local) for GitHub username to organization mapping

### Key Implementation Principles
- **NO UNNECESSARY DEPENDENCIES**: Only install packages when implementing features that need them
- **USE EXISTING DATA**: Work with current JSON structure, don't recreate data
- **PRESERVE BACKEND**: Keep all existing data fetching services intact
- **REAL-TIME FEEDBACK**: Use HMR and fast refresh for immediate visual updates
- **USER-SPECIFIED CHARTS**: Don't prescribe chart types - wait for specific requirements

### Dashboard Architecture
```
app/                    # Next.js App Router
├── api/               # API routes using existing services
├── repos/             # Repository views
├── contributors/      # Contributor views
└── organizations/     # Organization analytics (from Excel mapping)

components/
├── ui/                # shadcn/ui components (add as needed)
├── charts/            # Chart components (user-specified)
└── layout/            # Layout components

services/              # EXISTING - Keep all current services
lib/                   # Utilities and data transformations
```

### Development Workflow
1. Start with minimal Next.js setup: `next`, `react`, `react-dom`, `typescript`
2. Add Tailwind/shadcn when building UI: `tailwindcss`, `@radix-ui/*`, `clsx`
3. Add charts when specified: Evaluate options (recharts, tremor, visx)
4. Add Excel support when needed: `xlsx`, `@aws-sdk/client-s3`
5. Add data fetching when needed: `@tanstack/react-query` or `swr`

### Excel Organization Mapping
```typescript
// Load from external source (S3/HTTP/local)
const orgMapping = await loadFromSource(process.env.ORG_MAPPING_SOURCE);
// Maps: githubUsername -> organization
```

### Environment Variables
```env
GITHUB_TOKEN=xxx                    # Existing
ORG_MAPPING_SOURCE=s3://bucket/file.xlsx  # New - Excel file location
AWS_REGION=us-east-1               # If using S3
```

## Common Tasks

### Add a new repository
Add to `repos.json`:
```json
{
  "Category": [{
    "name": "Display Name",
    "url": "https://github.com/owner/repo"
  }]
}
```

### Run a full sync with custom concurrency
```javascript
import { syncAllRepositories } from './src/index.js';
await syncAllRepositories(5); // 5 concurrent requests
```

### Run incremental updates
```javascript
import { incrementalSync } from './src/index.js';
await incrementalSync(); // All repos
await incrementalSync('Prebid.js', 3); // Specific repo with concurrency
```

### Load stored data
```javascript
import { loadStoredData } from './src/index.js';
const data = await loadStoredData('Prebid.js');
console.log(`${data.prs.length} open PRs, ${data.issues.length} open issues`);
```

### Direct GitHub service usage
```javascript
import { GitHubService } from './src/services/githubService.js';
const github = new GitHubService(token, 5); // 5 concurrent

// With batch callback for incremental saving
const prs = await github.fetchOpenPRs(repo, {
  onBatch: async (batch) => {
    console.log(`Processing ${batch.length} PRs`);
    await storage.save(batch);
  },
  onProgress: (current, total) => {
    console.log(`${current}/${total}`);
  }
});
```

## Dashboard Development Guidelines

### When Building Charts
1. **Wait for user specification**: Don't implement charts until the user specifies exactly what they want
2. **Use actual data**: Charts should visualize the existing JSON data from `store/` directory
3. **Consider performance**: Large datasets may need virtualization or pagination
4. **Theme-aware**: Charts must work in both light and dark modes

### API Development
1. **Reuse existing services**: API routes should call existing services from `src/services/`
2. **Cache strategically**: Expensive aggregations should be cached
3. **Return consistent format**: All APIs should return `{ data, meta, pagination? }`

### UI Components
1. **Start minimal**: Begin with basic HTML/CSS, add shadcn/ui components as needed
2. **Mobile-responsive**: Dashboard should work on all screen sizes
3. **Loading states**: Every data fetch should have loading and error states
4. **Accessibility**: Use semantic HTML and ARIA labels

### Performance Targets
- Initial page load: < 2 seconds
- API responses: < 200ms (cached), < 1s (uncached)
- Chart rendering: < 500ms
- Smooth scrolling and interactions (60 FPS)

## Important Notes

- The system only stores open and merged PRs (never closed-but-not-merged)
- Monthly files are organized by merge/close date, not creation date
- Incremental sync detects items that transitioned from open to closed
- All dates are stored in ISO format and must be parsed back to Date objects when loading
- Commit authors are aggregated per PR with count summaries in a Map
- The system handles pagination automatically for large repositories
- Rate limiting is adaptive and adjusts delays based on remaining quota
- Batch saving occurs during processing to prevent data loss on interruption
- Sequential repository processing ensures stability over speed

## Next.js Dashboard Specific Instructions
When implementing the dashboard:
- **DO NOT** install dependencies until implementing features that need them
- **DO NOT** create placeholder or example charts - wait for user specifications
- **DO NOT** generate mock data - use actual JSON files from store/ directory
- **DO NOT** modify existing services - preserve all data fetching logic
- **ALWAYS** use hot module replacement for rapid development iteration
- **ALWAYS** check NEXTJS_INTEGRATION_PLAN.md for architectural decisions
- **ALWAYS** reuse existing TypeScript types from src/types/
- **WHEN** adding UI components, start minimal and add complexity incrementally