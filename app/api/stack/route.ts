import { NextResponse } from "next/server";
import type { Project } from "@/lib/types";
import { parseRepoUrl, isValidGitHubOwner } from "@/lib/github-url";
import {
  buildStack,
  getDetectedPackageNames,
  getPackageJsonDetails,
  hasRecognizedStack,
  stackToProject,
} from "@/lib/scanner/core";
import {
  fetchPackageJson,
  fetchRepoActivity,
  fetchRepoFilePaths,
  fetchRepoInfo,
  fetchSourceUsage,
  fetchUserRepos,
} from "@/lib/scanner/github";

// Best-effort OSS throttle for public self-hosts. This is per-process and does
// not replace edge/proxy rate limiting, but keeps the open route from being
// unlimited by default.
const OSS_STACK_RATE_LIMIT = 30;
const OSS_STACK_RATE_WINDOW_SECONDS = 60 * 60;
const OSS_RATE_LIMIT_MAX_BUCKETS = 10_000;
const OSS_RATE_LIMIT_OVERFLOW_BUCKET = "oss:overflow";

// Max bytes we'll accept on POST. A massive package.json is ~50KB; this is
// 4x that to allow edge cases without permitting abuse.
const MAX_POST_BODY_BYTES = 200 * 1024;

interface InMemoryRateLimitEntry {
  count: number;
  resetAt: number;
}

const ossRateLimitBuckets = new Map<string, InMemoryRateLimitEntry>();

/**
 * Map server-side errors (mostly from GitHub fetches) to safe client messages.
 * The full error is logged server-side; the client gets a generic family.
 */
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    // Surface a few specific, user-actionable cases. Everything else is opaque.
    if (msg.includes("rate limit")) return "GitHub API rate limit exceeded. Try again later.";
    if (msg.includes("Not Found") || msg.includes("404")) return "Repository not found.";
  }
  return "Failed to fetch repository data.";
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    },
  );
}

function pruneExpiredOssBuckets(now: number) {
  for (const [key, value] of ossRateLimitBuckets) {
    if (value.resetAt <= now) {
      ossRateLimitBuckets.delete(key);
    }
  }
}

function shouldTrustProxyHeaders() {
  return process.env.CARTOGRAF_TRUST_PROXY_HEADERS === "true";
}

function ossClientKey(request: Request) {
  if (shouldTrustProxyHeaders()) {
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwardedFor || request.headers.get("x-real-ip")?.trim() || "local";
  }

  return "local";
}

function checkOssRateLimit(key: string) {
  const now = Date.now();
  const windowMs = OSS_STACK_RATE_WINDOW_SECONDS * 1000;
  let bucketKey = key;
  let entry = ossRateLimitBuckets.get(bucketKey);

  if (!entry || entry.resetAt <= now) {
    if (entry) {
      ossRateLimitBuckets.delete(bucketKey);
    } else if (ossRateLimitBuckets.size >= OSS_RATE_LIMIT_MAX_BUCKETS) {
      pruneExpiredOssBuckets(now);
      if (ossRateLimitBuckets.size >= OSS_RATE_LIMIT_MAX_BUCKETS) {
        bucketKey = OSS_RATE_LIMIT_OVERFLOW_BUCKET;
      }
    }

    entry = ossRateLimitBuckets.get(bucketKey);
    if (!entry || entry.resetAt <= now) {
      if (!ossRateLimitBuckets.has(bucketKey) && ossRateLimitBuckets.size >= OSS_RATE_LIMIT_MAX_BUCKETS) {
        const oldestKey = ossRateLimitBuckets.keys().next().value;
        if (typeof oldestKey === "string") {
          ossRateLimitBuckets.delete(oldestKey);
        }
      }
      entry = { count: 0, resetAt: now + windowMs };
      ossRateLimitBuckets.set(bucketKey, entry);
    }
  }

  entry.count += 1;
  return {
    allowed: entry.count <= OSS_STACK_RATE_LIMIT,
    retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * OSS rate-limit gate. Returns a NextResponse to short-circuit, or null to allow.
 */
async function gate(request: Request, bucket: string): Promise<NextResponse | null> {
  const result = checkOssRateLimit(`oss:${bucket}:${ossClientKey(request)}`);
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds);
}

async function getGitHubToken(): Promise<string | undefined> {
  return undefined;
}

export async function GET(request: Request) {
  const blocked = await gate(request, "stack_get");
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const repoUrl = searchParams.get("repo");
  const token = await getGitHubToken();

  // Mode 1: Fetch by username (all repos)
  if (username) {
    if (!isValidGitHubOwner(username)) {
      return NextResponse.json(
        { error: "Invalid GitHub username." },
        { status: 400 }
      );
    }

    try {
      const repos = await fetchUserRepos(username, token);
      const projects: Project[] = [];

      for (const repo of repos) {
        const packageJson = await fetchPackageJson(repo.owner, repo.name, token);

        if (packageJson) {
          const repoFilePaths = await fetchRepoFilePaths(
            repo.owner,
            repo.name,
            repo.defaultBranch,
            token
          );
          const installedStack = buildStack(packageJson, repoFilePaths);

          if (hasRecognizedStack(installedStack)) {
            const activity = await fetchRepoActivity(repo.owner, repo.name, token);
            const sourceUsageByPackage = await fetchSourceUsage(
              repo.owner,
              repo.name,
              getDetectedPackageNames(installedStack),
              repo.defaultBranch || activity?.defaultBranch,
              token
            );
            const stack = buildStack(packageJson, repoFilePaths, sourceUsageByPackage);
            projects.push(stackToProject({
              projectId: `${repo.owner}/${repo.name}`,
              githubOwner: repo.owner,
              githubRepo: repo.name,
              url: repo.url,
              displayName: repo.name,
              description: repo.description,
              stack,
              activity,
            }));
          }
        }
      }

      return NextResponse.json(projects);
    } catch (error) {
      console.error("stack_fetch_failed", {
        error: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json(
        { error: safeErrorMessage(error) },
        { status: 500 }
      );
    }
  }

  // Mode 2: Fetch single repo by URL
  if (repoUrl) {
    const parsed = parseRepoUrl(repoUrl);
    
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid repository URL. Use format: github.com/owner/repo" },
        { status: 400 }
      );
    }

    try {
      const repoInfo = await fetchRepoInfo(parsed.owner, parsed.repo, token);
      
      if (!repoInfo) {
        return NextResponse.json(
          { error: "Repository not found. Make sure it exists and is public." },
          { status: 404 }
        );
      }

      const packageJson = await fetchPackageJson(parsed.owner, parsed.repo, token);

      if (!packageJson) {
        return NextResponse.json(
          { error: "No package.json found in this repository." },
          { status: 404 }
        );
      }

      const repoFilePaths = await fetchRepoFilePaths(
        parsed.owner,
        parsed.repo,
        repoInfo.defaultBranch,
        token
      );
      const installedStack = buildStack(packageJson, repoFilePaths);

      if (!hasRecognizedStack(installedStack)) {
        return NextResponse.json(
          { error: "No recognized tech stack found in package.json." },
          { status: 404 }
        );
      }

      const activity = await fetchRepoActivity(parsed.owner, parsed.repo, token);
      const sourceUsageByPackage = await fetchSourceUsage(
        parsed.owner,
        parsed.repo,
        getDetectedPackageNames(installedStack),
        repoInfo.defaultBranch || activity?.defaultBranch,
        token
      );
      const stack = buildStack(packageJson, repoFilePaths, sourceUsageByPackage);

      return NextResponse.json([stackToProject({
        projectId: `${repoInfo.owner}/${repoInfo.name}`,
        githubOwner: repoInfo.owner,
        githubRepo: repoInfo.name,
        url: repoInfo.url,
        displayName: repoInfo.name,
        description: repoInfo.description,
        stack,
        activity,
      })]);
    } catch (error) {
      console.error("repository_fetch_failed", {
        error: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json(
        { error: safeErrorMessage(error) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Either username or repo URL is required" },
    { status: 400 }
  );
}

// POST handler for package.json-only fallback analysis
export async function POST(request: Request) {
  const blocked = await gate(request, "stack_post");
  if (blocked) return blocked;

  // Enforce body size limit before we try to parse it.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_POST_BODY_BYTES) {
    return NextResponse.json(
      { error: "Payload too large." },
      { status: 413 }
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_POST_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large." },
        { status: 413 }
      );
    }

    let body: { packageJson?: unknown; fileName?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const { packageJson, fileName } = body;

    if (!packageJson) {
      return NextResponse.json(
        { error: "package.json content is required" },
        { status: 400 }
      );
    }

    let parsed;
    try {
      parsed = typeof packageJson === "string" ? JSON.parse(packageJson) : packageJson;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    const packageJsonDetails = getPackageJsonDetails(parsed);
    const stack = buildStack(packageJsonDetails);

    if (!hasRecognizedStack(stack)) {
      return NextResponse.json(
        { error: "No recognized tech stack found in package.json." },
        { status: 404 }
      );
    }

    const fileNameStr = typeof fileName === "string" ? fileName : "";
    const projectName = packageJsonDetails.name || fileNameStr.replace(/\.json$/, "") || "Local Project";
    return NextResponse.json([stackToProject({
      projectId: `local/${projectName}`,
      githubOwner: "local",
      githubRepo: projectName,
      url: "",
      displayName: projectName,
      description: packageJsonDetails.description || null,
      stack,
    })]);
  } catch (error) {
    console.error("package_manifest_processing_failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Failed to process package.json." },
      { status: 500 }
    );
  }
}

