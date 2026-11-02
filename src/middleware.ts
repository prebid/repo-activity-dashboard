import { NextResponse, type NextRequest } from 'next/server';
// Only navigation context is captured here. Authorization runs in Node server layouts/routes.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-dashboard-return-path', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
};
