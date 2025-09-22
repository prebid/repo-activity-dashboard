# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A Next.js 14 web application that visualizes GitHub repository activity data for the Prebid ecosystem. The system displays real-time statistics, contributor analytics, company-level aggregations, and time-series charts with interactive filtering capabilities.

## Current Features

### 1. Main Dashboard (`/`)
- **Repository Statistics Cards**: 6 cards showing stats for each Prebid repository
  - Open PRs (currently open, fetched from `open-prs.json`)
  - Merged PRs (time-filtered from contributor data)
  - Opened Issues (time-filtered from contributor data)
  - Contributors (unique contributors in time period)
- **Time-Series Charts**: Interactive bar charts showing:
  - Merged PRs (blue bars, left axis)
  - Contributors (purple bars, right axis)
  - Opened Issues (orange bars, left axis)
- **Automatic Granularity**:
  - Year view → Monthly bars
  - Month view → Weekly bars
  - Week view → Daily bars (placeholder, needs PR file processing)
- **Smart Date Filtering**: Charts only show data up to current date (no future months/weeks)

### 2. Contributors Page (`/contributors`)
- **Horizontal Stacked Bar Chart**: Shows top contributors by repository
- **Metrics Available**:
  - Open PRs (PRs authored that are active)
  - Merged PRs (PRs authored that were merged)
  - Reviewed PRs (PRs reviewed by contributor)
  - Merged Commits (total commits in merged PRs)
  - Opened Issues (issues created)
- **Filters**:
  - Repository selector (All or specific)
  - Metric selector
  - Time range selector
  - Result limit selector (5-1000 results)

### 3. Companies Page (`/companies`)
- **Company Aggregation**: Groups contributors by company using GitHub mapping
- **Shows Company Names** with contributor count in parentheses
- **Same visualization** as Contributors page but aggregated by company
- **Member Filter**: All/Member/Non-Member companies
- **Data Source**: Uses `store/sheets/github-mapping.json` processed from CSV

## Data Architecture

### Primary Data Sources

1. **contributor-repo-timeline.json** (Generated)
   - Structure: `data[contributor][repository][timeKey][period][metricIndex]`
   - Time keys: `w` (weekly), `m` (monthly), `y` (yearly)
   - Metric indices: [0: open+merged PRs, 1: merged PRs, 2: reviewed PRs, 3: commits, 4: opened issues]
   - Period formats: `YYYY-WW` (week), `YY-MM` (month), `YY` (year)

2. **store/repos/[repo-name]/** (GitHub API Data)
   - `open-prs.json`: Currently open pull requests
   - `open-issues.json`: Currently open issues
   - `merged/YYYY-MM.json`: Merged PRs by month
   - `closed/YYYY-MM.json`: Closed issues by month

3. **store/sheets/** (Company Mapping)
   - `Github Mapping - User List.csv`: Original mapping data
   - `github-mapping.json`: Processed mapping with company affiliations

### Data Processing Scripts

1. **src/scripts/generateContributorStats.ts**
   - Processes store data into contributor-repo-timeline.json
   - Aggregates by week/month/year
   - **Issue**: Currently double-counts merged PRs in index 0 and 1

2. **src/scripts/processGithubMapping.ts**
   - Converts CSV to JSON mapping
   - Cleans company names (removes parenthetical content)
   - Tracks member status

## Key Technical Decisions

### UI/UX
- **Next.js 14 App Router** with TypeScript
- **Recharts** for data visualization
- **shadcn/ui** components with Tailwind CSS
- **Dark/Light theme** support
- **Responsive design** with mobile considerations

### Data Display Logic
- **Contributors Count**: Includes anyone who opened PRs or issues (not just merged)
- **Time Filtering**: All statistics respond to time range selector
- **Open PRs**: Shows current count (not time-filtered) from open-prs.json
- **Chart Scaling**: Dual Y-axes for better visualization of different scales

### Known Issues
1. **Data Generation Bug**: Merged PRs are counted in both index 0 and 1
2. **Daily Data**: Not available, only weekly/monthly aggregates
3. **Real-time Updates**: Data is static, requires manual regeneration

## Development Commands
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking

# Data generation
npm run generate:stats     # Generate contributor-repo-timeline.json
npm run process:mapping    # Process GitHub mapping CSV to JSON
```

## File Structure
```
src/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── contributors/page.tsx # Contributors view
│   ├── companies/page.tsx    # Companies view
│   └── layout.tsx            # Root layout with providers
├── components/
│   ├── HorizontalBarChart.tsx # Shared chart component
│   ├── layout/toolbar.tsx    # Navigation header
│   └── providers/            # Theme provider
├── scripts/
│   ├── generateContributorStats.ts
│   └── processGithubMapping.ts
├── services/                 # Original GitHub data fetching (preserved)
│   ├── githubService.ts
│   ├── storageService.ts
│   ├── dataFetcher.ts
│   ├── rateLimitManager.ts
│   └── requestQueue.ts
store/
├── repos/                    # GitHub API data
└── sheets/                   # Company mapping data
public/
└── store/                    # Copied for client access
```

## Production Readiness Checklist

### Required for Production
- [ ] Fix data generation bug (double-counting merged PRs)
- [ ] Implement automated data refresh (GitHub Actions or cron)
- [ ] Add authentication for sensitive data
- [ ] Set up proper environment variables
- [ ] Configure production database (if needed)
- [ ] Add error boundaries and loading states
- [ ] Implement caching strategy
- [ ] Add monitoring and analytics

### Nice to Have
- [ ] Real-time data updates via webhooks
- [ ] Daily granularity data processing
- [ ] Export functionality (CSV/PDF)
- [ ] User preferences persistence
- [ ] Advanced filtering (date ranges, multiple selections)
- [ ] Search functionality for contributors/companies
- [ ] Performance optimizations for large datasets

## Environment Variables
```env
# Currently none required, but should add:
GITHUB_TOKEN=           # For API access
NEXT_PUBLIC_API_URL=    # For production API
```

## API Integration Plan
Future implementation should include:
1. REST API endpoints for data fetching
2. WebSocket support for real-time updates
3. GraphQL consideration for complex queries
4. Rate limiting and caching layers

## Security Considerations
- GitHub mapping data contains company affiliations (in .gitignore)
- No authentication currently implemented
- Consider role-based access for company-specific data
- Add API key management for GitHub access

## Performance Notes
- Charts handle 100+ data points efficiently
- Contributor data file is ~3MB (may need pagination)
- Consider lazy loading for route segments
- Implement virtual scrolling for large lists

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Responsive down to 768px width
- Dark mode respects system preferences

## Original Data Fetching Services (Preserved)

### GitHub Service (`src/services/githubService.ts`)
- Fetches open PRs, merged PRs, open issues, closed issues
- Full pagination support
- Concurrent request processing
- Rate limiting and retry logic

### Storage Service (`src/services/storageService.ts`)
- Saves data to JSON files organized by month
- Handles date serialization/deserialization
- Manages deduplication

### Data Fetcher (`src/services/dataFetcher.ts`)
- Orchestrates full and incremental syncs
- Batch processing with progress reporting
- Configurable concurrency

### Rate Limit Manager (`src/services/rateLimitManager.ts`)
- Adaptive delays based on API quota
- Burst protection (300 requests/minute)
- Automatic waiting when limits approached

## Testing

### Test Framework
Uses **Vitest** for testing with TypeScript support.

### Running Tests
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Next Steps for Production

1. **Data Pipeline**
   - Set up GitHub Actions for automated data fetching
   - Implement incremental updates every hour
   - Add data validation and error recovery

2. **Authentication & Authorization**
   - Add NextAuth.js for user authentication
   - Implement role-based access control
   - Secure company-specific data

3. **Performance Optimization**
   - Implement Redis caching for aggregated data
   - Add CDN for static assets
   - Optimize bundle size with code splitting

4. **Monitoring & Analytics**
   - Add Sentry for error tracking
   - Implement analytics (Plausible/Umami)
   - Set up performance monitoring

5. **Deployment**
   - Configure for Vercel/AWS deployment
   - Set up CI/CD pipeline
   - Add staging environment