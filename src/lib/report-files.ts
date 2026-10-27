import { createHash } from "node:crypto";
import "server-only";
import { reportFiles, timelineText } from "@/generated/private-report-data";
import {
  splitTimeline,
  type MappingData,
  type TimelineData,
} from "@/models/report-data";

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
  const key = segments.join("/");
  if (!Object.hasOwn(reportFiles, key)) throw new Error("Report not found");
  return Buffer.from(reportFiles[key], "utf8");
}

export function reportRepositories() {
  return [
    ...new Set(
      Object.keys(reportFiles)
        .filter((path) => path.startsWith("repos/"))
        .map((path) => path.split("/")[1]),
    ),
  ].sort();
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
    const timeline: TimelineData = JSON.parse(timelineText);
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
