export interface OpenItemsStorage<T> {
  metadata: {
    repository: string;
    lastSync: Date;
    itemCount: number;
  };
  items: T[];
}

export interface MonthlyStorage<T> {
  metadata: {
    repository: string;
    year: number;
    month: number;
    itemCount: number;
    lastUpdated: Date;
  };
  items: T[];
}

export interface SyncState {
  repository: string;
  lastFullSync: Date;
  lastIncrementalSync: Date;
  openPRNumbers: Set<number>;
  openIssueNumbers: Set<number>;
}

export interface StorageIndex {
  version: string;
  lastUpdated: Date;
  repositories: {
    [repoKey: string]: {
      lastSync: Date;
      openPRsCount: number;
      openIssuesCount: number;
      totalMergedPRs: number;
      totalClosedIssues: number;
    };
  };
}