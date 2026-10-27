import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import {
  splitTimeline,
  type MappingData,
  type TimelineData,
} from "@/models/report-data";

const reportRoot = resolve(process.cwd(), "report-data");
export async function readReportFile(segments: string[]): Promise<Buffer> {
  if (
    !segments.length ||
    segments.some(
      (segment) =>
        !/^[\w .-]+$/.test(segment) || segment === "." || segment === "..",
    ) ||
    !/\.(json|csv)$/.test(segments.at(-1)!)
  )
    throw new Error("Invalid report path");
  const path = await realpath(resolve(reportRoot, ...segments));
  const inside = relative(reportRoot, path);
  if (!inside || inside.startsWith(".." + sep) || inside === "..")
    throw new Error("Invalid report path");
  return readFile(path);
}

let reports:
  | Promise<{
      parts: Record<string, unknown>[];
      mapping: MappingData;
      version: string;
    }>
  | undefined;
export function loadReports() {
  return (reports ??= (async () => {
    const timeline: TimelineData = JSON.parse(
      await readFile(resolve("contributor-repo-timeline.json"), "utf8"),
    );
    const mapping: MappingData = JSON.parse(
      (await readReportFile(["sheets", "github-mapping.json"])).toString(
        "utf8",
      ),
    );
    if (
      !timeline.data ||
      typeof timeline.data !== "object" ||
      !mapping.mapping ||
      typeof mapping.mapping !== "object"
    )
      throw new Error("Invalid report data");
    return {
      parts: splitTimeline(timeline.data),
      mapping,
      version: createHash("sha256")
        .update(JSON.stringify({ timeline, mapping }))
        .digest("hex"),
    };
  })().catch((error) => {
    reports = undefined;
    throw error;
  }));
}
