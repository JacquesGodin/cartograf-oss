// Core entity types based on PLATFORM.md data model

export type TechCategory =
  | "frontend"
  | "backend"
  | "database"
  | "auth"
  | "storage"
  | "payments"
  | "ai"
  | "email"
  | "analytics"
  | "observability"
  | "cms"
  | "testing"
  | "devops"
  | "deployment"
  | "search"
  | "queue"
  | "cache"
  | "realtime"
  | "validation";

export const techCategories: TechCategory[] = [
  "frontend",
  "backend",
  "database",
  "auth",
  "storage",
  "payments",
  "ai",
  "email",
  "analytics",
  "observability",
  "cms",
  "testing",
  "devops",
  "deployment",
  "search",
  "queue",
  "cache",
  "realtime",
  "validation",
];

export type Environment = "dev" | "staging" | "prod" | "unknown";

export type DetectionSource = "detected" | "manual" | "inferred";

export type ActivityStatus = "active" | "stale" | "dormant";

export type TechUsageLevel = "installed" | "imported" | "used";

export type TechLayer = "service" | "library";

export type TechLayerMode = "services" | "libraries" | "all";

export interface LayerVisibility {
  services: boolean;
  libraries: boolean;
  versions: boolean;
}

export const defaultLayerVisibility: LayerVisibility = {
  services: true,
  libraries: true,
  versions: true,
};

export interface TechUsageEvidence {
  type: TechUsageLevel;
  file: string;
  detail: string;
  line?: number;
}

export interface TechUsage {
  installed: boolean;
  imported: boolean;
  used: boolean;
  evidence: TechUsageEvidence[];
}

export interface Account {
  id: string;
  provider: string;
  name: string;
  label?: string;
  url?: string;
}

export interface Technology {
  id: string;
  name: string;
  category: TechCategory;
  layer: TechLayer;
  icon?: string;
}

export interface TechInstance {
  id: string;
  projectId: string;
  technologyId: string;
  technologyName: string;
  category: TechCategory;
  layer: TechLayer;
  accountId?: string;
  environment?: Environment;
  source: DetectionSource;
  version?: string;
  notes?: string;
  usage?: TechUsage;
}

export interface ProjectTag {
  id: string;
  name: string;
  color: string;
}

export interface ProjectActivity {
  projectId: string;
  lastCommitAt?: string;
  defaultBranch?: string;
  openIssues?: number;
  openPullRequests?: number;
}

export interface Project {
  id: string;
  githubOwner: string;
  githubRepo: string;
  url: string;
  displayName: string;
  description: string | null;
  tags: string[]; // tag IDs
  label?: string; // user-defined display name override
  notes?: string;
  icon?: string; // base64 data URL for locally-scanned projects
  lastAnalyzedAt?: string;
  activity?: ProjectActivity;
  techInstances: TechInstance[];
}

const serviceCategories = new Set<TechCategory>([
  "database",
  "auth",
  "storage",
  "payments",
  "ai",
  "email",
  "analytics",
  "observability",
  "cms",
  "deployment",
  "search",
  "queue",
  "cache",
  "realtime",
]);

const libraryTechnologies = new Set([
  "aisdk",
  "betterauth",
  "bull",
  "bullmq",
  "changesets",
  "classvalidator",
  "docker",
  "drizzle",
  "drizzleorm",
  "joi",
  "langchain",
  "lru",
  "lucia",
  "nextauth",
  "nodemailer",
  "opentelemetry",
  "payload",
  "payloadcms",
  "partykit",
  "prisma",
  "reactemail",
  "socketio",
  "strapi",
  "valibot",
  "yup",
]);

export function getTechLayer(name: string, category: TechCategory): TechLayer {
  if (libraryTechnologies.has(normalizeTechnologyName(name))) {
    return "library";
  }

  return serviceCategories.has(category) ? "service" : "library";
}

export function techMatchesLayer(tech: TechInstance, mode: TechLayerMode) {
  if (mode === "all") return true;

  const layer = tech.layer || getTechLayer(tech.technologyName, tech.category);
  return mode === "services" ? layer === "service" : layer === "library";
}

export function getTechLayerModeLabel(mode: TechLayerMode) {
  switch (mode) {
    case "services":
      return "services";
    case "libraries":
      return "libraries";
    default:
      return "technologies";
  }
}

function normalizeTechnologyName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Computed activity status based on last commit
export function getActivityStatus(lastCommitAt?: string): ActivityStatus {
  if (!lastCommitAt) return "dormant";
  
  const now = new Date();
  const lastCommit = new Date(lastCommitAt);
  const daysSinceCommit = Math.floor(
    (now.getTime() - lastCommit.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceCommit < 30) return "active";
  if (daysSinceCommit < 180) return "stale";
  return "dormant";
}

// Category configuration for UI
export const categoryConfig: Record<TechCategory, {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  frontend: {
    color: "#06b6d4",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    label: "Frontend",
  },
  backend: {
    color: "#3b82f6",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    label: "Backend",
  },
  database: {
    color: "#10b981",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    label: "Database",
  },
  auth: {
    color: "#8b5cf6",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    label: "Auth",
  },
  storage: {
    color: "#f59e0b",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    label: "Storage",
  },
  payments: {
    color: "#f43f5e",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    label: "Payments",
  },
  ai: {
    color: "#14b8a6",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/30",
    label: "AI",
  },
  email: {
    color: "#0ea5e9",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    label: "Email",
  },
  analytics: {
    color: "#6366f1",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
    label: "Analytics",
  },
  observability: {
    color: "#a855f7",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    label: "Observability",
  },
  cms: {
    color: "#d946ef",
    bgColor: "bg-fuchsia-500/10",
    borderColor: "border-fuchsia-500/30",
    label: "CMS",
  },
  testing: {
    color: "#84cc16",
    bgColor: "bg-lime-500/10",
    borderColor: "border-lime-500/30",
    label: "Testing",
  },
  devops: {
    color: "#64748b",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    label: "DevOps",
  },
  deployment: {
    color: "#0284c7",
    bgColor: "bg-sky-600/10",
    borderColor: "border-sky-600/30",
    label: "Deployment",
  },
  search: {
    color: "#eab308",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    label: "Search",
  },
  queue: {
    color: "#ec4899",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
    label: "Queue",
  },
  cache: {
    color: "#22c55e",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    label: "Cache",
  },
  realtime: {
    color: "#7c3aed",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    label: "Realtime",
  },
  validation: {
    color: "#fb7185",
    bgColor: "bg-rose-400/10",
    borderColor: "border-rose-400/30",
    label: "Validation",
  },
};

// Default tags
export const defaultTags: ProjectTag[] = [
  { id: "client", name: "Client", color: "#3b82f6" },
  { id: "side-project", name: "Side Project", color: "#10b981" },
  { id: "production", name: "Production", color: "#f59e0b" },
  { id: "deprecated", name: "Deprecated", color: "#6b7280" },
  { id: "experimental", name: "Experimental", color: "#8b5cf6" },
];
