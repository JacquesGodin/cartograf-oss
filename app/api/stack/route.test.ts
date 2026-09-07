import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeLocalPackageFile,
  scanDirectoryHandle,
} from "@/lib/local-project-scanner";
import type { Project } from "@/lib/types";

type FakeFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

type FakeDirectoryHandle = {
  kind: "directory";
  name: string;
  entries: () => AsyncIterableIterator<[string, FakeFileHandle | FakeDirectoryHandle]>;
};
type LocalDirectoryHandle = Parameters<typeof scanDirectoryHandle>[0];

async function loadStackRoute() {
  vi.resetModules();
  return import("@/app/api/stack/route");
}

function successfulGitHubFetch() {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/contents/package.json")) {
      return jsonResponse({
        dependencies: { next: "16.2.6" },
        devDependencies: {},
        scripts: {},
        name: "repo",
        description: null,
      });
    }

    if (url.includes("/git/trees/")) {
      return jsonResponse({ tree: [] });
    }

    if (url.includes("/commits")) {
      return jsonResponse([]);
    }

    if (url.includes("/repos/owner/repo")) {
      return jsonResponse({
        name: "repo",
        html_url: "https://github.com/owner/repo",
        description: null,
        owner: { login: "owner" },
        default_branch: "main",
        open_issues_count: 0,
      });
    }

    return jsonResponse({ message: "not found" }, 404);
  });
}

function fullScanGitHubFetch(packageJson: unknown, source: string) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/contents/package.json")) {
      return jsonResponse(packageJson);
    }

    if (url.includes("/contents/src/app.ts")) {
      return new Response(source, { status: 200 });
    }

    if (url.includes("/git/trees/")) {
      return jsonResponse({
        tree: [
          { path: "package.json", type: "blob", size: 500 },
          { path: "vercel.json", type: "blob", size: 2 },
          { path: "src/app.ts", type: "blob", size: source.length },
          { path: "secrets.ts", type: "blob", size: 100 },
        ],
      });
    }

    if (url.includes("/commits")) {
      return jsonResponse([]);
    }

    if (url.includes("/repos/owner/repo")) {
      return jsonResponse({
        name: "repo",
        html_url: "https://github.com/owner/repo",
        description: null,
        owner: { login: "owner" },
        default_branch: "main",
        open_issues_count: 0,
      });
    }

    return jsonResponse({ message: "not found" }, 404);
  });
}

function packageFile(content: unknown) {
  return file("package.json", JSON.stringify(content));
}

function file(name: string, content: string): FakeFileHandle {
  return {
    kind: "file",
    name,
    getFile: async () => new File([content], name, { type: "text/plain" }),
  };
}

function dir(name: string, children: Array<FakeFileHandle | FakeDirectoryHandle>): FakeDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *entries() {
      for (const child of children) {
        yield [child.name, child];
      }
    },
  };
}

function scannerDir(name: string, children: Array<FakeFileHandle | FakeDirectoryHandle>) {
  return dir(name, children) as unknown as LocalDirectoryHandle;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function technologySignature(project: Project) {
  return project.techInstances
    .map((tech) => {
      const usage = tech.usage;
      const evidence = usage?.evidence
        .map((item) => `${item.type}:${item.file}:${item.line ?? ""}:${item.detail}`)
        .sort()
        .join("|") ?? "";
      return [
        tech.category,
        tech.technologyName,
        tech.layer,
        usage?.installed ? "installed" : "",
        usage?.imported ? "imported" : "",
        usage?.used ? "used" : "",
        evidence,
      ].join(":");
    })
    .sort();
}

describe("/api/stack", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects username path traversal before GitHub fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadStackRoute();

    const response = await GET(new Request(
      "https://cartograf.test/api/stack?username=..%2Fuser",
    ));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-GitHub repository URLs before GitHub fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadStackRoute();

    const response = await GET(new Request(
      "https://cartograf.test/api/stack?repo=https://evil.test/owner/repo",
    ));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies the OSS throttle before GitHub fetches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadStackRoute();
    const headers = { "x-forwarded-for": "203.0.113.10" };
    let response = new Response();

    for (let index = 0; index < 30; index += 1) {
      response = await GET(new Request(
        "https://cartograf.test/api/stack?username=bad_user",
        { headers },
      ));
      expect(response.status).toBe(400);
    }

    response = await GET(new Request(
      "https://cartograf.test/api/stack?username=bad_user",
      { headers },
    ));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores forged forwarded headers unless proxy trust is enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadStackRoute();
    let response = new Response();

    for (let index = 0; index < 30; index += 1) {
      response = await GET(new Request(
        "https://cartograf.test/api/stack?username=bad_user",
        { headers: { "x-forwarded-for": `203.0.113.${index}` } },
      ));
      expect(response.status).toBe(400);
    }

    response = await GET(new Request(
      "https://cartograf.test/api/stack?username=bad_user",
      { headers: { "x-forwarded-for": "203.0.113.200" } },
    ));

    expect(response.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses forwarded headers only when trusted proxy mode is enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubEnv("CARTOGRAF_TRUST_PROXY_HEADERS", "true");
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadStackRoute();
    const firstClientHeaders = { "x-forwarded-for": "203.0.113.10" };
    let response = new Response();

    for (let index = 0; index < 30; index += 1) {
      response = await GET(new Request(
        "https://cartograf.test/api/stack?username=bad_user",
        { headers: firstClientHeaders },
      ));
      expect(response.status).toBe(400);
    }

    response = await GET(new Request(
      "https://cartograf.test/api/stack?username=bad_user",
      { headers: firstClientHeaders },
    ));
    expect(response.status).toBe(429);

    response = await GET(new Request(
      "https://cartograf.test/api/stack?username=bad_user",
      { headers: { "x-forwarded-for": "203.0.113.11" } },
    ));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not use a server GitHub token for public repo scans", async () => {
    const fetchMock = successfulGitHubFetch();
    vi.stubEnv("GITHUB_TOKEN", "server-token");
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadStackRoute();

    const response = await GET(new Request(
      "https://cartograf.test/api/stack?repo=github.com/owner/repo",
    ));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    for (const call of fetchMock.mock.calls) {
      const headers = call[1]?.headers as Record<string, string> | undefined;
      expect(headers?.Authorization).toBeUndefined();
    }
  });

  it("keeps package-only server and local scan results consistent", async () => {
    vi.stubGlobal("window", { setTimeout });
    const packageJson = {
      name: "consistent",
      dependencies: {
        next: "16.0.0",
        "@radix-ui/react-dialog": "1.0.0",
      },
      devDependencies: {
        vitest: "4.0.0",
      },
      scripts: {
        deploy: "vercel --prod",
      },
    };
    const { POST } = await loadStackRoute();

    const localProjects = await analyzeLocalPackageFile(new File([
      JSON.stringify(packageJson),
    ], "package.json"));
    const response = await POST(new Request("https://cartograf.test/api/stack", {
      method: "POST",
      body: JSON.stringify({ packageJson }),
    }));
    const serverProjects = await response.json() as Project[];

    expect(response.status).toBe(200);
    expect(technologySignature(serverProjects[0])).toEqual(
      technologySignature(localProjects[0]),
    );
  });

  it("keeps GitHub and local scan results consistent for source and deployment evidence", async () => {
    vi.stubGlobal("window", { setTimeout });
    const packageJson = {
      name: "consistent",
      dependencies: {
        next: "16.0.0",
        "@radix-ui/react-dialog": "1.0.0",
      },
      scripts: {
        deploy: "vercel --prod",
      },
    };
    const source = `
      import Link from "next/link";
      Link;
      await import("@radix-ui/react-dialog");
      import "@radix-ui/react-dialog";
    `;
    const fetchMock = fullScanGitHubFetch(packageJson, source);
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadStackRoute();

    const localProjects = await scanDirectoryHandle(scannerDir("consistent", [
      packageFile(packageJson),
      file("vercel.json", "{}"),
      file("secrets.ts", `
        import Link from "next/link";
        Link;
      `),
      dir("src", [
        file("app.ts", source),
      ]),
    ]));
    const response = await GET(new Request(
      "https://cartograf.test/api/stack?repo=github.com/owner/repo",
    ));
    const serverProjects = await response.json() as Project[];

    expect(response.status).toBe(200);
    expect(technologySignature(serverProjects[0])).toEqual(
      technologySignature(localProjects[0]),
    );
    expect(fetchMock.mock.calls.some(([input]) =>
      String(input).includes("/contents/secrets.ts")
    )).toBe(false);
  });
});
