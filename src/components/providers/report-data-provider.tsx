"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { ReportData } from "@/models/report-data";
const Context = createContext<ReportData | null>(null);
export function ReportDataProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const request = new AbortController();
    const read = async (page: number) => {
      const response = await fetch("/api/report-data?page=" + page, {
        signal: request.signal,
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        router.refresh();
        throw new Error("Sign in required");
      }
      if (!response.ok) throw new Error("Reports unavailable");
      return response.json();
    };
    void (async () => {
      const first = await read(0);
      if (
        typeof first.version !== "string" ||
        !Number.isInteger(first.pages) ||
        first.pages < 1 ||
        first.pages > 1000 ||
        !first.mapping?.mapping ||
        !first.data
      )
        throw new Error("Invalid report response");
      const parts = [first];
      for (let page = 1; page < first.pages; page++) {
        const part = await read(page);
        if (
          part.version !== first.version ||
          part.page !== page ||
          part.pages !== first.pages ||
          !part.data
        )
          throw new Error("Incomplete report response");
        parts.push(part);
      }
      if (!request.signal.aborted)
        setReports({
          timeline: {
            data: Object.fromEntries(
              parts.flatMap((part) => Object.entries(part.data)),
            ),
          },
          mapping: first.mapping,
        });
    })().catch(() => {
      if (!request.signal.aborted) setError(true);
    });
    return () => request.abort();
  }, [router]);
  if (error)
    return (
      <p role="alert" className="p-8">
        Unable to load reports. Refresh this page to try again.
      </p>
    );
  if (!reports)
    return (
      <p role="status" className="p-8">
        Loading reports…
      </p>
    );
  return <Context.Provider value={reports}>{children}</Context.Provider>;
}
export function useReportData() {
  const reports = useContext(Context);
  if (!reports) throw new Error("ReportDataProvider is required");
  return reports;
}
