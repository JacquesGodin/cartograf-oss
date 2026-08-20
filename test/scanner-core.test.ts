import { describe, expect, it } from "vitest";
import {
  buildStack,
  detectPackageUsageInFile,
  detectSourceUsageInFiles,
  getDetectedPackageNames,
  getPackageJsonDetails,
  hasRecognizedStack,
  packagePatternMatches,
  shouldScanSourcePath,
  stackToProject,
} from "@/lib/scanner/core";

function techNames(stack: ReturnType<typeof buildStack>) {
  return Object.values(stack)
    .flat()
    .map((tech) => tech.name)
    .sort();
}

describe("scanner core", () => {
  it("normalizes dependencies, devDependencies, scripts, and metadata", () => {
    const details = getPackageJsonDetails({
      name: "fixture",
      description: "Fixture app",
      dependencies: {
        next: "16.0.0",
        ignored: 42,
      },
      devDependencies: {
        vitest: "4.0.0",
      },
      scripts: {
        deploy: "vercel --prod",
        invalid: false,
      },
    });

    expect(details).toEqual({
      name: "fixture",
      description: "Fixture app",
      dependencies: {
        next: "16.0.0",
        vitest: "4.0.0",
      },
      scripts: {
        deploy: "vercel --prod",
      },
    });
  });

  it("classifies packages with exact and scoped wildcard patterns", () => {
    expect(packagePatternMatches("@radix-ui/*", "@radix-ui/react-dialog")).toBe(true);
    expect(packagePatternMatches("@radix-ui/*", "@radix-ui")).toBe(false);
    expect(packagePatternMatches("next", "next")).toBe(true);

    const stack = buildStack(getPackageJsonDetails({
      dependencies: {
        next: "16.0.0",
        "@radix-ui/react-dialog": "1.0.0",
        "@supabase/supabase-js": "2.0.0",
      },
      devDependencies: {
        vitest: "4.0.0",
      },
    }));

    expect(techNames(stack)).toEqual(["Next.js", "Radix UI", "Supabase", "Vitest"]);
  });

  it("adds deployment evidence from packages, config files, and scripts", () => {
    const stack = buildStack(
      getPackageJsonDetails({
        dependencies: {
          vercel: "39.0.0",
        },
        scripts: {
          deploy: "vercel --prod",
        },
      }),
      ["vercel.json"]
    );

    const vercel = stack.deployment.find((tech) => tech.name === "Vercel");
    expect(vercel?.usage.installed).toBe(true);
    expect(vercel?.usage.used).toBe(true);
    expect(vercel?.usage.evidence.map((item) => item.detail)).toEqual([
      "vercel: 39.0.0",
      "Vercel deployment configuration",
      "script \"deploy\": vercel --prod",
    ]);
  });

  it("detects static, dynamic, side-effect, and require usage evidence", async () => {
    const source = {
      path: "src/app.ts",
      content: `
        import Link from "next/link";
        Link;
        import "@radix-ui/react-dialog";
        const stripe = require("stripe");
        stripe();
        await import("vitest");
      `,
    };

    const nextEvidence = detectPackageUsageInFile(source, "next");
    const radixEvidence = detectPackageUsageInFile(source, "@radix-ui/react-dialog");
    const stripeEvidence = detectPackageUsageInFile(source, "stripe");
    const vitestEvidence = detectPackageUsageInFile(source, "vitest");

    expect(nextEvidence.map((item) => item.type)).toEqual(["imported", "used"]);
    expect(radixEvidence.map((item) => item.detail)).toEqual([
      "import \"@radix-ui/react-dialog\"",
      "side-effect import",
    ]);
    expect(stripeEvidence.map((item) => item.type)).toEqual(["imported", "used"]);
    expect(vitestEvidence.map((item) => item.detail)).toEqual([
      "import(\"vitest\")",
      "dynamic import",
    ]);

    const usageByPackage = await detectSourceUsageInFiles(
      [source],
      ["next", "@radix-ui/react-dialog", "stripe", "vitest"]
    );
    expect([...usageByPackage.keys()].sort()).toEqual([
      "@radix-ui/react-dialog",
      "next",
      "stripe",
      "vitest",
    ]);
  });

  it("does not mark an import as used when the identifier appears only in the import statement", () => {
    const evidence = detectPackageUsageInFile({
      path: "src/app.ts",
      content: `import React from "react";`,
    }, "react");

    expect(evidence.map((item) => item.type)).toEqual(["imported"]);
  });

  it("filters sensitive and ignored source paths consistently", () => {
    expect(shouldScanSourcePath("src/app.ts")).toBe(true);
    expect(shouldScanSourcePath("public/app.ts")).toBe(false);
    expect(shouldScanSourcePath("node_modules/pkg/index.ts")).toBe(false);
    expect(shouldScanSourcePath("secrets.ts")).toBe(false);
    expect(shouldScanSourcePath(".env.ts")).toBe(false);
  });

  it("builds project instances from a scanner stack", () => {
    const stack = buildStack(getPackageJsonDetails({
      dependencies: {
        next: "16.0.0",
      },
    }));
    expect(hasRecognizedStack(stack)).toBe(true);
    expect(getDetectedPackageNames(stack)).toEqual(["next"]);

    const project = stackToProject({
      projectId: "owner/repo",
      githubOwner: "owner",
      githubRepo: "repo",
      url: "https://github.com/owner/repo",
      displayName: "repo",
      description: null,
      stack,
      lastAnalyzedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(project).toMatchObject({
      id: "owner/repo",
      githubOwner: "owner",
      githubRepo: "repo",
      displayName: "repo",
      lastAnalyzedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(project.techInstances[0]).toMatchObject({
      technologyName: "Next.js",
      category: "backend",
      layer: "library",
      usage: {
        installed: true,
      },
    });
  });
});
