import {
  getTechLayer,
  techCategories,
  type Project,
  type Account,
  type ProjectTag,
  type TechCategory,
  type TechInstance,
  type Environment,
} from "@/lib/types";
import { z } from "zod";

export interface ImportedStack {
  projects: Project[];
  accounts: Account[];
  tags: ProjectTag[];
}

const MAX_ACCOUNTS = 200;
const MAX_TAGS = 200;
const MAX_PROJECTS = 500;
const MAX_TECH_INSTANCES = 5000;
const MAX_NOTES_LENGTH = 10000;
export const MAX_STACK_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

const requiredString = (max: number) => z.string().min(1).max(max);
const optionalString = (max: number) => z.preprocess(
  (value) => (typeof value === "string" && value.length <= max ? value : undefined),
  z.string().max(max).optional(),
);
const optionalNullableString = (max: number) => z.preprocess(
  (value) => {
    if (value === null) return null;
    return typeof value === "string" && value.length <= max ? value : undefined;
  },
  z.string().max(max).nullable().optional(),
);
// Drops any imported URL that is not an absolute http(s) URL, so a shared map
// file can't smuggle a javascript:/data: URI into a rendered link.
const optionalHttpUrl = (max: number) => z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.length === 0 || value.length > max) return undefined;
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:" ? value : undefined;
    } catch {
      return undefined;
    }
  },
  z.string().max(max).optional(),
);
const stringArray = (maxItems: number) => z.preprocess(
  (value) => (
    Array.isArray(value)
      ? value.filter((item) => typeof item === "string" && item.length <= 255).slice(0, maxItems)
      : []
  ),
  z.array(z.string().max(255)).max(maxItems),
);
const unknownArray = (maxItems: number) => z.preprocess(
  (value) => (Array.isArray(value) ? value.slice(0, maxItems) : []),
  z.array(z.unknown()).max(maxItems),
);

const techCategorySchema = z.string().refine(
  (value): value is TechCategory => techCategories.includes(value as TechCategory),
);
const techLayerSchema = z.enum(["service", "library"]);
const environmentSchema = z.enum(["dev", "staging", "prod", "unknown"]);

function optionalParsed<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }, schema.optional());
}

const importedTechInstanceSchema = z.object({
  technologyName: requiredString(255),
  category: techCategorySchema,
  layer: optionalParsed(techLayerSchema),
  version: optionalString(100),
  environment: optionalParsed(environmentSchema),
  accountId: optionalString(255),
  notes: optionalString(MAX_NOTES_LENGTH),
}).passthrough();

const importedProjectSchema = z.object({
  id: requiredString(500),
  displayName: requiredString(255),
  githubOwner: optionalString(255),
  githubRepo: optionalString(255),
  url: optionalHttpUrl(2048),
  description: optionalNullableString(1000),
  tags: stringArray(MAX_TAGS),
  notes: optionalString(MAX_NOTES_LENGTH),
  techInstances: unknownArray(MAX_TECH_INSTANCES),
}).passthrough();

const importedAccountSchema = z.object({
  id: requiredString(255),
  provider: requiredString(100),
  name: optionalString(255),
  label: optionalString(255),
  url: optionalHttpUrl(2048),
}).passthrough();

const importedTagSchema = z.object({
  id: requiredString(255),
  name: requiredString(255),
  color: optionalString(50),
}).passthrough();

const importedStackSchema = z.object({
  projects: unknownArray(MAX_PROJECTS),
  accounts: unknownArray(MAX_ACCOUNTS),
  tags: unknownArray(MAX_TAGS),
}).passthrough();

function validEnvironment(value: unknown): Environment | undefined {
  const parsed = environmentSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function techId(projectId: string, category: string, name: string) {
  return `${projectId}-${category}-${name}`;
}

function formatBytes(bytes: number) {
  return `${Math.floor(bytes / (1024 * 1024))} MB`;
}

/**
 * Reconstruct full store objects from a cartograf JSON export (see handleExport).
 * The export is intentionally lossy for readability; this regenerates the
 * canonical ids (matching a fresh scan) so an imported project merges cleanly
 * with a later re-scan. Throws if the payload isn't a recognisable export.
 */
export function reconstructStackImport(raw: unknown): ImportedStack {
  const parsedExport = importedStackSchema.safeParse(raw);
  if (!parsedExport.success) {
    throw new Error("This doesn't look like a cartograf export.");
  }
  const data = parsedExport.data;

  const projects: Project[] = [];
  for (const p of data.projects) {
    const parsedProject = importedProjectSchema.safeParse(p);
    if (!parsedProject.success) continue;
    const proj = parsedProject.data;

    const techInstances: TechInstance[] = [];
    for (const t of proj.techInstances) {
      const parsedTech = importedTechInstanceSchema.safeParse(t);
      if (!parsedTech.success) continue;
      const ti = parsedTech.data;
      techInstances.push({
        id: techId(proj.id, ti.category, ti.technologyName),
        projectId: proj.id,
        technologyId: ti.technologyName.toLowerCase().replace(/\s+/g, "-"),
        technologyName: ti.technologyName,
        category: ti.category,
        layer: ti.layer ?? getTechLayer(ti.technologyName, ti.category),
        version: ti.version,
        environment: validEnvironment(ti.environment),
        accountId: ti.accountId,
        notes: ti.notes,
        source: "detected",
      });
    }

    projects.push({
      id: proj.id,
      githubOwner: proj.githubOwner ?? "local",
      githubRepo: proj.githubRepo ?? proj.displayName,
      url: proj.url ?? "",
      displayName: proj.displayName,
      description: proj.description ?? null,
      tags: proj.tags,
      notes: proj.notes,
      lastAnalyzedAt: new Date().toISOString(),
      techInstances,
    });
  }

  if (projects.length === 0) {
    throw new Error("No projects found in this file.");
  }

  const accounts: Account[] = [];
  for (const account of data.accounts) {
    const parsed = importedAccountSchema.safeParse(account);
    if (!parsed.success) continue;
    accounts.push({
      id: parsed.data.id,
      provider: parsed.data.provider,
      name: parsed.data.name ?? "",
      label: parsed.data.label,
      url: parsed.data.url,
    });
  }

  const tags: ProjectTag[] = [];
  for (const tag of data.tags) {
    const parsed = importedTagSchema.safeParse(tag);
    if (!parsed.success) continue;
    tags.push({
      id: parsed.data.id,
      name: parsed.data.name,
      color: parsed.data.color ?? "#6b7280",
    });
  }

  return { projects, accounts, tags };
}

/** Read a File (from an <input type=file>) and reconstruct the stack. */
export async function readStackFile(file: File): Promise<ImportedStack> {
  if (file.size > MAX_STACK_IMPORT_FILE_SIZE) {
    throw new Error(`Import file is too large. Select a cartograf JSON export under ${formatBytes(MAX_STACK_IMPORT_FILE_SIZE)}.`);
  }

  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  return reconstructStackImport(parsed);
}
