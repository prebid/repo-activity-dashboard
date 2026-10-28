import { describe, it, expect } from 'vitest';
import { repositoryCatalog } from '@/config/repositories';
import { repositorySummaries, repositorySample } from '@/mocks/reporting';
describe('catalog and prepared samples', () => {
  it('contains the complete 18-repository catalog without duplicate identifiers', () => {
    expect(repositoryCatalog).toHaveLength(18);
    for (const field of ['id', 'githubId', 'slug'] as const)
      expect(new Set(repositoryCatalog.map((r) => r[field])).size).toBe(18);
    expect(repositoryCatalog.find((r) => r.name === 'prebid-mobile-ios-sdk')?.primaryBranch).toBe(
      'main',
    );
    expect(repositoryCatalog.find((r) => r.name === 'Prebid.js')?.slug).toBe('prebidjs');
  });
  it('reconciles summary and detail counts for every repository', () => {
    for (const summary of repositorySummaries) {
      const rows = repositorySample(summary.repositoryId);
      expect(rows.prs).toHaveLength(summary.openPrs);
      expect(rows.issues).toHaveLength(summary.openIssues);
      expect(rows.prs.filter((r) => r.draft)).toHaveLength(summary.draftPrs);
      expect(rows.prs.filter((r) => !r.draft && r.ageDays > 60)).toHaveLength(summary.agedPrs);
    }
  });
  it('has a large deterministic backlog and oldest searchable item', () => {
    const { prs, issues } = repositorySample('repo-prebidjs');
    expect(prs).toHaveLength(137);
    expect(issues).toHaveLength(834);
    expect(new Set([...prs, ...issues].map((row) => new URL(row.url).hostname))).toEqual(
      new Set(['github.example']),
    );
    expect(issues[0].number).toBe(834);
    expect(issues.at(-1)?.title).toContain('Oldest sample issue');
    expect(prs.filter((r) => !r.draft && r.humanReviewers === 0)).toHaveLength(39);
    expect(repositorySample('repo-prebidjs')).toEqual({ prs, issues });
  });
  it('does not invent an unknown repository', () =>
    expect(() => repositorySample('missing')).toThrow('Unknown sample repository'));
});
