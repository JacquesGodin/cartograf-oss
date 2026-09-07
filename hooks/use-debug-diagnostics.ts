"use client";

import { useEffect, useRef } from "react";
import {
  debugLog,
  debugLogThrottled,
  debugWarn,
  debugWarnThrottled,
  getBrowserSnapshot,
  isDebugEnabled,
} from "@/lib/debug-logger";

type SnapshotFactory = () => Record<string, unknown>;

export function useRenderDiagnostics(
  scope: string,
  getSnapshot?: SnapshotFactory
) {
  const renderCount = useRef(0);
  const windowStats = useRef({ startMs: 0, count: 0 });

  useEffect(() => {
    renderCount.current += 1;

    if (!isDebugEnabled()) return;

    const now = performance.now();
    if (windowStats.current.startMs === 0 || now - windowStats.current.startMs > 5_000) {
      windowStats.current = { startMs: now, count: 0 };
    }

    windowStats.current.count += 1;
    if (windowStats.current.count === 25) {
      debugWarnThrottled(
        `${scope}:render-burst`,
        scope,
        "25 renders within 5 seconds",
        {
          totalRenders: renderCount.current,
          ...safeSnapshot(getSnapshot),
        },
        10_000
      );
    }
  });

  useEffect(() => {
    debugLog(scope, "mounted", safeSnapshot(getSnapshot));
    return () => {
      debugLog(scope, "unmounted", { totalRenders: renderCount.current });
    };
    // Logging only; avoid rerunning mount logs when snapshot values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    debugLogThrottled(
      `${scope}:render-checkpoint`,
      scope,
      "render checkpoint",
      {
        totalRenders: renderCount.current,
        ...safeSnapshot(getSnapshot),
      }
    );
  });
}

export function useBrowserDiagnostics(
  scope: string,
  getSnapshot?: SnapshotFactory
) {
  const snapshotRef = useRef(getSnapshot);

  useEffect(() => {
    snapshotRef.current = getSnapshot;
  });

  useEffect(() => {
    debugLog(scope, "browser diagnostics started", {
      ...getBrowserSnapshot(),
      ...safeSnapshot(snapshotRef.current),
    });

    const interval = window.setInterval(() => {
      debugLog(scope, "browser heartbeat", {
        ...getBrowserSnapshot(),
        ...safeSnapshot(snapshotRef.current),
      });
    }, 15_000);

    const observer = createLongTaskObserver(scope, () =>
      safeSnapshot(snapshotRef.current)
    );

    return () => {
      window.clearInterval(interval);
      observer?.disconnect();
      debugLog(scope, "browser diagnostics stopped");
    };
    // Logging only; keep one interval per component mount.
  }, [scope]);
}

function createLongTaskObserver(scope: string, getSnapshot?: SnapshotFactory) {
  if (typeof PerformanceObserver === "undefined") return undefined;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        debugWarnThrottled(
          `${scope}:long-task`,
          scope,
          "browser long task",
          {
            durationMs: Math.round(entry.duration),
            startTimeMs: Math.round(entry.startTime),
            ...safeSnapshot(getSnapshot),
          },
          5_000
        );
      }
    });

    observer.observe({ entryTypes: ["longtask"] });
    return observer;
  } catch (error) {
    debugWarn(scope, "long task observer unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

function safeSnapshot(getSnapshot?: SnapshotFactory) {
  if (!getSnapshot) return {};
  try {
    return getSnapshot();
  } catch (error) {
    return {
      snapshotError: error instanceof Error ? error.message : String(error),
    };
  }
}
