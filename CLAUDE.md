# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A TypeScript Node.js application that fetches and aggregates pull request and issue data from multiple GitHub repositories defined in `repos.json`. The system collects detailed metrics including PR reviews, commit authors, related issues/PRs, and issue closure reasons.

## Development Commands
- `npm run dev` - Start development server with hot reload using ts-node
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run start` - Run the compiled JavaScript from dist/
- `npm run clean` - Remove the dist/ directory

## Project Architecture

### Core Components

1. **Type Definitions** (`src/types/index.ts`)
   - `Repository`: Parsed repository information (owner, repo, name, category)
   - `PRData`: Complete PR information including reviewers, commits by author, related issues
   - `IssueData`: Issue details with assignees, closure reasons, related PRs
   - `RepositoryData`: Aggregated data for a single repository

2. **Repository Parser** (`src/utils/repoParser.ts`)
   - Parses `repos.json` to extract GitHub repository information
   - Extracts owner/repo from GitHub URLs
   - Provides filtering by category and name

3. **GitHub Service** (`src/services/githubService.ts`)
   - Core API interaction layer using Octokit
   - Fetches PRs with reviews and commit author summaries
   - Fetches issues with timeline events for related PRs
   - Implements rate limiting and delay mechanisms
   - Uses GitHub's timeline API for finding related issues/PRs (no regex parsing)

4. **Data Fetcher** (`src/services/dataFetcher.ts`)
   - Orchestrates data fetching across multiple repositories
   - Supports parallel and sequential fetching strategies
   - Implements concurrency control (default: 3 concurrent requests)
   - Automatic rate limit monitoring and waiting
   - Progress logging for each repository

5. **Main Entry Point** (`src/index.ts`)
   - Validates environment variables (GITHUB_TOKEN required)
   - Initializes data fetcher and processes all repositories
   - Reports success/failure status

### Data Collection Details

**PR Data Collected:**
- Title, number, author, assignee
- Reviewers (categorized as approved/pending)
- Creation date, status (open/closed/merged)
- Merge/close dates
- Labels
- Commits summary by author (count per author)
- Related issue number (if linked)
- Base branch

**Issue Data Collected:**
- Title, number, author, assignee
- Creation date, status (open/closed)
- Close date and reason (completed/duplicate/not_planned/other)
- Labels
- Related PR numbers (from timeline events)

### Configuration Files
- `repos.json`: Repository definitions organized by category
- `.env`: Environment variables (GITHUB_TOKEN required)
- `tsconfig.json`: TypeScript configuration with ES modules

## Implementation Guidelines

### TypeScript Best Practices
- Always use TypeScript (.ts) files
- Strict type checking enabled
- ES module imports/exports with .js extensions
- Target ES2022 with NodeNext module resolution

### API Integration
- Use Octokit client for all GitHub API calls
- Implement proper error handling for each repository
- Continue processing other repos if one fails
- Log progress and errors clearly

### Rate Limiting Strategy
- Check rate limits after each batch of repositories
- Automatic waiting when rate limit < 100 remaining
- Configurable delays between API requests (default: 100ms)
- Parallel processing with configurable concurrency

### Error Handling
- Individual repository failures don't stop the entire process
- Clear error messages indicating which repository failed
- Graceful fallback for missing timeline API endpoints

## Environment Setup
1. Copy `.env.example` to `.env`
2. Add GitHub personal access token with repo scope
3. Token must have access to all repositories in `repos.json`

## Data Storage Architecture

### Storage Structure
```
data/
├── index.json                    # Master index tracking all stored data
└── repos/
    ├── prebid-js/
    │   ├── prs/
    │   │   ├── 2024-01.json     # Monthly PR data files
    │   │   ├── 2024-02.json
    │   │   └── ...
    │   └── issues/
    │       ├── 2024-01.json     # Monthly issue data files
    │       └── ...
    └── [other-repos]/
```

### Storage Service (`src/services/storageService.ts`)
- **Monthly File Organization**: Data partitioned by year-month for efficient access
- **Index Management**: Central index tracks all stored items with metadata
- **Incremental Updates**: Identifies new/updated items to minimize API calls
- **Duplicate Prevention**: Uses item numbers to prevent storing duplicates
- **Update Tracking**: Records when items were last fetched and modified

### Key Storage Features
1. **Incremental Fetching**: Only fetch new/updated items on subsequent runs
2. **Efficient Lookups**: Index provides quick access to specific date ranges
3. **Storage Verification**: Returns counts of saved vs updated items
4. **Date Range Queries**: Load data for specific time periods
5. **Repository Isolation**: Each repo's data stored separately

### Available Functions
The project exports functions that can be called programmatically:
- `fetchAllRepositories(options)` - Fetch and store all repository data
- `fetchNewItemsOnly(repo?)` - Check for new items only (incremental update)
- `loadFromStorage(repoName?, startDate?, endDate?)` - Load data from storage
- `loadRepositories()` - Get list of all configured repositories
- `getStorageService()` - Get direct access to storage service

## Future Considerations
- Webhook integration for real-time updates
- Dashboard UI for visualization
- Historical trend analysis
- Data export to various formats
- Automated scheduled updates