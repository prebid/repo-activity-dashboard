'use client';

import { ReviewerStats } from '@/types/repo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ReviewerStatsCardProps {
  stats: ReviewerStats[];
}

export function ReviewerStatsCard({ stats }: ReviewerStatsCardProps) {
  if (stats.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3 text-center" style={{ paddingTop: '16px' }}>
          <CardTitle style={{ fontSize: '1.5rem', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
            PR Reviewers
          </CardTitle>
          <CardDescription className="text-sm">Current reviewer assignments</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <p className="text-sm text-muted-foreground">
            No reviewers currently assigned to open PRs
          </p>
        </CardContent>
      </Card>
    );
  }

  const reviewersWithPending = stats.filter(reviewer => reviewer.pending > 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 text-center" style={{ paddingTop: '16px' }}>
        <CardTitle style={{ fontSize: '1.5rem', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
          PR Reviewers
        </CardTitle>
        <CardDescription className="text-sm">
          <span className="font-semibold" style={{ color: '#16a34a' }}>{reviewersWithPending.length}</span> <span style={{ color: '#60a5fa' }}>reviewer{reviewersWithPending.length !== 1 ? 's' : ''} with pending assignments</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="space-y-3 flex flex-col items-center mt-6">
          {reviewersWithPending.map((reviewer) => (
            <div
              key={reviewer.login}
              className="flex items-center justify-start px-4 py-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
              style={{ gap: '32px' }}
            >
              <div className="font-semibold text-sm min-w-[120px]" style={{ color: '#f97316' }}>{reviewer.login}</div>
              <Badge variant="secondary" className="font-medium">
                {reviewer.pending} PR{reviewer.pending !== 1 ? 's' : ''}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
