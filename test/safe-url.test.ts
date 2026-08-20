import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "@/lib/safe-url";

describe("safeExternalUrl", () => {
  it("allows absolute http and https URLs", () => {
    expect(safeExternalUrl("https://github.com/owner/repo")).toBe("https://github.com/owner/repo");
    expect(safeExternalUrl("http://example.com")).toBe("http://example.com");
  });

  it("rejects javascript: and other script-bearing schemes", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeUndefined();
    // Tab/newline evasions that the URL parser (and the browser) normalise away.
    expect(safeExternalUrl("java\tscript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("java\nscript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("  javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeExternalUrl("blob:https://example.com/uuid")).toBeUndefined();
  });

  it("rejects relative, empty, and unparseable values", () => {
    expect(safeExternalUrl("/relative/path")).toBeUndefined();
    expect(safeExternalUrl("not a url")).toBeUndefined();
    expect(safeExternalUrl("")).toBeUndefined();
    expect(safeExternalUrl(null)).toBeUndefined();
    expect(safeExternalUrl(undefined)).toBeUndefined();
  });
});
