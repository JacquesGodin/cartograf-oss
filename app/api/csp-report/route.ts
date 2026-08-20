import { NextResponse } from "next/server";

// Endpoint for CSP violation reports (referenced by `report-uri` in the policy
// set in next.config.mjs). It is intentionally unauthenticated — browsers send
// these reports without credentials — and does no database or provider work, so
// it ships in both the cloud and OSS editions. Every request returns 204 so the
// browser treats the report as delivered, even when the body is junk.

const MAX_REPORT_BYTES = 64 * 1024;

// A single `reports+json` payload can batch many entries. Cap how many we parse
// out of one request so a densely-packed body can't force unbounded work.
const MAX_VIOLATIONS_PER_REQUEST = 50;

// Bound how much we log per rolling minute so a flood of reports (or a
// deliberate one) can't drown the logs. The quota is applied per *violation*,
// not per request — otherwise a single batched payload could emit far more log
// lines than the limit. Excess violations are counted and summarised instead.
const LOG_LIMIT_PER_WINDOW = 100;
const WINDOW_MS = 60_000;

let windowStartedAt = 0;
let loggedInWindow = 0;
let droppedInWindow = 0;

function shouldLog(now: number): boolean {
  if (now - windowStartedAt > WINDOW_MS) {
    if (droppedInWindow > 0) {
      console.warn("csp_violation_report_throttled", { dropped: droppedInWindow });
    }
    windowStartedAt = now;
    loggedInWindow = 0;
    droppedInWindow = 0;
  }
  if (loggedInWindow < LOG_LIMIT_PER_WINDOW) {
    loggedInWindow += 1;
    return true;
  }
  droppedInWindow += 1;
  return false;
}

/**
 * Read the request body, aborting as soon as it exceeds `maxBytes`. This
 * enforces the cap *while* streaming rather than buffering the whole body
 * first, so a chunked or understated-Content-Length request can't force us to
 * allocate more than the limit. Returns null when the body is too large or
 * unreadable.
 */
async function readCappedBody(request: Request, maxBytes: number): Promise<string | null> {
  const body = request.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function truncate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > 256 ? `${value.slice(0, 256)}…` : value;
}

type NormalizedViolation = {
  directive?: string;
  blockedUri?: string;
  documentUri?: string;
  disposition?: string;
};

/**
 * Normalise both wire formats into a compact record, capped at
 * MAX_VIOLATIONS_PER_REQUEST:
 * - `report-uri`: { "csp-report": { "violated-directive", "blocked-uri", ... } }
 * - `report-to`:  [ { "type": "csp-violation", "body": { "effectiveDirective", ... } } ]
 */
function normalizeReports(parsed: unknown): NormalizedViolation[] {
  const out: NormalizedViolation[] = [];

  const fromLegacy = (report: Record<string, unknown>): NormalizedViolation => ({
    directive: truncate(report["effective-directive"] ?? report["violated-directive"]),
    blockedUri: truncate(report["blocked-uri"]),
    documentUri: truncate(report["document-uri"]),
    disposition: truncate(report["disposition"]),
  });

  const fromModern = (body: Record<string, unknown>): NormalizedViolation => ({
    directive: truncate(body["effectiveDirective"] ?? body["violatedDirective"]),
    blockedUri: truncate(body["blockedURL"]),
    documentUri: truncate(body["documentURL"]),
    disposition: truncate(body["disposition"]),
  });

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (out.length >= MAX_VIOLATIONS_PER_REQUEST) break;
      if (entry && typeof entry === "object" && "body" in entry) {
        const body = (entry as { body?: unknown }).body;
        if (body && typeof body === "object") out.push(fromModern(body as Record<string, unknown>));
      }
    }
  } else if (parsed && typeof parsed === "object") {
    const legacy = (parsed as { "csp-report"?: unknown })["csp-report"];
    if (legacy && typeof legacy === "object") {
      out.push(fromLegacy(legacy as Record<string, unknown>));
    }
  }

  return out;
}

export async function POST(request: Request) {
  // Fast path: reject honestly-declared oversized bodies without reading them.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REPORT_BYTES) {
    return new NextResponse(null, { status: 204 });
  }

  const raw = await readCappedBody(request, MAX_REPORT_BYTES);
  if (raw === null || raw.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  let violations: NormalizedViolation[];
  try {
    violations = normalizeReports(JSON.parse(raw));
  } catch {
    // Malformed body — still return 204 below.
    return new NextResponse(null, { status: 204 });
  }

  const now = Date.now();
  for (const violation of violations) {
    // Apply the quota per violation so a batched payload can't outrun the cap.
    if (shouldLog(now)) {
      console.warn("csp_violation", violation);
    }
  }

  return new NextResponse(null, { status: 204 });
}
