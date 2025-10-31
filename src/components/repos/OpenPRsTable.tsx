'use client';

import { useState } from 'react';
import { PRTableRow } from '@/types/repo';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OpenPRsTableProps {
  prs: PRTableRow[];
}

type SortField = 'number' | 'reviewersAssigned' | 'reviewersApproved' | 'reviewersChangesRequested' | 'reviewersCommented' | 'daysSinceOpen' | 'daysSinceUpdate';
type SortDirection = 'asc' | 'desc';

export function OpenPRsTable({ prs }: OpenPRsTableProps) {
  const [sortField, setSortField] = useState<SortField>('daysSinceUpdate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPRs = [...prs].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    return (a[sortField] - b[sortField]) * multiplier;
  });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1 font-medium"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 text-center" style={{ paddingTop: '16px' }}>
        <CardTitle style={{ fontSize: '1.5rem', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
          Open Pull Requests
        </CardTitle>
        <CardDescription className="text-sm">
          <span className="font-semibold" style={{ color: '#16a34a' }}>{prs.length}</span> <span style={{ color: '#60a5fa' }}>open PR{prs.length !== 1 ? 's' : ''}</span>
          {prs.filter(pr => pr.hasNoReviewers).length > 0 && (
            <span className="ml-2 font-medium" style={{ color: '#dc2626' }}>
              • {prs.filter(pr => pr.hasNoReviewers).length} without reviewers
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[80px]">
                <SortButton field="number">PR #</SortButton>
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[100px]">
                <SortButton field="reviewersAssigned">Reviewers</SortButton>
              </TableHead>
              <TableHead className="w-[90px]">
                <SortButton field="reviewersApproved">Approved</SortButton>
              </TableHead>
              <TableHead className="w-[90px]">
                <SortButton field="reviewersChangesRequested">Changes</SortButton>
              </TableHead>
              <TableHead className="w-[100px]">
                <SortButton field="reviewersCommented">Comments</SortButton>
              </TableHead>
              <TableHead className="w-[110px]">
                <SortButton field="daysSinceOpen">Days Open</SortButton>
              </TableHead>
              <TableHead className="w-[130px]">
                <SortButton field="daysSinceUpdate">Last Update</SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPRs.map((pr) => {
              return (
                <TableRow
                  key={pr.number}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-mono">
                    <a
                      href={pr.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1 !text-blue-400 hover:!text-blue-500 dark:!text-blue-400 dark:hover:!text-blue-300"
                    >
                      #{pr.number}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="truncate font-semibold text-base" title={pr.title}>
                      {pr.title}
                    </div>
                    <div className="text-xs mt-1 flex items-center">
                      <span className="font-semibold" style={{ color: '#f97316' }}>{pr.author}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={pr.reviewersAssigned === 0 ? "outline" : "secondary"} 
                      className={pr.reviewersAssigned === 0 ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800" : ""}
                    >
                      {pr.reviewersAssigned}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pr.reviewersApproved > 0 ? (
                      <Badge className="bg-green-600 hover:bg-green-600 text-white dark:bg-green-700 dark:text-white">
                        ✓ {pr.reviewersApproved}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pr.reviewersChangesRequested > 0 ? (
                      <Badge className="bg-red-600 hover:bg-red-600 text-white dark:bg-red-700 dark:text-white">
                        {pr.reviewersChangesRequested}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pr.reviewersCommented > 0 ? (
                      <Badge className="bg-blue-600 hover:bg-blue-600 text-white dark:bg-blue-700 dark:text-white">
                        {pr.reviewersCommented}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {pr.daysSinceOpen}d
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        pr.daysSinceUpdate > 7
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
                          : pr.daysSinceUpdate > 3
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800'
                          : 'font-medium'
                      }
                    >
                      {pr.daysSinceUpdate}d
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
