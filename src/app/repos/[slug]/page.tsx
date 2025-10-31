'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VALID_SLUGS, type RepoSlug } from '@/config/repositories';
import { getRepoPageData } from '@/lib/repoData';
import { RepoHeader } from '@/components/repos/RepoHeader';
import { ReviewerStatsCard } from '@/components/repos/ReviewerStatsCard';
import { AssigneeStatsCard } from '@/components/repos/AssigneeStatsCard';
import { OpenPRsTable } from '@/components/repos/OpenPRsTable';
import { RepoPageData } from '@/types/repo';

export default function RepoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<RepoPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate slug
    if (!VALID_SLUGS.includes(slug as RepoSlug)) {
      router.push('/404');
      return;
    }

    // Load data
    const loadData = async () => {
      try {
        setLoading(true);
        const pageData = await getRepoPageData(slug as RepoSlug);
        setData(pageData);
        setError(null);
      } catch (err) {
        console.error('Failed to load repo data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load repository data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="w-full px-6 py-8">
        {/* Loading skeleton */}
        <div className="container mx-auto max-w-[1400px] pt-8" style={{ marginBottom: '64px' }}>
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-10 w-96 bg-muted animate-pulse rounded" />
            <div className="h-5 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>

        <div className="container mx-auto max-w-[1400px]" style={{ marginBottom: '64px' }}>
          <div className="grid grid-cols-2" style={{ gap: '32px' }}>
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded mb-4" />
              <div className="space-y-2">
                <div className="h-14 bg-muted animate-pulse rounded" />
                <div className="h-14 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded mb-4" />
              <div className="space-y-2">
                <div className="h-14 bg-muted animate-pulse rounded" />
                <div className="h-14 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-[95%]">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mb-4" />
            <div className="space-y-2">
              <div className="h-12 bg-muted animate-pulse rounded" />
              <div className="h-12 bg-muted animate-pulse rounded" />
              <div className="h-12 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full px-6 py-8">
        <div className="container mx-auto max-w-[1400px] pt-8">
          <div className="max-w-2xl mx-auto rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Repository</h2>
            <p className="text-muted-foreground">{error || 'Failed to load repository data'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-8">
      {/* Repo Header - Centered, No Card */}
      <div className="container mx-auto max-w-[1400px] pt-8" style={{ marginBottom: '64px' }}>
        <RepoHeader config={data.config} lastSync={data.lastSync} />
      </div>

      {/* Reviewer & Assignee Stats - Side by Side */}
      <div className="container mx-auto max-w-[1400px]" style={{ marginBottom: '64px' }}>
        <div className="grid grid-cols-2" style={{ gap: '32px' }}>
          <ReviewerStatsCard stats={data.reviewerStats} />
          <AssigneeStatsCard stats={data.assigneeStats} />
        </div>
      </div>

      {/* Open PRs Table - Full Width */}
      <div className="container mx-auto max-w-[95%]">
        <OpenPRsTable prs={data.prTableData} />
      </div>
    </div>
  );
}
