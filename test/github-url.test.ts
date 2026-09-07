import { describe, it, expect } from "vitest";
import {
  parseRepoUrl,
  isValidGitHubOwner,
  isValidGitHubRepo,
} from "@/lib/github-url";

describe("parseRepoUrl", () => {
  it("parses owner/repo shorthand", () => {
    expect(parseRepoUrl("vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("parses github.com/owner/repo without scheme", () => {
    expect(parseRepoUrl("github.com/vercel/swr")).toEqual({ owner: "vercel", repo: "swr" });
  });

  it("parses a full https URL", () => {
    expect(parseRepoUrl("https://github.com/facebook/react")).toEqual({ owner: "facebook", repo: "react" });
  });

  it("accepts www.github.com", () => {
    expect(parseRepoUrl("https://www.github.com/vercel/swr")).toEqual({ owner: "vercel", repo: "swr" });
  });

  it("strips a trailing .git", () => {
    expect(parseRepoUrl("https://github.com/vercel/swr.git")).toEqual({ owner: "vercel", repo: "swr" });
  });

  it("ignores query strings and hashes", () => {
    expect(parseRepoUrl("github.com/vercel/swr?tab=readme#top")).toEqual({ owner: "vercel", repo: "swr" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseRepoUrl("  vercel/swr  ")).toEqual({ owner: "vercel", repo: "swr" });
  });

  it("rejects non-github hosts", () => {
    expect(parseRepoUrl("https://gitlab.com/foo/bar")).toBeNull();
    expect(parseRepoUrl("https://evil.com/vercel/swr")).toBeNull();
    // look-alike host must not slip through
    expect(parseRepoUrl("https://github.com.evil.com/a/b")).toBeNull();
  });

  it("rejects incomplete references", () => {
    expect(parseRepoUrl("vercel")).toBeNull();
    expect(parseRepoUrl("")).toBeNull();
    expect(parseRepoUrl("/")).toBeNull();
  });

  it("rejects path traversal and malformed names", () => {
    expect(parseRepoUrl("vercel/..")).toBeNull();
    expect(parseRepoUrl("../etc/passwd")).toBeNull();
    expect(parseRepoUrl("bad owner/repo")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(parseRepoUrl("http://")).toBeNull();
  });
});

describe("isValidGitHubOwner", () => {
  it("accepts valid owners", () => {
    expect(isValidGitHubOwner("vercel")).toBe(true);
    expect(isValidGitHubOwner("a")).toBe(true);
    expect(isValidGitHubOwner("Some-Org-123")).toBe(true);
  });

  it("rejects invalid owners", () => {
    expect(isValidGitHubOwner(undefined)).toBe(false);
    expect(isValidGitHubOwner("")).toBe(false);
    expect(isValidGitHubOwner("-leading")).toBe(false);
    expect(isValidGitHubOwner("trailing-")).toBe(false);
    expect(isValidGitHubOwner("has space")).toBe(false);
    expect(isValidGitHubOwner("a".repeat(40))).toBe(false); // > 39 chars
  });
});

describe("isValidGitHubRepo", () => {
  it("accepts valid repos including dots/underscores/hyphens", () => {
    expect(isValidGitHubRepo("next.js")).toBe(true);
    expect(isValidGitHubRepo("my_repo-1")).toBe(true);
  });

  it("rejects '.' and '..' and empties", () => {
    expect(isValidGitHubRepo(".")).toBe(false);
    expect(isValidGitHubRepo("..")).toBe(false);
    expect(isValidGitHubRepo("")).toBe(false);
    expect(isValidGitHubRepo(undefined)).toBe(false);
    expect(isValidGitHubRepo("has/slash")).toBe(false);
  });
});
