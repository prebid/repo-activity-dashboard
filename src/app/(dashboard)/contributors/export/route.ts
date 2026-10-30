import { contributionExportResponse } from '@/server/contribution-export';
export function GET(request: Request) {
  return contributionExportResponse(request, 'contributors');
}

export function POST(request: Request) {
  return contributionExportResponse(request, 'contributors');
}
