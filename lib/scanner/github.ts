import type { ProjectActivity } from "@/lib/types";
import {
  detectSourceUsageInFiles,
  getPackageJsonDetails,
  MAX_SOURCE_FILE_SIZE,
  MAX_SOURCE_FILES,
  shouldScanSourcePath,
  type PackageJsonDetails,
  type SourceFile,
} from "@/lib/scanner/core";

export interface GitHubRepoSummary {
  name: string;
  url: string;
  description: string | null;
  owner: string;
  pushed_at?: string;
  defaultBranch?: string;
}

interface GitTreeItem {
  path?: string;
  type?: string;
  size?: number;
}

function gitHubApiUrl(
  segments: string[],
  params?: Record<string, string>
) {
  const url = new URL(`https://api.github.com/${segments.map(encodeURIComponent).join("/")}`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function githubHeaders(token: string | undefined, accept: string) {
  const headers: Record<string, string> = { Accept: accept };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function shouldScanSourceFile(item: GitTreeItem) {
  if (!item.path || item.type !== "blob") return false;
  if ((item.size || 0) > MAX_SOURCE_FILE_SIZE) return false;

  return shouldScanSourcePath(item.path);
}

export async function fetchRepoFilePaths(
  owner: string,
  repo: string,
  branch?: string,
  token?: string
): Promise<string[]> {
  try {
    const treeResponse = await fetch(
      gitHubApiUrl(["repos", owner, repo, "git", "trees", branch || "HEAD"], { recursive: "1" }),
      { headers: githubHeaders(token, "application/vnd.github.v3+json") }
    );

    if (!treeResponse.ok) return [];

    const treeData = await treeResponse.json();
    return (treeData.tree || [])
      .filter((item: GitTreeItem) => item.path && item.type === "blob")
      .map((item: GitTreeItem) => item.path as string);
  } catch {
    return [];
  }
}

export async function fetchSourceFiles(
  owner: string,
  repo: string,
  branch?: string,
  token?: string
): Promise<SourceFile[]> {
  try {
    const treeResponse = await fetch(
      gitHubApiUrl(["repos", owner, repo, "git", "trees", branch || "HEAD"], { recursive: "1" }),
      { headers: githubHeaders(token, "application/vnd.github.v3+json") }
    );

    if (!treeResponse.ok) return [];

    const treeData = await treeResponse.json();
    const files = (treeData.tree || [])
      .filter(shouldScanSourceFile)
      .slice(0, MAX_SOURCE_FILES) as GitTreeItem[];

    const sourceFiles: SourceFile[] = [];

    for (const file of files) {
      if (!file.path) continue;

      const contentResponse = await fetch(
        gitHubApiUrl(["repos", owner, repo, "contents", ...file.path.split("/")], { ref: branch || "HEAD" }),
        { headers: githubHeaders(token, "application/vnd.github.v3.raw") }
      );

      if (!contentResponse.ok) continue;

      sourceFiles.push({
        path: file.path,
        content: await contentResponse.text(),
      });
    }

    return sourceFiles;
  } catch {
    return [];
  }
}

export async function fetchSourceUsage(
  owner: string,
  repo: string,
  packageNames: string[],
  branch?: string,
  token?: string
) {
  const sourceFiles = await fetchSourceFiles(owner, repo, branch, token);
  return detectSourceUsageInFiles(sourceFiles, packageNames);
}

export async function fetchPackageJson(
  owner: string,
  repo: string,
  token?: string
): Promise<PackageJsonDetails | null> {
  try {
    const response = await fetch(
      gitHubApiUrl(["repos", owner, repo, "contents", "package.json"]),
      { headers: githubHeaders(token, "application/vnd.github.v3.raw") }
    );

    if (!response.ok) return null;

    const packageJson = await response.json();
    return getPackageJsonDetails(packageJson);
  } catch {
    return null;
  }
}

export async function fetchRepoActivity(
  owner: string,
  repo: string,
  token?: string
): Promise<ProjectActivity | undefined> {
  try {
    const headers = githubHeaders(token, "application/vnd.github.v3+json");
    const commitsResponse = await fetch(
      gitHubApiUrl(["repos", owner, repo, "commits"], { per_page: "1" }),
      { headers }
    );

    let lastCommitAt: string | undefined;
    if (commitsResponse.ok) {
      const commits = await commitsResponse.json();
      if (commits.length > 0) {
        lastCommitAt = commits[0].commit.committer.date;
      }
    }

    const repoResponse = await fetch(
      gitHubApiUrl(["repos", owner, repo]),
      { headers }
    );

    let openIssues: number | undefined;
    let defaultBranch: string | undefined;
    if (repoResponse.ok) {
      const repoData = await repoResponse.json();
      openIssues = repoData.open_issues_count;
      defaultBranch = repoData.default_branch;
    }

    return {
      projectId: `${owner}/${repo}`,
      lastCommitAt,
      defaultBranch,
      openIssues,
    };
  } catch {
    return undefined;
  }
}

export async function fetchUserRepos(
  username: string,
  token?: string
): Promise<GitHubRepoSummary[]> {
  const response = await fetch(
    gitHubApiUrl(["users", username, "repos"], { per_page: "30", sort: "updated" }),
    { headers: githubHeaders(token, "application/vnd.github.v3+json") }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Sign in with GitHub or try again later.");
    }
    throw new Error(`Failed to fetch repos: ${response.statusText}`);
  }

  const repos = await response.json();
  return repos.map(
    (repo: { name: string; html_url: string; description: string | null; owner: { login: string }; pushed_at?: string; default_branch?: string }) => ({
      name: repo.name,
      url: repo.html_url,
      description: repo.description,
      owner: repo.owner.login,
      pushed_at: repo.pushed_at,
      defaultBranch: repo.default_branch,
    })
  );
}

export async function fetchRepoInfo(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRepoSummary | null> {
  const response = await fetch(
    gitHubApiUrl(["repos", owner, repo]),
    { headers: githubHeaders(token, "application/vnd.github.v3+json") }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    if (response.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Try again later.");
    }
    throw new Error(`Failed to fetch repo: ${response.statusText}`);
  }

  const repoData = await response.json();
  return {
    name: repoData.name,
    url: repoData.html_url,
    description: repoData.description,
    owner: repoData.owner.login,
    pushed_at: repoData.pushed_at,
    defaultBranch: repoData.default_branch,
  };
}
