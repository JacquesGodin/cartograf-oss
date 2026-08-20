import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";

function report(body: unknown, contentType = "application/csp-report") {
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// A request whose body is a stream carries no Content-Length (chunked), so the
// endpoint can only enforce its size cap by reading incrementally.
function streamedReport(text: string) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report" },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

const modernEntry = {
  type: "csp-violation",
  body: {
    documentURL: "https://cartograf.dev/app",
    effectiveDirective: "img-src",
    blockedURL: "https://evil.example.com/pixel.png",
    disposition: "enforce",
  },
};

describe("/api/csp-report", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("accepts a legacy report-uri payload and logs the normalized violation", async () => {
    const response = await POST(
      report({
        "csp-report": {
          "document-uri": "https://cartograf.dev/app",
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example.com/x.js",
          disposition: "enforce",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith(
      "csp_violation",
      expect.objectContaining({
        directive: "script-src",
        blockedUri: "https://evil.example.com/x.js",
        documentUri: "https://cartograf.dev/app",
        disposition: "enforce",
      }),
    );
  });

  it("accepts a modern reports+json payload", async () => {
    const response = await POST(report([modernEntry], "application/reports+json"));

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith(
      "csp_violation",
      expect.objectContaining({ directive: "img-src", blockedUri: "https://evil.example.com/pixel.png" }),
    );
  });

  it("logs each entry in a batched payload individually", async () => {
    const response = await POST(report([modernEntry, modernEntry, modernEntry], "application/reports+json"));

    expect(response.status).toBe(204);
    expect(warn.mock.calls.filter((call: unknown[]) => call[0] === "csp_violation")).toHaveLength(3);
  });

  it("returns 204 and does not throw on a malformed body", async () => {
    const response = await POST(report("not json{{{"));
    expect(response.status).toBe(204);
  });

  it("rejects an oversized body declared via Content-Length without parsing it", async () => {
    const huge = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report", "content-length": String(128 * 1024) },
      body: "x".repeat(128 * 1024),
    });
    const response = await POST(huge);
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects an oversized streamed body with no Content-Length", async () => {
    const response = await POST(streamedReport("x".repeat(128 * 1024)));
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("caps logged violations per window even across batched payloads", async () => {
    // Isolated module instance so the throttle counters don't interact with the
    // other tests' shared state.
    vi.resetModules();
    const { POST: FreshPOST } = await import("@/app/api/csp-report/route");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const batch = Array.from({ length: 50 }, () => modernEntry);
    // 3 requests × 50 entries = 150 attempts; the per-window cap is 100.
    for (let i = 0; i < 3; i++) {
      await FreshPOST(
        new Request("http://localhost/api/csp-report", {
          method: "POST",
          headers: { "content-type": "application/reports+json" },
          body: JSON.stringify(batch),
        }),
      );
    }

    const logged = spy.mock.calls.filter((call: unknown[]) => call[0] === "csp_violation").length;
    expect(logged).toBe(100);
    spy.mockRestore();
  });
});
