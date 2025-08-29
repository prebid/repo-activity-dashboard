# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A TypeScript Node.js application that fetches GitHub repository activity data. The system maintains real-time tracking of open PRs/issues and archives merged PRs and closed issues organized by month. Features advanced rate limiting, pagination support, and concurrent request management.

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