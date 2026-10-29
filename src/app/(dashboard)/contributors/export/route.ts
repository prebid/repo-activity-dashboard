import { contributionExportResponse } from '@/server/contribution-export';
export function GET(request: Request) {
  return contributionExportResponse(request, 'contributors');
}
