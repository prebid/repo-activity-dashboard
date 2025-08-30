import { ZodError } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Repository, PRData, IssueData } from '../types/index.js';
import { PRDataSchema, IssueDataSchema } from './schemas.js';
import { validateStoredPRs, validateStoredIssues } from './storageSchemas.js';
import { GitHubService } from '../services/githubService.js';
import { StorageService } from '../services/storageService.js';

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
}

export interface CompletenessReport {
  repository: string;
  openPRs: {
    stored: number;
    github: number;
    match: boolean;
    missing: number[];
    extra: number[];
  };
  openIssues: {
    stored: number;
    github: number;
    match: boolean;
    missing: number[];
    extra: number[];
  };
  dateUpdatedCheck: {
    prsWithoutDateUpdated: number[];
    issuesWithoutDateUpdated: number[];
  };
}

export interface ValidationReport {
  repository: string;
  timestamp: Date;
  openPRsValidation: ValidationResult;
  openIssuesValidation: ValidationResult;
  completeness: CompletenessReport;
  recommendations: string[];
}

export class DataValidator {
  private storageService: StorageService;
  private githubService?: GitHubService;
  private storeDir: string;

  constructor(storeDir: string = './store', githubToken?: string) {
    this.storeDir = storeDir;
    this.storageService = new StorageService(storeDir);
    if (githubToken) {
      this.githubService = new GitHubService(githubToken);
    }
  }

  validatePRData(data: unknown): ValidationResult {
    try {
      PRDataSchema.parse(data);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        };
      }
      return {
        valid: false,
        errors: [{ path: 'unknown', message: String(error) }]
      };
    }
  }

  validateIssueData(data: unknown): ValidationResult {
    try {
      IssueDataSchema.parse(data);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        };
      }
      return {
        valid: false,
        errors: [{ path: 'unknown', message: String(error) }]
      };
    }
  }

  async validateStorageFile(repo: Repository, type: 'open-prs' | 'open-issues'): Promise<ValidationResult> {
    const repoPath = join(this.storeDir, 'repos', repo.name);
    const filePath = join(repoPath, `${type}.json`);
    
    if (!existsSync(filePath)) {
      return {
        valid: false,
        errors: [{ path: 'file', message: `File not found: ${filePath}` }]
      };
    }

    try {
      const rawData = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(rawData);
      
      if (type === 'open-prs') {
        validateStoredPRs(data);
      } else {
        validateStoredIssues(data);
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        };
      }
      return {
        valid: false,
        errors: [{ path: 'parse', message: String(error) }]
      };
    }
  }

  async validateCompleteness(repo: Repository): Promise<CompletenessReport> {
    const storedPRs = await this.storageService.loadOpenPRs(repo) || [];
    const storedIssues = await this.storageService.loadOpenIssues(repo) || [];
    
    const report: CompletenessReport = {
      repository: repo.name,
      openPRs: {
        stored: storedPRs.length,
        github: 0,
        match: false,
        missing: [],
        extra: []
      },
      openIssues: {
        stored: storedIssues.length,
        github: 0,
        match: false,
        missing: [],
        extra: []
      },
      dateUpdatedCheck: {
        prsWithoutDateUpdated: [],
        issuesWithoutDateUpdated: []
      }
    };

    const prsWithoutDateUpdated = storedPRs.filter(pr => !pr.dateUpdated);
    report.dateUpdatedCheck.prsWithoutDateUpdated = prsWithoutDateUpdated.map(pr => pr.number);
    
    const issuesWithoutDateUpdated = storedIssues.filter(issue => !issue.dateUpdated);
    report.dateUpdatedCheck.issuesWithoutDateUpdated = issuesWithoutDateUpdated.map(issue => issue.number);

    if (this.githubService) {
      try {
        const githubPRs = await this.githubService.fetchOpenPRs(repo);
        const githubIssues = await this.githubService.fetchOpenIssues(repo);
        
        report.openPRs.github = githubPRs.length;
        report.openIssues.github = githubIssues.length;
        
        const storedPRNumbers = new Set(storedPRs.map(pr => pr.number));
        const githubPRNumbers = new Set(githubPRs.map(pr => pr.number));
        
        report.openPRs.missing = Array.from(githubPRNumbers).filter(n => !storedPRNumbers.has(n));
        report.openPRs.extra = Array.from(storedPRNumbers).filter(n => !githubPRNumbers.has(n));
        report.openPRs.match = report.openPRs.missing.length === 0 && report.openPRs.extra.length === 0;
        
        const storedIssueNumbers = new Set(storedIssues.map(issue => issue.number));
        const githubIssueNumbers = new Set(githubIssues.map(issue => issue.number));
        
        report.openIssues.missing = Array.from(githubIssueNumbers).filter(n => !storedIssueNumbers.has(n));
        report.openIssues.extra = Array.from(storedIssueNumbers).filter(n => !githubIssueNumbers.has(n));
        report.openIssues.match = report.openIssues.missing.length === 0 && report.openIssues.extra.length === 0;
      } catch (error) {
        console.warn(`Could not fetch GitHub data for comparison: ${error}`);
      }
    }
    
    return report;
  }

  async generateFullReport(repo: Repository): Promise<ValidationReport> {
    const openPRsValidation = await this.validateStorageFile(repo, 'open-prs');
    const openIssuesValidation = await this.validateStorageFile(repo, 'open-issues');
    const completeness = await this.validateCompleteness(repo);
    
    const recommendations: string[] = [];
    
    if (!openPRsValidation.valid) {
      recommendations.push('Fix validation errors in open-prs.json');
    }
    
    if (!openIssuesValidation.valid) {
      recommendations.push('Fix validation errors in open-issues.json');
    }
    
    if (completeness.openPRs.missing.length > 0) {
      recommendations.push(`Sync missing PRs: ${completeness.openPRs.missing.join(', ')}`);
    }
    
    if (completeness.openPRs.extra.length > 0) {
      recommendations.push(`Remove closed PRs from open file: ${completeness.openPRs.extra.join(', ')}`);
    }
    
    if (completeness.openIssues.missing.length > 0) {
      recommendations.push(`Sync missing issues: ${completeness.openIssues.missing.join(', ')}`);
    }
    
    if (completeness.openIssues.extra.length > 0) {
      recommendations.push(`Remove closed issues from open file: ${completeness.openIssues.extra.join(', ')}`);
    }
    
    if (completeness.dateUpdatedCheck.prsWithoutDateUpdated.length > 0) {
      recommendations.push(`Add dateUpdated to PRs: ${completeness.dateUpdatedCheck.prsWithoutDateUpdated.join(', ')}`);
    }
    
    if (completeness.dateUpdatedCheck.issuesWithoutDateUpdated.length > 0) {
      recommendations.push(`Add dateUpdated to issues: ${completeness.dateUpdatedCheck.issuesWithoutDateUpdated.join(', ')}`);
    }
    
    return {
      repository: repo.name,
      timestamp: new Date(),
      openPRsValidation,
      openIssuesValidation,
      completeness,
      recommendations
    };
  }
}