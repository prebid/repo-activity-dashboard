import { NextResponse } from "next/server";
import { requireDataAccess, privateHeaders } from "@/lib/auth/site-access";
import { readReportFile } from "@/lib/report-files";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } },
) {
  try {
    const denied = await requireDataAccess();
    if (denied) return denied;
    const data = await readReportFile(params.path);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        ...privateHeaders,
        "Content-Type": params.path.at(-1)!.endsWith(".csv")
          ? "text/csv; charset=utf-8"
          : "application/json; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Report not found" },
      { status: 404, headers: privateHeaders },
    );
  }
}
