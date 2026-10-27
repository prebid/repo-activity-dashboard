import { NextRequest, NextResponse } from "next/server";
import { requireDataAccess, privateHeaders } from "@/lib/auth/site-access";
import { loadReports } from "@/lib/report-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const denied = await requireDataAccess();
    if (denied) return denied;
    const page = Number(request.nextUrl.searchParams.get("page") ?? "0");
    const { parts, mapping, version } = await loadReports();
    if (!Number.isInteger(page) || page < 0 || page >= parts.length)
      return NextResponse.json(
        { error: "Unknown report page" },
        { status: 404, headers: privateHeaders },
      );
    return NextResponse.json(
      {
        version,
        page,
        pages: parts.length,
        data: parts[page],
        ...(page === 0 ? { mapping } : {}),
      },
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Report data unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
