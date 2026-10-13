import "server-only";
import snapshot from "@/data/snapshot.json";
import type { ObservatoryData } from "./types";

/**
 * The Observatory draws whatever thesis-agent publishes.
 *
 * OBSERVATORY_DATA_URL  where data/observatory.json lives: your fork's raw GitHub URL
 *                       (or its contents-API URL). Defaults to the reference instance.
 * OBSERVATORY_DATA_TOKEN read-only token, only needed if your engine repo is private.
 *
 * The page revalidates hourly, so a Monday run appears within the hour without a
 * redeploy. If the fetch fails, the bundled snapshot is served and the page says so.
 */
// raw.githubusercontent.com has no API rate limit, which matters on shared hosting IPs.
const DEFAULT_URL = "https://raw.githubusercontent.com/lachlan-sear/Thesis-Agent/main/data/observatory.json";

export const REVALIDATE_SECONDS = 3600;

export async function getObservatory(): Promise<{ data: ObservatoryData; live: boolean }> {
  const url = process.env.OBSERVATORY_DATA_URL || DEFAULT_URL;
  const token = process.env.OBSERVATORY_DATA_TOKEN;
  const headers: Record<string, string> = {};
  if (url.includes("api.github.com")) headers.Accept = "application/vnd.github.raw+json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { headers, next: { revalidate: REVALIDATE_SECONDS, tags: ["observatory"] } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ObservatoryData;
    if (!Array.isArray(data.companies) || !data.thesis) throw new Error("unexpected shape");
    return { data, live: true };
  } catch {
    return { data: snapshot as unknown as ObservatoryData, live: false };
  }
}
