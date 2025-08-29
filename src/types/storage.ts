export interface IndexEntry {
  count: number;
  file: string;
  firstItem: Date;
  lastItem: Date;
  lastUpdated: Date;
  itemNumbers: Set<number>;
  highestNumber: number;
  oldestNumber: number;
}

export interface RepositoryIndex {
  prs: {
    [yearMonth: string]: IndexEntry;
    all: Set<number>;
  };
  issues: {
    [yearMonth: string]: IndexEntry;
    all: Set<number>;
  };
  lastFetch: Date;
  lastModified: {
    prs: Date;
    issues: Date;
  };
  totalPRs: number;
  totalIssues: number;
}

export interface StorageIndex {
  version: string;
  lastUpdated: Date;
  repositories: {
    [repoKey: string]: RepositoryIndex;
  };
}

export interface MonthlyData<T> {
  metadata: {
    repository: string;
    year: number;
    month: number;
    itemCount: number;
    lastUpdated: Date;
    dateRange: {
      start: Date;
      end: Date;
    };
    itemNumbers: number[];
  };
  items: T[];
}

export interface IncrementalFetchResult {
  newItems: (PRData | IssueData)[];
  updatedItems: (PRData | IssueData)[];
  repository: string;
  type: 'prs' | 'issues';
  fetchedAt: Date;
}

export interface StorageOptions {
  dataDir?: string;
  yearStart?: number;
  yearEnd?: number;
  enableIncrementalUpdates?: boolean;
}