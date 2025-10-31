'use client';

import { RepoConfig } from '@/types/repo';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface RepoHeaderProps {
  config: RepoConfig;
  lastSync: Date;
}

export function RepoHeader({ config, lastSync }: RepoHeaderProps) { 
  const categoryColors: Record<string, string> = {
    Client: 'bg-blue-500 hover:bg-blue-500 text-white',
    Server: 'bg-emerald-500 hover:bg-emerald-500 text-white',
    Mobile: 'bg-purple-500 hover:bg-purple-500 text-white',
    Docs: 'bg-orange-500 hover:bg-orange-500 text-white',
  };

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-0">
      <h1 className="text-4xl font-bold tracking-tight">{config.displayName}</h1>
      <a
        href={config.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base !text-blue-400 hover:!text-blue-500 dark:!text-blue-400 dark:hover:!text-blue-300 transition-colors flex items-center gap-2 font-medium no-underline mt-1"
      >
        {config.owner}/{config.repo}
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
