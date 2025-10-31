'use client';

import { AssigneeStats } from '@/types/repo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AssigneeStatsCardProps {
  stats: AssigneeStats[];
}

export function AssigneeStatsCard({ stats }: AssigneeStatsCardProps) {
  if (stats.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3 text-center" style={{ paddingTop: '16px' }}>
          <CardTitle style={{ fontSize: '1.5rem', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
            Issue Assignees
          </CardTitle>
          <CardDescription className="text-sm">Current issue assignments</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <p className="text-sm text-muted-foreground">
            No assignees for open issues
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 text-center" style={{ paddingTop: '16px' }}>
        <CardTitle style={{ fontSize: '1.5rem', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
          Issue Assignees
        </CardTitle>
        <CardDescription className="text-sm">
          <span className="font-semibold" style={{ color: '#16a34a' }}>{stats.length}</span> <span style={{ color: '#60a5fa' }}>assignee{stats.length !== 1 ? 's' : ''} with open issues</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="space-y-3 flex flex-col items-center mt-6">
          {stats.map((assignee) => (
            <div
              key={assignee.login}
              className="flex items-center justify-start px-4 py-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
              style={{ gap: '32px' }}
            >
              <div className="font-semibold text-sm min-w-[120px]" style={{ color: '#f97316' }}>{assignee.login}</div>
              <Badge variant="secondary" className="font-medium">
                {assignee.totalAssigned} issue{assignee.totalAssigned !== 1 ? 's' : ''}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
