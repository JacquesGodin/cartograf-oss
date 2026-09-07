import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

describe("public discovery origin", () => {
  it.each(["http://cartograf.dev", "https://cartograf.dev/", "https://www.cartograf.dev"])(
    "uses the final HTTPS www host for %s", (origin) => {
      expect(siteUrl(origin)).toBe("https://www.cartograf.dev");
    },
  );

  it("defaults to the canonical production host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    expect(siteUrl()).toBe("https://www.cartograf.dev");
  });

  it.each(["http://localhost:3000", "https://selfhost.example.org"])(
    "preserves a self-hosted origin: %s", (origin) => {
      expect(siteUrl(`${origin}/`)).toBe(origin);
    },
  );
});
