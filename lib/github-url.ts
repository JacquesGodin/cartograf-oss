// Pure GitHub owner/repo validation + URL parsing, extracted from the scan API
// so it can be unit-tested. Security-sensitive: this is the gate that decides
// which repositories the server will fetch.

export const GITHUB_OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export const GITHUB_REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function isValidGitHubOwner(value: string | undefined): value is string {
  return !!value && GITHUB_OWNER_RE.test(value);
}

export function isValidGitHubRepo(value: string | undefined): value is string {
  return !!value && value !== "." && value !== ".." && GITHUB_REPO_RE.test(value);
}

/**
 * Parse a repo reference into { owner, repo }, or null if invalid.
 * Accepts `owner/repo`, `github.com/owner/repo`, and full `https://github.com/owner/repo`
 * URLs (only github.com / www.github.com hosts). Strips a trailing `.git` and any
 * query/hash. Rejects other hosts and malformed owner/repo names.
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  let path = url.trim();

  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
        return null;
      }
      path = parsed.pathname;
    } catch {
      return null;
    }
  } else {
    path = path.replace(/^github\.com\//i, "");
    path = path.split(/[?#]/)[0];
  }

  const [owner, rawRepo] = path.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");

  if (!isValidGitHubOwner(owner) || !isValidGitHubRepo(repo)) {
    return null;
  }

  return { owner, repo };
}
