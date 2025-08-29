# Repository Activity Dashboard

A TypeScript Node.js application that fetches and aggregates pull request and issue data from multiple GitHub repositories. The system provides comprehensive metrics including PR reviews, commit authorship, and issue relationships across all configured repositories.

## Features

- **Multi-Repository Support**: Process multiple GitHub repositories defined in `repos.json`
- **Comprehensive PR Data**: Fetch PR details including reviewers, commit authors, and related issues
- **Issue Tracking**: Collect issue information with assignees, closure reasons, and linked PRs
- **Rate Limit Management**: Automatic rate limit monitoring and throttling
- **Parallel Processing**: Concurrent API requests with configurable limits
- **Error Resilience**: Continue processing even if individual repositories fail

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

The module exports functions that can be called programmatically:

```javascript
import { 
  fetchAllRepositories, 
  fetchNewItemsOnly, 
  loadFromStorage, 
  loadRepositories 
} from './src/index.js';

// Fetch all repositories and save to storage
const allData = await fetchAllRepositories();

// Check for new items only (incremental update)
const newItems = await fetchNewItemsOnly();

// Load specific repository from storage
const prebidData = await loadFromStorage('Prebid.js');

// Load data for a date range
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');
const yearData = await loadFromStorage('Prebid.js', startDate, endDate);

// Get list of all repositories
const repos = loadRepositories();
```

### Available Scripts
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled application
- `npm run dev` - Run with ts-node for development
- `npm run clean` - Remove build artifacts

## Data Collected

### Pull Request Data
- Title, number, and author
- Assignee (if assigned)
- Reviewers (approved and pending)
- Creation, merge, and close dates
- Status (open/closed/merged)
- Labels
- Commit count and authors summary
- Related issue (if linked)
- Target branch

### Issue Data
- Title, number, and author
- Assignee (if assigned)
- Creation and close dates
- Status (open/closed)
- Closure reason (completed/duplicate/not_planned)
- Labels
- Related pull requests

## Architecture

```
src/
├── index.ts                 # Main entry point with CLI modes
├── types/
│   ├── index.ts            # Core type definitions
│   └── storage.ts          # Storage-specific types
├── utils/
│   └── repoParser.ts       # Repository configuration parser
└── services/
    ├── githubService.ts    # GitHub API interaction layer
    ├── dataFetcher.ts      # Data orchestration service
    └── storageService.ts   # File-based storage management
```

### Key Components

1. **Repository Parser**: Extracts repository information from `repos.json`
2. **GitHub Service**: Handles API calls with rate limiting and error handling
3. **Data Fetcher**: Orchestrates parallel fetching across repositories
4. **Storage Service**: Manages file-based storage with monthly partitioning
5. **Type System**: Strongly typed data structures for all GitHub data

## Data Storage

### Storage Structure
```
data/
├── index.json              # Master index of all stored data
└── repos/
    ├── prebid-js/
    │   ├── prs/
    │   │   └── 2024-01.json   # Monthly PR data
    │   └── issues/
    │       └── 2024-01.json   # Monthly issue data
    └── [other-repos]/
```

### Incremental Updates
The system tracks which PRs and issues have already been fetched:
- First run: Fetches all data and creates the storage structure
- Subsequent runs: Only fetches new or updated items
- Update mode: Quick check for new items without full refetch

### Storage Features
- **Monthly Partitioning**: Data organized by year-month for efficient access
- **Deduplication**: Prevents storing duplicate items
- **Update Detection**: Identifies when existing items have been modified
- **Date Range Queries**: Load data for specific time periods

## Configuration

### Rate Limiting
The application automatically handles GitHub API rate limits:
- Monitors remaining API calls after each batch
- Pauses execution when rate limit is low (<100 requests)
- Configurable request delays (default: 100ms between requests)

### Parallel Processing
Configure concurrency in the fetch options:
```typescript
{
  parallel: true,        // Enable parallel processing
  maxConcurrent: 3,     // Maximum concurrent requests
  limit: 100,           // Maximum items per repository
  state: 'all'          // Filter: 'open', 'closed', or 'all'
}
```

## Output

The application logs progress to the console:
- Repository fetch status
- Number of PRs and issues found
- Rate limit warnings
- Error messages for failed repositories

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Node.js** - JavaScript runtime
- **@octokit/rest** - Official GitHub REST API client
- **dotenv** - Environment variable management
- **ES Modules** - Modern JavaScript module system

## Error Handling

- Individual repository failures don't stop the entire process
- Clear error messages indicate which repository failed
- Graceful fallback for missing API endpoints
- Automatic retry with exponential backoff for rate limits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate type definitions
4. Ensure all TypeScript compiles without errors
5. Submit a pull request

## License

[Add your license here]

## Future Enhancements

- Data persistence (database integration)
- Web dashboard for visualization
- Webhook support for real-time updates
- Historical trend analysis
- Export to various formats (CSV, JSON, etc.)