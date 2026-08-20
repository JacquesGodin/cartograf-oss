import {
  getTechLayer,
  techCategories,
  type Project,
  type ProjectActivity,
  type TechCategory,
  type TechUsage,
  type TechUsageEvidence,
} from "@/lib/types";

export interface DetectedTech {
  name: string;
  version?: string;
  packages: string[];
  usage: TechUsage;
}

export interface PackageJsonDetails {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  name?: string;
  description?: string | null;
}

interface DeploymentPattern {
  name: string;
  packages: string[];
  files: string[];
  filePatterns?: RegExp[];
  scriptPatterns: RegExp[];
}

export interface SourceFile {
  path: string;
  content: string;
}

export type ScannerStack = Record<TechCategory, DetectedTech[]>;

export interface SourceUsageProgress {
  checkedPairs: number;
  packageCount: number;
  sourceFileCount: number;
}

export interface DetectSourceUsageOptions {
  yieldEvery?: number;
  onProgress?: (progress: SourceUsageProgress) => void | Promise<void>;
}

export interface StackProjectInput {
  projectId: string;
  githubOwner: string;
  githubRepo: string;
  url: string;
  displayName: string;
  description: string | null;
  stack: ScannerStack;
  icon?: string;
  activity?: ProjectActivity;
  lastAnalyzedAt?: string;
}

export const MAX_SOURCE_FILES = 50;
export const MAX_SOURCE_FILE_SIZE = 200_000;

export const ignoredPathSegments = new Set([
  "node_modules",
  ".git",
  ".next",
  ".ssh",
  ".aws",
  ".gcloud",
  ".azure",
  "dist",
  "build",
  "coverage",
  "vendor",
]);

export const TECH_PATTERNS: Record<TechCategory, Record<string, string[]>> = {
  frontend: {
    React: ["react"],
    Vue: ["vue"],
    Svelte: ["svelte", "@sveltejs/kit"],
    Angular: ["@angular/core"],
    Tailwind: ["tailwindcss"],
    "Radix UI": ["@radix-ui/*"],
    "Framer Motion": ["framer-motion", "motion"],
    "React Native": ["react-native", "expo"],
    "Three.js": ["three", "@react-three/fiber"],
  },
  backend: {
    "Next.js": ["next"],
    Express: ["express"],
    Fastify: ["fastify"],
    Hono: ["hono"],
    NestJS: ["@nestjs/core"],
    Nuxt: ["nuxt"],
    Remix: ["@remix-run/node", "@remix-run/react"],
    Astro: ["astro"],
    Vite: ["vite"],
    Elysia: ["elysia"],
  },
  database: {
    Supabase: ["@supabase/supabase-js", "@supabase/ssr"],
    Neon: ["@neondatabase/serverless"],
    MongoDB: ["mongodb", "mongoose"],
    PostgreSQL: ["pg", "postgres", "@vercel/postgres"],
    Prisma: ["prisma", "@prisma/client"],
    Drizzle: ["drizzle-orm"],
    PlanetScale: ["@planetscale/database"],
    Turso: ["@libsql/client"],
    Firebase: ["firebase", "firebase-admin"],
    Convex: ["convex"],
  },
  auth: {
    Clerk: ["@clerk/nextjs", "@clerk/clerk-sdk-node"],
    "Supabase Auth": ["@supabase/auth-helpers-nextjs"],
    NextAuth: ["next-auth", "@auth/core"],
    Lucia: ["lucia"],
    "Better Auth": ["better-auth"],
    Kinde: ["@kinde-oss/kinde-auth-nextjs"],
    Auth0: ["@auth0/nextjs-auth0"],
  },
  storage: {
    "AWS S3": ["@aws-sdk/client-s3", "aws-sdk"],
    Uploadthing: ["uploadthing", "@uploadthing/react"],
    "Vercel Blob": ["@vercel/blob"],
    Cloudinary: ["cloudinary"],
    Minio: ["minio"],
  },
  payments: {
    Stripe: ["stripe", "@stripe/stripe-js"],
    "Lemon Squeezy": ["@lemonsqueezy/lemonsqueezy.js"],
    Paddle: ["@paddle/paddle-js"],
    PayPal: ["@paypal/react-paypal-js"],
  },
  ai: {
    "AI SDK": ["ai"],
    OpenAI: ["openai", "@ai-sdk/openai"],
    Anthropic: ["@anthropic-ai/sdk", "@ai-sdk/anthropic"],
    LangChain: ["langchain", "@langchain/core"],
    "Google AI": ["@google/generative-ai", "@ai-sdk/google"],
    Mistral: ["@mistralai/mistralai", "@ai-sdk/mistral"],
    Cohere: ["cohere-ai", "@ai-sdk/cohere"],
    Pinecone: ["@pinecone-database/pinecone"],
  },
  email: {
    Resend: ["resend"],
    Nodemailer: ["nodemailer"],
    SendGrid: ["@sendgrid/mail"],
    Postmark: ["postmark"],
    Mailgun: ["mailgun.js"],
    "React Email": ["react-email", "@react-email/*"],
  },
  analytics: {
    PostHog: ["posthog-js", "posthog-node"],
    "Vercel Analytics": ["@vercel/analytics"],
    "Google Analytics": ["@next/third-parties", "gtag"],
    Mixpanel: ["mixpanel", "mixpanel-browser"],
    Amplitude: ["@amplitude/analytics-browser", "@amplitude/node"],
    Plausible: ["plausible-tracker"],
  },
  observability: {
    Sentry: ["@sentry/*"],
    "OpenTelemetry": ["@opentelemetry/*"],
    Datadog: ["dd-trace", "@datadog/browser-rum", "@datadog/browser-logs"],
    Logtail: ["@logtail/node", "@logtail/next"],
    Axiom: ["@axiomhq/js"],
    Highlight: ["highlight.run", "@highlight-run/node"],
  },
  cms: {
    Sanity: ["sanity", "@sanity/client"],
    Contentful: ["contentful"],
    Strapi: ["@strapi/*", "strapi"],
    Payload: ["payload"],
    Prismic: ["@prismicio/client", "@prismicio/react"],
    Storyblok: ["@storyblok/react", "storyblok-js-client"],
  },
  testing: {
    Vitest: ["vitest"],
    Jest: ["jest"],
    Playwright: ["@playwright/test", "playwright"],
    Cypress: ["cypress"],
    "Testing Library": ["@testing-library/*"],
    Storybook: ["storybook", "@storybook/*"],
  },
  devops: {
    Docker: ["dockerode"],
    Turborepo: ["turbo"],
    Nx: ["nx", "@nx/*"],
    Changesets: ["@changesets/cli"],
  },
  deployment: {
    Vercel: ["vercel"],
    Netlify: ["netlify-cli"],
    Cloudflare: ["wrangler"],
    "Firebase Hosting": ["firebase-tools"],
    Railway: ["@railway/cli"],
    "GitHub Pages": ["gh-pages"],
    "AWS Amplify": ["@aws-amplify/cli"],
    "Azure Static Web Apps": ["@azure/static-web-apps-cli"],
  },
  search: {
    Algolia: ["algoliasearch", "react-instantsearch"],
    Meilisearch: ["meilisearch"],
    Typesense: ["typesense"],
    Elasticsearch: ["@elastic/elasticsearch"],
  },
  queue: {
    BullMQ: ["bullmq"],
    Bull: ["bull"],
    Inngest: ["inngest"],
    "Trigger.dev": ["@trigger.dev/sdk", "@trigger.dev/react"],
    "Upstash QStash": ["@upstash/qstash"],
    Temporal: ["@temporalio/*"],
  },
  cache: {
    Redis: ["redis", "@upstash/redis", "ioredis"],
    Memcached: ["memcached"],
    LRU: ["lru-cache"],
  },
  realtime: {
    "Socket.IO": ["socket.io", "socket.io-client"],
    Pusher: ["pusher", "pusher-js"],
    Ably: ["ably"],
    Liveblocks: ["@liveblocks/*"],
    PartyKit: ["partykit"],
  },
  validation: {
    Zod: ["zod"],
    Yup: ["yup"],
    Valibot: ["valibot"],
    Joi: ["joi"],
    "Class Validator": ["class-validator"],
  },
};

const DEPLOYMENT_PATTERNS: DeploymentPattern[] = [
  {
    name: "Vercel",
    packages: ["vercel"],
    files: ["vercel.json", ".vercel/project.json"],
    scriptPatterns: [/\bvercel\b/],
  },
  {
    name: "Netlify",
    packages: ["netlify-cli"],
    files: ["netlify.toml"],
    filePatterns: [/^(public\/)?_(redirects|headers)$/],
    scriptPatterns: [/\bnetlify\b/],
  },
  {
    name: "Cloudflare",
    packages: ["wrangler"],
    files: ["wrangler.toml", "wrangler.json", "wrangler.jsonc"],
    scriptPatterns: [/\bwrangler\b/],
  },
  {
    name: "Firebase Hosting",
    packages: ["firebase-tools"],
    files: ["firebase.json", ".firebaserc"],
    scriptPatterns: [/\bfirebase\s+deploy\b/],
  },
  {
    name: "Render",
    packages: [],
    files: ["render.yaml", "render.yml"],
    scriptPatterns: [],
  },
  {
    name: "Fly.io",
    packages: [],
    files: ["fly.toml"],
    scriptPatterns: [/\bfly(?:ctl)?\s+deploy\b/],
  },
  {
    name: "Railway",
    packages: ["@railway/cli"],
    files: ["railway.json", "railway.toml"],
    scriptPatterns: [/\brailway\s+(?:up|deploy)\b/],
  },
  {
    name: "Heroku",
    packages: [],
    files: ["heroku.yml", "app.json"],
    scriptPatterns: [/\bheroku\b/, /\bgit\s+push\s+heroku\b/],
  },
  {
    name: "AWS Amplify",
    packages: ["@aws-amplify/cli"],
    files: ["amplify.yml"],
    filePatterns: [/^amplify\//],
    scriptPatterns: [/\bamplify\s+(?:publish|push)\b/],
  },
  {
    name: "Azure Static Web Apps",
    packages: ["@azure/static-web-apps-cli"],
    files: ["staticwebapp.config.json"],
    filePatterns: [/^\.github\/workflows\/azure-static-web-apps.*\.ya?ml$/],
    scriptPatterns: [/\bswa\s+deploy\b/],
  },
  {
    name: "GitHub Pages",
    packages: ["gh-pages"],
    files: [".nojekyll", "docs/.nojekyll"],
    scriptPatterns: [/\bgh-pages\b/],
  },
  {
    name: "DigitalOcean App Platform",
    packages: [],
    files: [".do/app.yaml"],
    scriptPatterns: [/\bdoctl\s+apps\b/],
  },
];

export function parsePackageJsonContent(content: string) {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid package.json format.");
  }
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => (
      typeof entry[1] === "string"
    ))
  );
}

export function getPackageJsonDetails(packageJson: unknown): PackageJsonDetails {
  const record = objectRecord(packageJson);

  return {
    dependencies: {
      ...toStringRecord(record.dependencies),
      ...toStringRecord(record.devDependencies),
    },
    scripts: toStringRecord(record.scripts),
    name: typeof record.name === "string" ? record.name : undefined,
    description: typeof record.description === "string" ? record.description : null,
  };
}

export function packagePatternMatches(pattern: string, packageName: string) {
  if (pattern.endsWith("/*")) {
    return packageName.startsWith(pattern.slice(0, -1));
  }

  return packageName === pattern;
}

function deploymentFileMatches(pattern: DeploymentPattern, filePath: string) {
  return (
    pattern.files.includes(filePath) ||
    !!pattern.filePatterns?.some((filePattern) => filePattern.test(filePath))
  );
}

export function detectDeploymentEvidence(
  packageJson: PackageJsonDetails,
  filePaths: string[] = []
) {
  return DEPLOYMENT_PATTERNS.map((pattern) => {
    const packages = Object.keys(packageJson.dependencies).filter((packageName) =>
      pattern.packages.some((packagePattern) =>
        packagePatternMatches(packagePattern, packageName)
      )
    );
    const configEvidence = filePaths
      .filter((filePath) => deploymentFileMatches(pattern, filePath))
      .map((filePath) => ({
        type: "used" as const,
        file: filePath,
        detail: `${pattern.name} deployment configuration`,
      }));
    const scriptEvidence = Object.entries(packageJson.scripts)
      .filter(([, script]) =>
        pattern.scriptPatterns.some((scriptPattern) => scriptPattern.test(script))
      )
      .map(([scriptName, script]) => ({
        type: "used" as const,
        file: "package.json",
        detail: `script "${scriptName}": ${script}`,
      }));

    return {
      name: pattern.name,
      packages,
      packageVersions: Object.fromEntries(
        packages.map((packageName) => [packageName, packageJson.dependencies[packageName]])
      ),
      evidence: [...configEvidence, ...scriptEvidence],
    };
  }).filter((provider) => provider.packages.length > 0 || provider.evidence.length > 0);
}

export function createEmptyStack(): ScannerStack {
  return Object.fromEntries(
    techCategories.map((category) => [category, []])
  ) as unknown as ScannerStack;
}

export function addDeploymentEvidenceToStack(
  stack: ScannerStack,
  deploymentEvidence: ReturnType<typeof detectDeploymentEvidence>
) {
  deploymentEvidence.forEach((provider) => {
    const existing = stack.deployment.find((tech) => tech.name === provider.name);
    if (existing) {
      existing.packages = [...new Set([...existing.packages, ...provider.packages])];
      existing.version = existing.version || provider.packageVersions[provider.packages[0]];
      existing.usage.used = existing.usage.used || provider.evidence.length > 0;
      existing.usage.evidence = [
        ...existing.usage.evidence,
        ...provider.evidence,
      ];
      return;
    }

    stack.deployment.push({
      name: provider.name,
      version: provider.packageVersions[provider.packages[0]],
      packages: provider.packages,
      usage: {
        installed: provider.packages.length > 0,
        imported: false,
        used: provider.evidence.length > 0,
        evidence: [
          ...provider.packages.map((packageName) => ({
            type: "installed" as const,
            file: "package.json",
            detail: `${packageName}: ${provider.packageVersions[packageName]}`,
          })),
          ...provider.evidence,
        ],
      },
    });
  });
}

export function detectStack(
  dependencies: Record<string, string>,
  sourceUsageByPackage = new Map<string, TechUsageEvidence[]>()
): ScannerStack {
  const stack = createEmptyStack();
  const allDeps = Object.keys(dependencies);

  for (const [category, patterns] of Object.entries(TECH_PATTERNS)) {
    for (const [techName, packageNames] of Object.entries(patterns)) {
      const matchedPackages = allDeps.filter((dependencyName) =>
        packageNames.some((pattern) =>
          packagePatternMatches(pattern, dependencyName)
        )
      );

      if (matchedPackages.length === 0) continue;

      const techs = stack[category as TechCategory];
      const existingNames = techs.map((tech) => tech.name);
      if (existingNames.includes(techName)) continue;

      const usageEvidence = matchedPackages.flatMap((packageName) => [
        {
          type: "installed" as const,
          file: "package.json",
          detail: `${packageName}: ${dependencies[packageName]}`,
        },
        ...(sourceUsageByPackage.get(packageName) || []),
      ]);

      techs.push({
        name: techName,
        version: dependencies[matchedPackages[0]],
        packages: matchedPackages,
        usage: {
          installed: true,
          imported: usageEvidence.some((evidence) => evidence.type === "imported"),
          used: usageEvidence.some((evidence) => evidence.type === "used"),
          evidence: usageEvidence,
        },
      });
    }
  }

  return stack;
}

export function applyDeploymentDetection(
  stack: ScannerStack,
  packageJson: PackageJsonDetails,
  filePaths: string[] = []
) {
  addDeploymentEvidenceToStack(
    stack,
    detectDeploymentEvidence(packageJson, filePaths)
  );
  return stack;
}

export function buildStack(
  packageJson: PackageJsonDetails,
  filePaths: string[] = [],
  sourceUsageByPackage = new Map<string, TechUsageEvidence[]>()
) {
  return applyDeploymentDetection(
    detectStack(packageJson.dependencies, sourceUsageByPackage),
    packageJson,
    filePaths
  );
}

export function hasRecognizedStack(stack: ScannerStack) {
  return Object.values(stack).some((arr) => arr.length > 0);
}

export function getDetectedPackageNames(stack: ScannerStack) {
  return [...new Set(techCategories.flatMap((category) =>
    stack[category].flatMap((tech) => tech.packages)
  ))];
}

export async function detectSourceUsageInFiles(
  sourceFiles: SourceFile[],
  packageNames: string[],
  options: DetectSourceUsageOptions = {}
) {
  const usageByPackage = new Map<string, TechUsageEvidence[]>();
  let checkedPairs = 0;

  for (const packageName of packageNames) {
    const evidence: TechUsageEvidence[] = [];

    for (const file of sourceFiles) {
      evidence.push(...detectPackageUsageInFile(file, packageName));
      checkedPairs++;

      if (options.yieldEvery && checkedPairs % options.yieldEvery === 0) {
        await options.onProgress?.({
          checkedPairs,
          packageCount: packageNames.length,
          sourceFileCount: sourceFiles.length,
        });
      }
    }

    if (evidence.length > 0) {
      usageByPackage.set(packageName, evidence);
    }
  }

  return usageByPackage;
}

export function detectPackageUsageInFile(file: SourceFile, packageName: string): TechUsageEvidence[] {
  const evidence: TechUsageEvidence[] = [];
  const sourcePattern = `${packageSourcePattern(packageName)}(?:\\/[^"']*)?`;
  const importRegex = new RegExp(`import\\s+([^;]*?)\\s+from\\s+["'](${sourcePattern})["']`, "g");
  const sideEffectImportRegex = new RegExp(`import\\s+["'](${sourcePattern})["']`, "g");
  const requireRegex = new RegExp(`(?:const|let|var)\\s+([^;=]+?)\\s*=\\s*require\\(["'](${sourcePattern})["']\\)`, "g");
  const dynamicImportRegex = new RegExp(`import\\(["'](${sourcePattern})["']\\)`, "g");

  for (const match of file.content.matchAll(importRegex)) {
    const statement = match[0];
    const line = lineForIndex(file.content, match.index || 0);
    const identifiers = parseImportIdentifiers(match[1]);

    evidence.push({
      type: "imported",
      file: file.path,
      line,
      detail: statement.replace(/\s+/g, " ").trim(),
    });

    if (hasIdentifierUse(file.content, match.index || 0, statement.length, identifiers)) {
      evidence.push({
        type: "used",
        file: file.path,
        line,
        detail: identifiers.length > 0 ? identifiers.join(", ") : statement.replace(/\s+/g, " ").trim(),
      });
    }
  }

  for (const match of file.content.matchAll(sideEffectImportRegex)) {
    const statement = match[0];
    const line = lineForIndex(file.content, match.index || 0);
    evidence.push({
      type: "imported",
      file: file.path,
      line,
      detail: statement,
    });
    evidence.push({
      type: "used",
      file: file.path,
      line,
      detail: "side-effect import",
    });
  }

  for (const match of file.content.matchAll(requireRegex)) {
    const statement = match[0];
    const line = lineForIndex(file.content, match.index || 0);
    const requireTarget = match[1].trim();
    const identifiers = requireTarget.startsWith("{")
      ? parseImportIdentifiers(requireTarget)
      : [requireTarget].filter((identifier) => /^[A-Za-z_$][\w$]*$/.test(identifier));

    evidence.push({
      type: "imported",
      file: file.path,
      line,
      detail: statement.replace(/\s+/g, " ").trim(),
    });

    if (hasIdentifierUse(file.content, match.index || 0, statement.length, identifiers)) {
      evidence.push({
        type: "used",
        file: file.path,
        line,
        detail: identifiers.join(", "),
      });
    }
  }

  for (const match of file.content.matchAll(dynamicImportRegex)) {
    const statement = match[0];
    const line = lineForIndex(file.content, match.index || 0);
    evidence.push({
      type: "imported",
      file: file.path,
      line,
      detail: statement,
    });
    evidence.push({
      type: "used",
      file: file.path,
      line,
      detail: "dynamic import",
    });
  }

  return evidence;
}

function parseImportIdentifiers(importClause: string) {
  const identifiers: string[] = [];
  const namespaceMatch = importClause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch) {
    identifiers.push(namespaceMatch[1]);
  }

  const namedMatch = importClause.match(/\{([^}]+)\}/);
  if (namedMatch) {
    namedMatch[1].split(",").forEach((part) => {
      const cleaned = part.trim().replace(/^type\s+/, "");
      const pieces = cleaned.split(/\s+as\s+/);
      const identifier = (pieces[1] || pieces[0]).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(identifier)) {
        identifiers.push(identifier);
      }
    });
  }

  const defaultPart = importClause
    .replace(/\{[^}]+\}/g, "")
    .replace(/\*\s+as\s+[A-Za-z_$][\w$]*/g, "")
    .split(",")[0]
    .trim();
  if (/^[A-Za-z_$][\w$]*$/.test(defaultPart)) {
    identifiers.push(defaultPart);
  }

  return identifiers;
}

function hasIdentifierUse(
  content: string,
  statementStart: number,
  statementLength: number,
  identifiers: string[]
) {
  const statementEnd = statementStart + statementLength;

  return identifiers.some((identifier) => {
    const regex = identifierPattern(identifier);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match.index < statementStart || match.index >= statementEnd) {
        return true;
      }
    }
    return false;
  });
}

function identifierPattern(identifier: string) {
  return new RegExp(`\\b${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
}

function packageSourcePattern(packageName: string) {
  return packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineForIndex(content: string, index: number) {
  return content.slice(0, index).split("\n").length;
}

export function normalizeProjectPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function pathDepth(path: string) {
  return path.split("/").length;
}

export function pathHasIgnoredSegment(path: string, includePublic = false) {
  return path.split("/").some((segment) =>
    ignoredPathSegments.has(segment) || (includePublic && segment === "public")
  );
}

export function isSensitiveFilePath(path: string) {
  const fileName = path.split("/").at(-1)?.toLowerCase() || "";
  const sensitiveFileNames = new Set([
    ".npmrc",
    ".yarnrc",
    ".yarnrc.yml",
    ".pypirc",
    ".netrc",
    "credentials.json",
    "service-account.json",
    "service_account.json",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
  ]);

  return (
    /^\.env(?:\..*)?$/.test(fileName) ||
    sensitiveFileNames.has(fileName) ||
    /\.(?:pem|key|p12|pfx)$/.test(fileName) ||
    /(?:service[-_]account|private[-_]key|credentials?|secrets?)/.test(fileName)
  );
}

export function isSourceFile(path: string) {
  return /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(path);
}

export function shouldScanSourcePath(path: string) {
  return (
    isSourceFile(path) &&
    !pathHasIgnoredSegment(path, true) &&
    !isSensitiveFilePath(path)
  );
}

export function stackToProject(input: StackProjectInput): Project {
  const techInstances = techCategories.flatMap((category) =>
    input.stack[category].map((tech) => ({
      id: `${input.projectId}-${category}-${tech.name}`,
      projectId: input.projectId,
      technologyId: tech.name.toLowerCase().replace(/\s+/g, "-"),
      technologyName: tech.name,
      category,
      layer: getTechLayer(tech.name, category),
      version: tech.version,
      environment: "unknown" as const,
      source: "detected" as const,
      usage: tech.usage,
    }))
  );

  return {
    id: input.projectId,
    githubOwner: input.githubOwner,
    githubRepo: input.githubRepo,
    url: input.url,
    displayName: input.displayName,
    description: input.description,
    tags: [],
    icon: input.icon,
    lastAnalyzedAt: input.lastAnalyzedAt ?? new Date().toISOString(),
    activity: input.activity,
    techInstances,
  };
}
