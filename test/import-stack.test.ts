import { describe, it, expect } from "vitest";
import {
  MAX_STACK_IMPORT_FILE_SIZE,
  readStackFile,
  reconstructStackImport,
} from "@/lib/import-stack";

const validExport = {
  exportedAt: "2026-07-21T00:00:00.000Z",
  generatedBy: "cartograf",
  accounts: [
    { id: "acc-stripe", provider: "Stripe", name: "Personal", label: "Personal", url: "https://dashboard.stripe.com" },
  ],
  tags: [{ id: "production", name: "Production", color: "#f59e0b" }],
  projects: [
    {
      id: "liveco/app",
      displayName: "liveco-app",
      url: "https://github.com/liveco/app",
      githubOwner: "liveco",
      githubRepo: "app",
      tags: ["production"],
      notes: "main app",
      techInstances: [
        { technologyName: "Stripe", category: "payments", layer: "service", version: "17.0.0", environment: "prod", accountId: "acc-stripe", notes: "billing" },
        { technologyName: "React", category: "frontend", layer: "library", version: "19.0.0" },
      ],
    },
  ],
};

describe("reconstructStackImport", () => {
  it("reconstructs projects, accounts, and tags", () => {
    const { projects, accounts, tags } = reconstructStackImport(validExport);
    expect(projects).toHaveLength(1);
    expect(accounts).toHaveLength(1);
    expect(tags).toHaveLength(1);
    expect(projects[0].displayName).toBe("liveco-app");
    expect(projects[0].techInstances).toHaveLength(2);
  });

  it("regenerates canonical tech instance ids matching a fresh scan", () => {
    const { projects } = reconstructStackImport(validExport);
    const stripe = projects[0].techInstances.find((t) => t.technologyName === "Stripe")!;
    expect(stripe.id).toBe("liveco/app-payments-Stripe");
    expect(stripe.projectId).toBe("liveco/app");
    expect(stripe.technologyId).toBe("stripe");
    expect(stripe.source).toBe("detected");
    expect(stripe.accountId).toBe("acc-stripe");
    expect(stripe.environment).toBe("prod");
  });

  it("infers layer when the export omits it", () => {
    const raw = {
      projects: [{ id: "a/b", displayName: "b", techInstances: [{ technologyName: "Neon", category: "database" }] }],
    };
    const { projects } = reconstructStackImport(raw);
    expect(projects[0].techInstances[0].layer).toBe("service");
  });

  it("skips malformed tech instances but keeps the project", () => {
    const raw = {
      projects: [{
        id: "a/b", displayName: "b",
        techInstances: [{ technologyName: "React", category: "frontend" }, { category: "frontend" }, null, "nope"],
      }],
    };
    const { projects } = reconstructStackImport(raw);
    expect(projects[0].techInstances).toHaveLength(1);
  });

  it("drops unsupported category and environment values from edited imports", () => {
    const raw = {
      projects: [{
        id: "a/b",
        displayName: "b",
        techInstances: [
          { technologyName: "React", category: "not-real", layer: "library" },
          { technologyName: "Stripe", category: "payments", layer: "wat", environment: "qa" },
        ],
      }],
    };

    const { projects } = reconstructStackImport(raw);
    expect(projects[0].techInstances).toHaveLength(1);
    expect(projects[0].techInstances[0].technologyName).toBe("Stripe");
    expect(projects[0].techInstances[0].layer).toBe("service");
    expect(projects[0].techInstances[0].environment).toBeUndefined();
  });

  it("drops malformed accounts and tags without coercing values", () => {
    const raw = {
      projects: [{ id: "a/b", displayName: "b", techInstances: [] }],
      accounts: [
        { id: { value: "acc-bad" }, provider: "Stripe", name: "Bad" },
        { id: "acc-ok", provider: "Stripe", name: "Live" },
      ],
      tags: [
        { id: "tag-ok", name: "Production", color: "#f59e0b" },
        { id: ["tag-bad"], name: "Bad" },
      ],
    };

    const { accounts, tags } = reconstructStackImport(raw);
    expect(accounts).toEqual([{ id: "acc-ok", provider: "Stripe", name: "Live", label: undefined, url: undefined }]);
    expect(tags).toEqual([{ id: "tag-ok", name: "Production", color: "#f59e0b" }]);
  });

  it("keeps projects when optional notes exceed import bounds", () => {
    const oversizedNote = "x".repeat(10001);
    const raw = {
      projects: [{
        id: "a/b",
        displayName: "b",
        notes: oversizedNote,
        techInstances: [
          { technologyName: "React", category: "frontend", notes: oversizedNote },
        ],
      }],
    };

    const { projects } = reconstructStackImport(raw);
    expect(projects).toHaveLength(1);
    expect(projects[0].notes).toBeUndefined();
    expect(projects[0].techInstances).toHaveLength(1);
    expect(projects[0].techInstances[0].technologyName).toBe("React");
    expect(projects[0].techInstances[0].notes).toBeUndefined();
  });

  it("rejects oversized stack files before parsing", async () => {
    const oversizedFile = new File(
      [new Uint8Array(MAX_STACK_IMPORT_FILE_SIZE + 1)],
      "cartograf-export.json",
      { type: "application/json" },
    );

    await expect(readStackFile(oversizedFile)).rejects.toThrow("Import file is too large");
  });

  it("throws when the payload is not an export", () => {
    expect(() => reconstructStackImport(null)).toThrow();
    expect(() => reconstructStackImport({})).toThrow();
    expect(() => reconstructStackImport({ projects: "nope" })).toThrow();
  });

  it("throws when there are no usable projects", () => {
    expect(() => reconstructStackImport({ projects: [{ noId: true }] })).toThrow();
  });

  it("strips non-http(s) URLs from imported projects and accounts", () => {
    const result = reconstructStackImport({
      accounts: [
        { id: "acc-evil", provider: "Stripe", name: "Evil", url: "javascript:alert(document.cookie)" },
        { id: "acc-ok", provider: "Stripe", name: "Ok", url: "https://dashboard.stripe.com" },
      ],
      projects: [
        { id: "o/evil", displayName: "evil", url: "javascript:fetch('//evil')", techInstances: [] },
        { id: "o/ok", displayName: "ok", url: "https://github.com/o/ok", techInstances: [] },
      ],
    });

    expect(result.projects.find((project) => project.id === "o/evil")?.url).toBe("");
    expect(result.projects.find((project) => project.id === "o/ok")?.url).toBe("https://github.com/o/ok");
    expect(result.accounts.find((account) => account.id === "acc-evil")?.url).toBeUndefined();
    expect(result.accounts.find((account) => account.id === "acc-ok")?.url).toBe("https://dashboard.stripe.com");
  });
});
