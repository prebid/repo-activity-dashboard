# Repository Activity Dashboard

A TypeScript Node.js application that fetches and stores GitHub repository activity data. The system tracks open PRs/issues in real-time and archives merged PRs and closed issues by month.

## Features

- **Smart Data Organization**: Separate storage for open items vs historical data
- **Efficient API Usage**: Only fetches merged PRs (ignores closed-but-not-merged)
- **Monthly Archives**: Merged PRs and closed issues stored by merge/close month
- **Full Pagination Support**: Handles repositories with 100+ PRs/issues
- **Advanced Rate Limiting**: 
  - Adaptive delays based on remaining quota
  - Request queue with concurrent request management
  - Automatic burst protection
  - Retry logic with exponential backoff
- **Incremental Batch Saving**: Saves data during processing to prevent loss
- **Multi-Repository Support**: Process all configured repositories sequentially

## Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- GitHub Personal Access Token with `repo` scope

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd repo-activity-dashboard
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your GitHub token:
   ```env
   GITHUB_TOKEN=ghp_your_token_here
   ```

3. **Configure repositories:**
   Edit `repos.json` to add the repositories you want to track:
   ```json
   {
     "Category Name": [
       {
         "name": "Repository Display Name",
         "url": "https://github.com/owner/repo"
       }
     ]
   }
   ```

### Creating a GitHub Token
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Copy the token to your `.env` file

## Usage

### Available Functions

```javascript
import { 
  syncAllRepositories,
  incrementalSync,
  loadStoredData,
  loadRepositories 
} from './src/index.js';

// Full sync - fetch all open items and recent merged/closed
// Optional: specify max concurrent requests (default: 3)
await syncAllRepositories(5);

// Incremental sync - update only changed items
await incrementalSync(); // All repos
await incrementalSync('Prebid.js', 5); // Specific repo with concurrency

// Load stored data
const data = await loadStoredData('Prebid.js');
console.log(`${data.prs.length} open PRs, ${data.issues.length} open issues`);

// Get list of all repositories
const repos = loadRepositories();
```

### Available Scripts
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled application
- `npm run dev` - Run with ts-node for development
- `npm run clean` - Remove build artifacts

## Data Storage

### Storage Structure
```
store/
├── index.json                    # Master index with sync metadata
└── repos/
    ├── prebid-js/
    │   ├── open-prs.json         # All currently open PRs
    │   ├── open-issues.json      # All currently open issues
    │   ├── merged/               # Merged PRs by month
    │   │   ├── 2024-01.json      # PRs merged in Jan 2024
    │   │   └── 2024-02.json      # PRs merged in Feb 2024
    │   ├── closed/               # Closed issues by month
    │   │   ├── 2024-01.json      # Issues closed in Jan 2024
    │   │   └── 2024-02.json      # Issues closed in Feb 2024
    │   └── sync-state.json       # Sync metadata for this repo
    └── [other-repos]/
```

### Data Organization
- **Open Items**: Single file per type for quick access and updates
- **Historical Data**: Monthly files based on merge/close date
- **No Noise**: Closed-but-not-merged PRs are completely ignored

## Data Collected

### Pull Request Data
- Title, number, and author
- Assignees (multiple)
- Reviewers (approved and pending)
- Creation and merge dates
- Status (open/merged only)
- Labels
- Commit count and authors summary
- Target branch

### Issue Data
- Title, number, and author
- Assignees (multiple)
- Creation and close dates
- Status (open/closed)
- Closure reason (completed/duplicate/not_planned)
- Labels

## Architecture

```
src/
├── index.ts                 # Main exports and API functions
├── types/
│   ├── index.ts            # Core type definitions (PRData, IssueData, etc.)
│   └── storage.ts          # Storage-specific types
├── utils/
│   └── repoParser.ts       # Repository configuration parser
└── services/
    ├── githubService.ts    # Advanced GitHub API client with pagination
    ├── dataFetcher.ts      # Orchestrates sync operations
    ├── storageService.ts   # File storage management
    ├── rateLimitManager.ts # Rate limit tracking and management
    └── requestQueue.ts     # Concurrent request queue management
```

### Key Components

1. **GitHub Service** (`githubService.ts`): Advanced GitHub API client
   - Full pagination support for large repositories
   - Concurrent request processing with configurable limits
   - Adaptive rate limiting based on API quota
   - Request queue with retry logic
   - Batch callbacks for incremental saving
   - Filters out closed-but-not-merged PRs

2. **Storage Service** (`storageService.ts`): File-based storage management
   - Saves open items to single JSON files
   - Archives merged/closed items by month (YYYY-MM.json)
   - Handles date serialization/deserialization
   - Maintains sync state and repository index

3. **Data Fetcher** (`dataFetcher.ts`): Orchestration layer
   - Coordinates between GitHub API and storage
   - Implements incremental sync logic
   - Manages repository-level sync operations
   - Progress reporting and error handling

4. **Rate Limit Manager** (`rateLimitManager.ts`): Smart rate limiting
   - Tracks primary rate limit from GitHub headers
   - Implements burst protection (secondary rate limit)
   - Calculates optimal delays based on remaining quota
   - Prevents API abuse

5. **Request Queue** (`requestQueue.ts`): Concurrent request management
   - Manages queue of API requests
   - Configurable concurrency (default: 3-5 requests)
   - Priority-based request ordering
   - Automatic retry with exponential backoff

## Sync Strategy

### Full Sync (`syncAllRepositories`)
- Fetches ALL open PRs and issues (with pagination)
- Fetches recent merged PRs and closed issues
- Processes repositories sequentially for stability
- Saves data incrementally during processing
- Automatically manages rate limits

### Incremental Sync (`incrementalSync`)
- Fetches current open items
- Fetches recently updated merged/closed items (using `since` parameter)
- Detects items that changed from open to merged/closed
- Updates only changed data
- Ideal for regular updates

### Performance Optimizations
- **Concurrent Processing**: PRs fetch reviews and commits in parallel
- **Batch Processing**: Items processed in batches (10 PRs, 20 issues)
- **Incremental Saving**: Data saved during pauses to prevent loss
- **Adaptive Delays**: Automatically adjusts based on rate limit status

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Node.js** - JavaScript runtime
- **@octokit/rest** - Official GitHub REST API client
- **dotenv** - Environment variable management
- **ES Modules** - Modern JavaScript module system

## Error Handling

- Individual repository failures don't stop the entire process
- Clear error messages indicate which repository failed
- Automatic retry with exponential backoff (up to 3 attempts)
- Rate limit detection and automatic waiting
- 404 errors for non-existent repositories are handled gracefully
- Date serialization issues fixed for reloading stored data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate type definitions
4. Ensure all TypeScript compiles without errors
5. Submit a pull request

## License

[Add your license here]