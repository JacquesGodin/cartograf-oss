import type { Account, Project, ProjectTag, TechInstance } from "./types";

export interface SearchResult {
  id: string;
  projectId: string;
  techInstanceId?: string;
  label: string;
  context: string;
  type: "project" | "tech" | "tag" | "account" | "note";
}

function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

function matches(value: string | null | undefined, query: string) {
  return !!value && value.toLowerCase().includes(query);
}

function findAccount(accounts: Account[], accountId?: string) {
  return accountId ? accounts.find((account) => account.id === accountId) : undefined;
}

function findProjectTags(tags: ProjectTag[], tagIds: string[]) {
  return tagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is ProjectTag => !!tag);
}

export function techMatchesSearch(
  tech: TechInstance,
  query: string,
  accounts: Account[]
) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return true;

  const account = findAccount(accounts, tech.accountId);

  return [
    tech.technologyName,
    tech.technologyId,
    tech.category,
    tech.version,
    tech.environment,
    tech.source,
    tech.notes,
    tech.usage?.installed ? "installed" : undefined,
    tech.usage?.imported ? "imported" : undefined,
    tech.usage?.used ? "used" : undefined,
    ...(tech.usage?.evidence.flatMap((evidence) => [
      evidence.type,
      evidence.file,
      evidence.detail,
    ]) || []),
    account?.name,
    account?.label,
    account?.provider,
  ].some((value) => matches(value, normalizedQuery));
}

export function projectOwnFieldsMatchSearch(
  project: Project,
  query: string,
  tags: ProjectTag[],
  accounts: Account[]
) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return true;

  const projectTags = findProjectTags(tags, project.tags);
  const projectAccounts = project.techInstances
    .map((tech) => findAccount(accounts, tech.accountId))
    .filter((account): account is Account => !!account);

  return [
    project.displayName,
    project.description,
    project.githubOwner,
    project.githubRepo,
    project.url,
    project.notes,
    ...projectTags.map((tag) => tag.name),
    ...projectAccounts.flatMap((account) => [
      account.name,
      account.label,
      account.provider,
    ]),
  ].some((value) => matches(value, normalizedQuery));
}

export function projectMatchesSearch(
  project: Project,
  query: string,
  tags: ProjectTag[],
  accounts: Account[]
) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return true;

  return (
    projectOwnFieldsMatchSearch(project, normalizedQuery, tags, accounts) ||
    project.techInstances.some((tech) =>
      techMatchesSearch(tech, normalizedQuery, accounts)
    )
  );
}

export function getProjectSearchMatch(
  project: Project,
  query: string,
  tags: ProjectTag[],
  accounts: Account[]
) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return {
      projectMatched: true,
      matchingTechInstanceIds: new Set(project.techInstances.map((tech) => tech.id)),
      matched: true,
    };
  }

  const projectMatched = projectOwnFieldsMatchSearch(
    project,
    normalizedQuery,
    tags,
    accounts
  );
  const matchingTechInstanceIds = new Set(
    project.techInstances
      .filter((tech) => techMatchesSearch(tech, normalizedQuery, accounts))
      .map((tech) => tech.id)
  );

  return {
    projectMatched,
    matchingTechInstanceIds,
    matched: projectMatched || matchingTechInstanceIds.size > 0,
  };
}

export function getProjectSearchResults(
  project: Project,
  query: string,
  tags: ProjectTag[],
  accounts: Account[]
): SearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  const results: SearchResult[] = [];
  const projectTags = findProjectTags(tags, project.tags);
  const projectAccounts = project.techInstances
    .map((tech) => findAccount(accounts, tech.accountId))
    .filter((account): account is Account => !!account);

  if (
    [
      project.displayName,
      project.description,
      project.githubOwner,
      project.githubRepo,
      project.url,
    ].some((value) => matches(value, normalizedQuery))
  ) {
    results.push({
      id: `${project.id}-project`,
      projectId: project.id,
      label: project.displayName,
      context: "Project",
      type: "project",
    });
  }

  if (matches(project.notes, normalizedQuery)) {
    results.push({
      id: `${project.id}-note`,
      projectId: project.id,
      label: project.displayName,
      context: "Project notes",
      type: "note",
    });
  }

  projectTags
    .filter((tag) => matches(tag.name, normalizedQuery))
    .forEach((tag) => {
      results.push({
        id: `${project.id}-tag-${tag.id}`,
        projectId: project.id,
        label: project.displayName,
        context: `Tag: ${tag.name}`,
        type: "tag",
      });
    });

  projectAccounts
    .filter((account) =>
      [account.name, account.label, account.provider].some((value) =>
        matches(value, normalizedQuery)
      )
    )
    .forEach((account) => {
      results.push({
        id: `${project.id}-account-${account.id}`,
        projectId: project.id,
        label: project.displayName,
        context: `Account: ${account.label || account.name}`,
        type: "account",
      });
    });

  project.techInstances
    .filter((tech) => techMatchesSearch(tech, normalizedQuery, accounts))
    .forEach((tech) => {
      results.push({
        id: `${project.id}-tech-${tech.id}`,
        projectId: project.id,
        techInstanceId: tech.id,
        label: tech.technologyName,
        context: project.displayName,
        type: "tech",
      });
    });

  return results;
}
