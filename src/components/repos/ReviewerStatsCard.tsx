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

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 text-center" style={{ paddingTop: '16px' }}>
        <CardTitle style={{ fontSize: '1.5rem', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
          PR Reviewers
        </CardTitle>
        <CardDescription className="text-sm">
          <span className="font-semibold" style={{ color: '#16a34a' }}>{stats.length}</span> <span style={{ color: '#60a5fa' }}>reviewer{stats.length !== 1 ? 's' : ''} with assignments</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="space-y-3 flex flex-col items-center mt-6">
          {/* Column Headers */}
          <div className="flex items-center justify-between px-4 py-2 w-full text-xs font-medium text-muted-foreground">
            <div className="min-w-[140px]">Reviewer</div>
            <div className="flex items-center gap-2">
              <div className="w-[60px] text-center">Total</div>
              <div className="w-[75px] text-center">Approved</div>
              <div className="w-[75px] text-center">Changes</div>
              <div className="w-[85px] text-center">Comments</div>
              <div className="w-[75px] text-center">Pending</div>
            </div>
          </div>

          {stats.map((reviewer) => (
            <div
              key={reviewer.login}
              className="flex items-center justify-between px-4 py-3 rounded-md bg-muted/50 hover:bg-muted transition-colors w-full"
            >
              <div className="font-semibold text-sm min-w-[140px]" style={{ color: '#f97316' }}>{reviewer.login}</div>
              <div className="flex items-center gap-2">
                <div className="w-[60px] flex justify-center">
                  <Badge variant="outline" className="font-medium">
                    {reviewer.totalAssigned}
                  </Badge>
                </div>
                <div className="w-[75px] flex justify-center">
                  {reviewer.approved > 0 ? (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white dark:bg-green-700 text-xs">
                      {reviewer.approved}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </div>
                <div className="w-[75px] flex justify-center">
                  {reviewer.changesRequested > 0 ? (
                    <Badge className="bg-red-600 hover:bg-red-600 text-white dark:bg-red-700 text-xs">
                      {reviewer.changesRequested}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </div>
                <div className="w-[85px] flex justify-center">
                  {reviewer.commented > 0 ? (
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white dark:bg-blue-700 text-xs">
                      {reviewer.commented}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </div>
                <div className="w-[75px] flex justify-center">
                  {reviewer.pending > 0 ? (
                    <Badge variant="secondary" className="font-medium text-xs">
                      {reviewer.pending}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
