import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeLocalPackageFile,
  MAX_PACKAGE_JSON_FILE_SIZE,
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

function techNames(project: Project) {
  return project.techInstances.map((tech) => tech.technologyName).sort();
}

describe("local project scanner", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setTimeout });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies dependencies, devDependencies, and scoped package matches", async () => {
    const [project] = await analyzeLocalPackageFile(new File([
      JSON.stringify({
        name: "fixture",
        dependencies: {
          next: "16.0.0",
          "@radix-ui/react-dialog": "1.0.0",
        },
        devDependencies: {
          vitest: "4.0.0",
          tailwindcss: "4.0.0",
        },
      }),
    ], "package.json"));

    expect(techNames(project)).toEqual(["Next.js", "Radix UI", "Tailwind", "Vitest"]);
  });

  it("rejects oversized package uploads before parsing", async () => {
    const oversizedFile = new File(
      [new Uint8Array(MAX_PACKAGE_JSON_FILE_SIZE + 1)],
      "package.json",
      { type: "application/json" },
    );

    await expect(analyzeLocalPackageFile(oversizedFile)).rejects.toThrow("package.json is too large");
  });

  it("rejects oversized package.json files found in local folders", async () => {
    await expect(scanDirectoryHandle(scannerDir("oversized", [
      file("package.json", "x".repeat(MAX_PACKAGE_JSON_FILE_SIZE + 1)),
    ]))).rejects.toThrow("package.json is too large");
  });

  it("detects deployment config files and scripts", async () => {
    const [project] = await scanDirectoryHandle(scannerDir("deployable", [
      packageFile({
        name: "deployable",
        scripts: {
          deploy: "vercel --prod",
        },
      }),
      file("vercel.json", "{}"),
    ]));

    const vercel = project.techInstances.find((tech) => tech.technologyName === "Vercel");
    expect(vercel?.category).toBe("deployment");
    expect(vercel?.usage?.used).toBe(true);
    expect(vercel?.usage?.evidence.some((item) => item.file === "vercel.json")).toBe(true);
    expect(vercel?.usage?.evidence.some((item) => item.detail.includes("script \"deploy\""))).toBe(true);
  });

  it("captures static, dynamic, and side-effect import evidence", async () => {
    const [project] = await scanDirectoryHandle(scannerDir("imports", [
      packageFile({
        name: "imports",
        dependencies: {
          next: "16.0.0",
          "@radix-ui/react-dialog": "1.0.0",
        },
      }),
      dir("src", [
        file("app.ts", `
          import Link from "next/link";
          Link;
          await import("@radix-ui/react-dialog");
          import "@radix-ui/react-dialog";
        `),
      ]),
    ]));

    const next = project.techInstances.find((tech) => tech.technologyName === "Next.js");
    const radix = project.techInstances.find((tech) => tech.technologyName === "Radix UI");
    expect(next?.usage?.imported).toBe(true);
    expect(next?.usage?.used).toBe(true);
    expect(radix?.usage?.imported).toBe(true);
    expect(radix?.usage?.used).toBe(true);
  });

  it("excludes sensitive source paths from usage evidence", async () => {
    const [project] = await scanDirectoryHandle(scannerDir("sensitive", [
      packageFile({
        name: "sensitive",
        dependencies: {
          react: "19.0.0",
        },
      }),
      file("secrets.ts", `
        import React from "react";
        React.createElement("div");
      `),
    ]));

    const react = project.techInstances.find((tech) => tech.technologyName === "React");
    expect(react?.usage?.installed).toBe(true);
    expect(react?.usage?.imported).toBe(false);
    expect(react?.usage?.evidence.some((item) => item.file === "secrets.ts")).toBe(false);
  });

  it("chooses the shallowest package.json in a monorepo", async () => {
    const [project] = await scanDirectoryHandle(scannerDir("monorepo", [
      packageFile({
        name: "root",
        dependencies: {
          react: "19.0.0",
        },
      }),
      dir("packages", [
        dir("app", [
          packageFile({
            name: "nested",
            dependencies: {
              next: "16.0.0",
            },
          }),
        ]),
      ]),
    ]));

    expect(project.displayName).toBe("root");
    expect(techNames(project)).toEqual(["React"]);
  });
});
