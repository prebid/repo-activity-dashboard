# Next.js Integration Plan for Repo Activity Dashboard

## Executive Summary
This plan outlines the transformation of the current Node.js GitHub activity tracker into a full-stack Next.js application with React-based charting capabilities. The approach preserves the robust data fetching infrastructure while adding a modern web interface for visualization and analytics.

## 1. Architecture Strategy

### 1.1 Hybrid Architecture Approach
```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Application                       │
├───────────────────────────┬─────────────────────────────────────┤
│      Frontend Layer       │        Backend Layer                │
├───────────────────────────┼─────────────────────────────────────┤
│ • React Components        │ • API Routes (/api/*)              │
│ • shadcn/ui + Recharts   │ • Background Jobs (sync)           │
│ • Dashboard Views         │ • Data Processing Services         │
│ • Real-time Updates       │ • Existing GitHub Services         │
└───────────────────────────┴─────────────────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   Data Layer        │
                              ├─────────────────────┤
                              │ • SQLite (metadata) │
                              │ • JSON Files (data) │
                              │ • Redis (cache)     │
                              └─────────────────────┘
```

### 1.2 Key Design Decisions
- **Preserve existing services**: Keep all GitHub fetching logic intact
- **API-first approach**: Create REST/tRPC APIs for data access
- **Incremental migration**: Maintain backward compatibility
- **Progressive enhancement**: Add real-time features via Server-Sent Events
- **Optimized data access**: Index JSON data in SQLite for fast queries

## 2. Proposed File Structure

```
repo-activity-dashboard/
├── app/                           # Next.js 14 App Router
│   ├── layout.tsx                 # Root layout with providers
│   ├── page.tsx                   # Dashboard home
│   ├── globals.css               # Global styles + Tailwind
│   ├── api/                      # API Routes
│   │   ├── repos/
│   │   │   ├── route.ts         # GET /api/repos
│   │   │   └── [name]/
│   │   │       ├── route.ts     # GET /api/repos/[name]
│   │   │       ├── prs/route.ts # GET /api/repos/[name]/prs
│   │   │       └── issues/route.ts
│   │   ├── contributors/
│   │   │   ├── route.ts         # GET /api/contributors
│   │   │   └── [id]/route.ts    # GET /api/contributors/[id]
│   │   ├── stats/
│   │   │   ├── timeline/route.ts # Timeline data
│   │   │   └── summary/route.ts  # Summary stats
│   │   ├── sync/
│   │   │   ├── route.ts         # POST /api/sync (trigger sync)
│   │   │   └── status/route.ts  # GET /api/sync/status
│   │   └── webhooks/
│   │       └── github/route.ts  # GitHub webhooks
│   ├── repos/
│   │   ├── page.tsx             # Repository list view
│   │   └── [name]/
│   │       ├── page.tsx         # Single repo dashboard
│   │       ├── layout.tsx       # Repo layout with tabs
│   │       ├── prs/page.tsx    # PRs tab
│   │       ├── issues/page.tsx # Issues tab
│   │       └── contributors/page.tsx
│   ├── contributors/
│   │   ├── page.tsx             # Contributors overview
│   │   └── [id]/page.tsx       # Individual contributor
│   └── timeline/
│       └── page.tsx             # Timeline view
│
├── components/                   # React Components
│   ├── ui/                     # shadcn/ui components
│   │   ├── card.tsx
│   │   ├── chart.tsx           # Chart wrapper component
│   │   ├── button.tsx
│   │   ├── table.tsx
│   │   └── ...
│   ├── charts/                 # Chart components
│   │   ├── pr-velocity-chart.tsx
│   │   ├── contributor-chart.tsx
│   │   ├── issue-timeline.tsx
│   │   ├── activity-heatmap.tsx
│   │   └── repo-comparison.tsx
│   ├── dashboard/               # Dashboard components
│   │   ├── repo-card.tsx
│   │   ├── stats-card.tsx
│   │   ├── activity-feed.tsx
│   │   └── filter-toolbar.tsx
│   └── layout/                 # Layout components
│       ├── header.tsx
│       ├── sidebar.tsx
│       └── footer.tsx
│
├── lib/                         # Library code
│   ├── api/                    # API client utilities
│   │   ├── client.ts          # API client for frontend
│   │   └── fetcher.ts         # SWR/React Query fetcher
│   ├── db/                     # Database utilities
│   │   ├── schema.ts          # Drizzle/Prisma schema
│   │   ├── client.ts          # DB client
│   │   └── migrations/        # DB migrations
│   ├── cache/                  # Caching utilities
│   │   ├── redis.ts           # Redis client
│   │   └── strategies.ts      # Cache strategies
│   └── utils/                  # Shared utilities
│       ├── date.ts
│       ├── format.ts
│       └── constants.ts
│
├── services/                    # [EXISTING - Backend Services]
│   ├── dataFetcher.ts
│   ├── githubService.ts
│   ├── storageService.ts
│   ├── rateLimitManager.ts
│   └── requestQueue.ts
│
├── workers/                     # Background workers
│   ├── sync-worker.ts          # Periodic sync worker
│   ├── webhook-processor.ts    # Process GitHub webhooks
│   └── cache-warmer.ts         # Pre-compute expensive queries
│
├── hooks/                       # React hooks
│   ├── use-repo-data.ts
│   ├── use-contributors.ts
│   ├── use-timeline.ts
│   └── use-real-time-updates.ts
│
├── store/                       # [EXISTING - keep as is]
│   └── repos/
│       └── ...
│
├── data/                        # [NEW - Optimized data structure]
│   ├── indexed/                # SQLite indexed data
│   │   ├── repos.db           # Repository metadata
│   │   ├── contributors.db    # Contributor indexes
│   │   └── timeline.db        # Timeline events
│   ├── aggregated/             # Pre-computed aggregations
│   │   ├── daily/             # Daily rollups
│   │   ├── weekly/            # Weekly summaries
│   │   └── monthly/           # Monthly reports
│   └── cache/                  # Redis cache files
│
├── public/                      # Static assets
├── tests/                       # [EXISTING - expand for frontend]
├── scripts/                     # Build and maintenance scripts
│   ├── migrate-data.ts        # Migrate JSON to indexed format
│   ├── build-indexes.ts       # Build SQLite indexes
│   └── seed-db.ts             # Seed development data
│
├── next.config.mjs             # Next.js configuration
├── tailwind.config.ts          # Tailwind configuration
├── components.json             # shadcn/ui configuration
├── drizzle.config.ts          # Database ORM config
├── package.json                # Updated with Next.js deps
└── tsconfig.json              # TypeScript config
```

## 3. Data Organization Strategy

### 3.1 Tiered Storage Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Tier 1: Hot Cache                       │
│                    Redis (< 1 hour old)                     │
├─────────────────────────────────────────────────────────────┤
│                    Tier 2: Warm Storage                     │
│                  SQLite Indexes (< 1 day)                   │
├─────────────────────────────────────────────────────────────┤
│                     Tier 3: Cold Storage                    │
│                 JSON Files (permanent archive)              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 SQLite Index Schema
```sql
-- Repository metadata for fast queries
CREATE TABLE repositories (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  owner TEXT NOT NULL,
  category TEXT,
  last_sync DATETIME,
  open_prs_count INTEGER,
  open_issues_count INTEGER,
  total_contributors INTEGER,
  created_at DATETIME,
  updated_at DATETIME
);

-- Contributor aggregations
CREATE TABLE contributors (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  total_prs INTEGER,
  total_issues INTEGER,
  total_commits INTEGER,
  first_contribution DATETIME,
  last_contribution DATETIME
);

-- Timeline events for activity feeds
CREATE TABLE timeline_events (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL, -- 'pr_opened', 'pr_merged', 'issue_opened', etc.
  repository_id INTEGER REFERENCES repositories(id),
  contributor_id INTEGER REFERENCES contributors(id),
  item_number INTEGER,
  title TEXT,
  occurred_at DATETIME,
  metadata JSON
);

-- Indexes for performance
CREATE INDEX idx_timeline_date ON timeline_events(occurred_at DESC);
CREATE INDEX idx_timeline_repo ON timeline_events(repository_id, occurred_at DESC);
CREATE INDEX idx_contributor_activity ON timeline_events(contributor_id, occurred_at DESC);
```

### 3.3 Data Flow Architecture
```
GitHub API → GitHub Service → Storage Service → JSON Files
                                      ↓
                              Index Builder Service
                                      ↓
                              SQLite Database
                                      ↓
                              API Routes ← Redis Cache
                                      ↓
                              React Components
```

## 4. API Design

### 4.1 RESTful Endpoints
```typescript
// Repository endpoints
GET /api/repos                    // List all repositories
GET /api/repos/:name              // Single repository details
GET /api/repos/:name/prs          // PRs with pagination
GET /api/repos/:name/issues       // Issues with pagination
GET /api/repos/:name/contributors // Repository contributors
GET /api/repos/:name/timeline     // Activity timeline

// Contributor endpoints
GET /api/contributors              // All contributors
GET /api/contributors/:username   // Single contributor details
GET /api/contributors/:username/activity // Contribution timeline

// Statistics endpoints
GET /api/stats/summary            // Overall dashboard stats
GET /api/stats/timeline           // Timeline data for charts
GET /api/stats/velocity           // PR/Issue velocity metrics
GET /api/stats/burndown           // Burndown charts

// Sync management
POST /api/sync/trigger            // Trigger manual sync
GET /api/sync/status              // Current sync status
GET /api/sync/history             // Sync history

// Real-time updates
GET /api/events                   // Server-sent events stream
```

### 4.2 Response Format
```typescript
interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    cached: boolean;
    ttl?: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
}
```

## 5. Component Architecture

### 5.1 Component Hierarchy
```
App Layout
├── Header (navigation, search, sync status)
├── Sidebar (repo list, filters)
└── Main Content
    ├── Dashboard View
    │   ├── Summary Cards
    │   ├── Activity Timeline Chart
    │   ├── Top Contributors Table
    │   └── Recent Activity Feed
    ├── Repository View
    │   ├── Repo Header (stats, actions)
    │   ├── Tab Navigation
    │   └── Tab Content
    │       ├── PRs Tab (DataTable + Charts)
    │       ├── Issues Tab (DataTable + Charts)
    │       └── Contributors Tab (Grid + Charts)
    └── Contributor View
        ├── Contributor Profile
        ├── Contribution Heatmap
        └── Activity Timeline
```

### 5.2 Chart Components (using shadcn/ui + Recharts)
```typescript
// PR Velocity Chart
<PRVelocityChart 
  data={prVelocityData}
  timeRange="30d"
  groupBy="week"
/>

// Contributor Activity Chart
<ContributorChart
  contributors={topContributors}
  metric="commits"
  limit={10}
/>

// Issue Timeline
<IssueTimeline
  issues={issueData}
  showClosed={true}
  dateRange={[startDate, endDate]}
/>

// Activity Heatmap
<ActivityHeatmap
  contributor={contributorData}
  year={2024}
/>

// Repository Comparison
<RepoComparison
  repos={selectedRepos}
  metrics={['prs', 'issues', 'contributors']}
/>
```

### 5.3 State Management
```typescript
// Use Zustand for global state
interface AppStore {
  // Filters
  selectedRepos: string[];
  dateRange: [Date, Date];
  contributorFilter: string[];
  
  // UI State
  sidebarOpen: boolean;
  syncStatus: SyncStatus;
  
  // Actions
  setSelectedRepos: (repos: string[]) => void;
  setDateRange: (range: [Date, Date]) => void;
  toggleSidebar: () => void;
}

// Use React Query for data fetching
const { data, isLoading, error } = useQuery({
  queryKey: ['repos', selectedRepo],
  queryFn: () => fetchRepoData(selectedRepo),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Initialize Next.js 14 with TypeScript
- [ ] Set up Tailwind CSS and shadcn/ui
- [ ] Create basic layout components
- [ ] Set up SQLite with Drizzle ORM
- [ ] Create data migration scripts
- [ ] Build SQLite indexes from existing JSON

### Phase 2: API Layer (Week 3-4)
- [ ] Implement core API routes
- [ ] Add Redis caching layer
- [ ] Create API client utilities
- [ ] Set up React Query/SWR
- [ ] Add error handling and logging
- [ ] Implement pagination helpers

### Phase 3: Dashboard Views (Week 5-6)
- [ ] Build main dashboard with summary cards
- [ ] Create repository list view
- [ ] Implement repository detail pages
- [ ] Add contributor pages
- [ ] Create timeline view
- [ ] Add filter and search functionality

### Phase 4: Charting & Visualization (Week 7-8)
- [ ] Integrate Recharts with shadcn/ui
- [ ] Build PR velocity charts
- [ ] Create contributor charts
- [ ] Implement activity heatmaps
- [ ] Add timeline visualizations
- [ ] Create comparison charts

### Phase 5: Real-time & Background Jobs (Week 9-10)
- [ ] Set up background sync workers
- [ ] Implement Server-Sent Events
- [ ] Add GitHub webhook support
- [ ] Create real-time notifications
- [ ] Build sync status indicators
- [ ] Add progress tracking

### Phase 6: Optimization & Polish (Week 11-12)
- [ ] Optimize database queries
- [ ] Add comprehensive caching
- [ ] Implement virtual scrolling
- [ ] Add dark mode support
- [ ] Create loading states
- [ ] Add error boundaries
- [ ] Write E2E tests

## 7. Excel Organization Mapping Integration

### 7.1 Reading Your Excel File (Local or Remote)
```typescript
// src/services/excelOrgParser.ts
import * as XLSX from 'xlsx';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';

export class ExcelOrgParser {
  private mappingCache: Map<string, string> = new Map();
  private s3Client?: S3Client;
  
  constructor() {
    // Initialize S3 client if AWS credentials are configured
    if (process.env.AWS_REGION) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: process.env.AWS_ACCESS_KEY_ID ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        } : undefined, // Use IAM role if no explicit credentials
      });
    }
  }
  
  async loadMappingFromSource(source: string): Promise<Map<string, string>> {
    let buffer: Buffer;
    
    if (source.startsWith('s3://')) {
      // Load from S3
      buffer = await this.loadFromS3(source);
    } else if (source.startsWith('http')) {
      // Load from HTTP/HTTPS URL
      buffer = await this.loadFromUrl(source);
    } else {
      // Load from local file system
      buffer = await this.loadFromFile(source);
    }
    
    // Parse Excel from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet);
    
    // Build mapping (adjust column names to match your Excel)
    data.forEach(row => {
      const githubUsername = row['GitHub Username'] || row['github'];
      const organization = row['Organization'] || row['org'];
      
      if (githubUsername && organization) {
        this.mappingCache.set(githubUsername.toLowerCase().trim(), organization.trim());
      }
    });
    
    console.log(`Loaded ${this.mappingCache.size} org mappings from ${source}`);
    return this.mappingCache;
  }
  
  private async loadFromS3(s3Path: string): Promise<Buffer> {
    // Parse s3://bucket/key format
    const match = s3Path.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!match) throw new Error('Invalid S3 path format');
    
    const [, bucket, key] = match;
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await this.s3Client!.send(command);
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  
  private async loadFromUrl(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel from ${url}: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  
  private async loadFromFile(path: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return fs.readFile(path);
  }
  
  getOrganization(githubUsername: string): string {
    return this.mappingCache.get(githubUsername.toLowerCase()) || 'Unknown';
  }
}
```

### 7.2 Data Aggregation with Organizations
```typescript
// Enhanced aggregation using Excel mapping
async aggregateWithOrganizations(repoData: RepositoryData): Promise<EnhancedStats> {
  const stats = {
    byOrganization: {} as Record<string, OrgStats>,
    byContributor: {} as Record<string, ContributorStatsWithOrg>,
  };
  
  repoData.prs.forEach(pr => {
    const authorOrg = this.orgParser.getOrganization(pr.author);
    
    if (!stats.byOrganization[authorOrg]) {
      stats.byOrganization[authorOrg] = {
        prsAuthored: 0,
        prsReviewed: 0,
        uniqueContributors: new Set<string>(),
      };
    }
    
    stats.byOrganization[authorOrg].prsAuthored++;
    stats.byOrganization[authorOrg].uniqueContributors.add(pr.author);
  });
  
  return stats;
}
```

## 8. Technical Specifications

### 8.1 Dependencies - Add Only As Needed

#### Phase 1: Minimal Next.js Setup
```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.9.2"
  }
}
```

#### Add When Implementing Specific Features:
```bash
# When setting up Tailwind + shadcn/ui:
npm install tailwindcss postcss autoprefixer
npm install @radix-ui/react-slot class-variance-authority clsx tailwind-merge

# When adding charts (choose one):
npm install recharts  # OR
npm install @tremor/react  # OR
npm install visx  # Evaluate options when ready

# When adding data fetching:
npm install @tanstack/react-query  # OR swr

# When adding icons:
npm install lucide-react

# When working with dates:
npm install date-fns

# When adding Excel support:
npm install xlsx

# When adding AWS S3 support:
npm install @aws-sdk/client-s3

# When adding SQLite (if needed):
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit

# When adding Redis caching (if needed):
npm install redis

# When adding state management (if needed):
npm install zustand
```

### 8.2 Environment Variables
```env
# Existing
GITHUB_TOKEN=xxx

# New
DATABASE_URL=file:./data/indexed/main.db
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:3000
WEBHOOK_SECRET=xxx
SYNC_SCHEDULE=0 */6 * * *  # Every 6 hours

# Organization Mapping - can be any of:
# Local file: ./path/to/mapping.xlsx
# S3: s3://bucket-name/path/to/mapping.xlsx
# HTTP/HTTPS: https://example.com/mapping.xlsx
ORG_MAPPING_SOURCE=s3://my-bucket/github-org-mapping.xlsx

# AWS credentials (optional - can use IAM role instead)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx  # Optional if using IAM role
AWS_SECRET_ACCESS_KEY=xxx  # Optional if using IAM role
```

### 7.3 Performance Targets
- **Initial Load**: < 2 seconds
- **API Response**: < 200ms (cached), < 1s (uncached)
- **Chart Rendering**: < 500ms
- **Database Queries**: < 50ms
- **Cache Hit Rate**: > 80%

## 9. Development Configuration

### 9.1 Next.js Config with HMR
```javascript
// next.config.mjs
const nextConfig = {
  reactStrictMode: true,
  // Fast refresh for instant updates
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Optimize for development speed
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
```

### 9.2 Theme System
```typescript
// providers/theme-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as Theme;
    if (stored) setTheme(stored);
  }, []);
  
  useEffect(() => {
    if (!mounted) return;
    
    const root = window.document.documentElement;
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = () => {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light';
        root.classList.remove('light', 'dark');
        root.classList.add(systemTheme);
      };
      
      updateTheme();
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
  }, [theme, mounted]);
  
  // Rest of implementation...
}
```

### 9.3 Development Scripts
```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "sync": "tsx src/index.ts",
    "analyze": "ANALYZE=true next build"
  }
}
```

## 10. Migration Strategy

### 10.1 Data Migration Steps
1. **Backup existing data**: Copy all JSON files
2. **Create SQLite schema**: Run migrations
3. **Index existing data**: Parse JSON → SQLite
4. **Verify data integrity**: Compare counts
5. **Set up incremental indexing**: Update on sync

### 10.2 Code Migration Steps
1. **Preserve services**: Keep all existing services
2. **Create adapters**: Bridge services to API routes
3. **Gradual refactoring**: Move logic to API routes
4. **Test thoroughly**: Ensure backward compatibility
5. **Document changes**: Update README and API docs

## Conclusion
This plan provides a robust foundation for transforming the repo-activity-dashboard into a production-ready Next.js application. The architecture preserves existing strengths while adding modern web capabilities, ensuring scalability, performance, and maintainability for an enterprise environment.