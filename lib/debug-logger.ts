import type { Project } from "@/lib/types";

type DebugData = Record<string, unknown>;
type BrowserSnapshotOptions = {
  includeLocalStorage?: boolean;
};

interface BrowserMemory {
  jsHeapSizeLimit?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: BrowserMemory;
}

const DEBUG_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_STACKMAPPER_DEBUG !== "0";

const throttleTimes = new Map<string, number>();

export function isDebugEnabled() {
  return DEBUG_ENABLED && typeof window !== "undefined";
}

export function debugLog(scope: string, message: string, data?: DebugData) {
  if (!isDebugEnabled()) return;
  console.info(formatPrefix(scope), message, data ?? "");
}

export function debugWarn(scope: string, message: string, data?: DebugData) {
  if (!isDebugEnabled()) return;
  console.warn(formatPrefix(scope), message, data ?? "");
}

export function debugLogThrottled(
  key: string,
  scope: string,
  message: string,
  data?: DebugData,
  intervalMs = 5_000
) {
  if (!isDebugEnabled()) return;
  const now = performance.now();
  const last = throttleTimes.get(key) ?? 0;
  if (now - last < intervalMs) return;
  throttleTimes.set(key, now);
  debugLog(scope, message, data);
}

export function debugWarnThrottled(
  key: string,
  scope: string,
  message: string,
  data?: DebugData,
  intervalMs = 5_000
) {
  if (!isDebugEnabled()) return;
  const now = performance.now();
  const last = throttleTimes.get(key) ?? 0;
  if (now - last < intervalMs) return;
  throttleTimes.set(key, now);
  debugWarn(scope, message, data);
}

export function getBrowserSnapshot(options: BrowserSnapshotOptions = {}) {
  if (typeof window === "undefined") return {};

  return {
    url: window.location.href,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    heap: getHeapSnapshot(),
    localStorageBytes: options.includeLocalStorage
      ? getLocalStorageBytes()
      : undefined,
  };
}

export function summarizeProjects(projects: Project[]) {
  const techCount = projects.reduce(
    (total, project) =>
      total + (Array.isArray(project.techInstances) ? project.techInstances.length : 0),
    0
  );
  const completeCount = projects.filter(
    (project) => typeof project.displayName === "string"
  ).length;

  return {
    projectCount: projects.length,
    completeCount,
    techCount,
    largestProjectTechCount: projects.reduce(
      (max, project) =>
        Math.max(max, Array.isArray(project.techInstances) ? project.techInstances.length : 0),
      0
    ),
  };
}

export function measureDuration(startMs: number) {
  if (typeof performance === "undefined") return undefined;
  return Math.round(performance.now() - startMs);
}

function formatPrefix(scope: string) {
  return `[stackmapper:${scope}]`;
}

function getHeapSnapshot() {
  const memory = (performance as PerformanceWithMemory).memory;
  if (!memory) return undefined;

  return {
    used: formatBytes(memory.usedJSHeapSize),
    total: formatBytes(memory.totalJSHeapSize),
    limit: formatBytes(memory.jsHeapSizeLimit),
  };
}

function getLocalStorageBytes() {
  try {
    let bytes = 0;
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      bytes += key.length + (window.localStorage.getItem(key)?.length ?? 0);
    }
    return bytes;
  } catch {
    return undefined;
  }
}

function formatBytes(value: number | undefined) {
  if (typeof value !== "number") return undefined;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value / 1024 / 1024)} MB`;
}
