import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type Project,
  type Account,
  type ProjectTag,
  type TechInstance,
  type Environment,
  type TechLayerMode,
  type LayerVisibility,
  defaultLayerVisibility,
  defaultTags,
} from "./types";
import { getProjectSearchResults, projectMatchesSearch } from "./project-search";
import {
  debugLog,
  debugWarn,
  getBrowserSnapshot,
  measureDuration,
  summarizeProjects,
} from "./debug-logger";

interface AppState {
  // Data
  projects: Project[];
  accounts: Account[];
  tags: ProjectTag[];
  
  // UI State
  selectedProjectId: string | null;
  selectedTechInstanceId: string | null;
  expandedProjects: string[];
  searchQuery: string;
  techLayerMode: TechLayerMode;
  layerVisibility: LayerVisibility;
  filters: {
    accounts: string[];
    tags: string[];
    technologies: string[];
    activityStatus: ("active" | "stale" | "dormant")[];
  };
  isPanelOpen: boolean;
  
  // Actions - Projects
  setProjects: (projects: Project[]) => void;
  importData: (data: { projects: Project[]; accounts: Account[]; tags: ProjectTag[] }) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  updateProjectNotes: (projectId: string, notes: string) => void;
  updateProjectTags: (projectId: string, tagIds: string[]) => void;
  deleteProject: (projectId: string) => void;
  
  // Actions - Accounts
  addAccount: (account: Account) => void;
  updateAccount: (accountId: string, updates: Partial<Account>) => void;
  deleteAccount: (accountId: string) => void;
  
  // Actions - Tags
  addTag: (tag: ProjectTag) => void;
  updateTag: (tagId: string, updates: Partial<ProjectTag>) => void;
  deleteTag: (tagId: string) => void;
  
  // Actions - Tech Instances
  assignAccountToTech: (techInstanceId: string, accountId: string | undefined) => void;
  assignAccountToInstances: (techInstanceIds: string[], accountId: string) => void;
  updateTechInstance: (techInstanceId: string, updates: Partial<TechInstance>) => void;
  setTechEnvironment: (techInstanceId: string, environment: Environment) => void;
  
  // Actions - UI
  setSelectedProject: (projectId: string | null) => void;
  setSelectedTechInstance: (techInstanceId: string | null) => void;
  toggleProjectExpanded: (projectId: string) => void;
  setSearchQuery: (query: string) => void;
  setTechLayerMode: (mode: TechLayerMode) => void;
  setLayerVisibility: (visibility: Partial<LayerVisibility>) => void;
  setFilters: (filters: Partial<AppState["filters"]>) => void;
  clearFilters: () => void;
  setPanelOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      projects: [],
      accounts: [],
      tags: defaultTags,
      selectedProjectId: null,
      selectedTechInstanceId: null,
      expandedProjects: [],
      searchQuery: "",
      techLayerMode: "services",
      layerVisibility: defaultLayerVisibility,
      filters: {
        accounts: [],
        tags: [],
        technologies: [],
        activityStatus: [],
      },
      isPanelOpen: false,
      
      // Project actions
      setProjects: (projects) => set({ projects }),

      // Merge an imported snapshot into the current state (imported wins on id).
      importData: (data) =>
        set((state) => {
          const byId = <T extends { id: string }>(existing: T[], incoming: T[]) => {
            const map = new Map(existing.map((x) => [x.id, x]));
            for (const x of incoming) map.set(x.id, x);
            return [...map.values()];
          };
          return {
            projects: byId(state.projects, data.projects),
            accounts: byId(state.accounts, data.accounts),
            tags: byId(state.tags, data.tags),
          };
        }),
      
      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects.filter((p) => p.id !== project.id), project],
        })),
      
      updateProject: (projectId, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        })),
      
      updateProjectNotes: (projectId, notes) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, notes } : p
          ),
        })),
      
      updateProjectTags: (projectId, tagIds) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, tags: tagIds } : p
          ),
        })),

      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          selectedProjectId:
            state.selectedProjectId === projectId ? null : state.selectedProjectId,
        })),

      // Account actions
      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account],
        })),
      
      updateAccount: (accountId, updates) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === accountId ? { ...a, ...updates } : a
          ),
        })),
      
      deleteAccount: (accountId) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== accountId),
          // Also remove account references from tech instances
          projects: state.projects.map((p) => ({
            ...p,
            techInstances: p.techInstances.map((ti) =>
              ti.accountId === accountId ? { ...ti, accountId: undefined } : ti
            ),
          })),
        })),
      
      // Tag actions
      addTag: (tag) =>
        set((state) => ({
          tags: [...state.tags, tag],
        })),
      
      updateTag: (tagId, updates) =>
        set((state) => ({
          tags: state.tags.map((t) =>
            t.id === tagId ? { ...t, ...updates } : t
          ),
        })),
      
      deleteTag: (tagId) =>
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== tagId),
          // Also remove tag references from projects
          projects: state.projects.map((p) => ({
            ...p,
            tags: p.tags.filter((t) => t !== tagId),
          })),
        })),
      
      // Tech instance actions
      assignAccountToTech: (techInstanceId, accountId) =>
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            techInstances: p.techInstances.map((ti) =>
              ti.id === techInstanceId ? { ...ti, accountId } : ti
            ),
          })),
        })),

      // Assign one account to many instances at once (single re-render).
      assignAccountToInstances: (techInstanceIds, accountId) => {
        const idSet = new Set(techInstanceIds);
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            techInstances: p.techInstances.map((ti) =>
              idSet.has(ti.id) ? { ...ti, accountId } : ti
            ),
          })),
        }));
      },

      updateTechInstance: (techInstanceId, updates) =>
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            techInstances: p.techInstances.map((ti) =>
              ti.id === techInstanceId ? { ...ti, ...updates } : ti
            ),
          })),
        })),
      
      setTechEnvironment: (techInstanceId, environment) =>
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            techInstances: p.techInstances.map((ti) =>
              ti.id === techInstanceId ? { ...ti, environment } : ti
            ),
          })),
        })),
      
      // UI actions
      setSelectedProject: (projectId) =>
        set({ selectedProjectId: projectId, isPanelOpen: !!projectId }),
      
      setSelectedTechInstance: (techInstanceId) =>
        set({ selectedTechInstanceId: techInstanceId }),
      
      toggleProjectExpanded: (projectId) =>
        set((state) => {
          const isExpanded = state.expandedProjects.includes(projectId);
          return {
            expandedProjects: isExpanded
              ? state.expandedProjects.filter((id) => id !== projectId)
              : [...state.expandedProjects, projectId],
          };
        }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),

      setTechLayerMode: (mode) => set({ techLayerMode: mode }),

      setLayerVisibility: (visibility) =>
        set((state) => ({ layerVisibility: { ...state.layerVisibility, ...visibility } })),
      
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      
      clearFilters: () =>
        set({
          filters: {
            accounts: [],
            tags: [],
            technologies: [],
            activityStatus: [],
          },
          searchQuery: "",
        }),
      
      setPanelOpen: (open) => set({ isPanelOpen: open }),
    }),
    {
      name: "stackmapper",
      version: 2,
      skipHydration: false,
      onRehydrateStorage: () => {
        const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
        debugLog("store", "rehydration started", getBrowserSnapshot({
          includeLocalStorage: true,
        }));

        return (state, error) => {
          const data = {
            durationMs: startedAt ? measureDuration(startedAt) : undefined,
            accounts: state?.accounts.length ?? 0,
            tags: state?.tags.length ?? 0,
            projects: summarizeProjects(state?.projects ?? []),
            ...getBrowserSnapshot({ includeLocalStorage: true }),
          };

          if (error) {
            debugWarn("store", "rehydration failed", {
              ...data,
              error: error instanceof Error ? error.message : String(error),
            });
            return;
          }

          debugLog("store", "rehydration completed", data);
        };
      },
      partialize: (state) => ({
        accounts: state.accounts,
        tags: state.tags,
        layerVisibility: state.layerVisibility,
        // Persist full project data so map reloads without re-fetching GitHub
        projects: state.projects.filter(isCompleteProject).map((p) => ({
          id: p.id,
          displayName: p.displayName,
          url: p.url,
          githubOwner: p.githubOwner,
          githubRepo: p.githubRepo,
          lastAnalyzedAt: p.lastAnalyzedAt,
          activity: p.activity,
          label: p.label,
          notes: p.notes,
          tags: p.tags,
          techInstances: p.techInstances.map((ti) => ({
            id: ti.id,
            projectId: ti.projectId,
            technologyId: ti.technologyId,
            technologyName: ti.technologyName,
            category: ti.category,
            layer: ti.layer,
            version: ti.version,
            source: ti.source,
            accountId: ti.accountId,
            environment: ti.environment,
            notes: ti.notes,
          })),
        })),
      }),
    }
  )
);

export function resetAppStoreState() {
  useAppStore.setState({
    projects: [],
    accounts: [],
    tags: [...defaultTags],
    selectedProjectId: null,
    selectedTechInstanceId: null,
    expandedProjects: [],
    searchQuery: "",
    techLayerMode: "services",
    layerVisibility: { ...defaultLayerVisibility },
    filters: {
      accounts: [],
      tags: [],
      technologies: [],
      activityStatus: [],
    },
    isPanelOpen: false,
  });
}

// Selector hooks for common queries
export function isCompleteProject(project: Partial<Project> | null | undefined): project is Project {
  return (
    !!project &&
    typeof project.id === "string" &&
    typeof project.displayName === "string" &&
    Array.isArray(project.tags) &&
    Array.isArray(project.techInstances) &&
    project.techInstances.every(
      (tech) =>
        !!tech &&
        typeof tech.id === "string" &&
        typeof tech.technologyName === "string" &&
        typeof tech.category === "string"
    )
  );
}

export const useLoadedProjects = () => {
  const projects = useAppStore((state) => state.projects);

  return useMemo(
    () => projects.filter(isCompleteProject),
    [projects]
  );
};

export const useSelectedProject = () => {
  const projects = useLoadedProjects();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);

  return useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );
};

function projectMatchesFilters(
  project: Project,
  filters: AppState["filters"]
) {
  // Account filter
  if (filters.accounts.length > 0) {
    const projectAccountIds = project.techInstances
      .map((ti) => ti.accountId)
      .filter(Boolean);
    if (!filters.accounts.some((id) => projectAccountIds.includes(id))) {
      return false;
    }
  }

  // Tag filter
  if (filters.tags.length > 0) {
    if (!filters.tags.some((id) => project.tags.includes(id))) {
      return false;
    }
  }

  // Technology filter
  if (filters.technologies.length > 0) {
    const projectTechs = project.techInstances.map((ti) =>
      ti.technologyName.toLowerCase()
    );
    if (
      !filters.technologies.some((tech) =>
        projectTechs.includes(tech.toLowerCase())
      )
    ) {
      return false;
    }
  }

  // Activity status filter
  if (filters.activityStatus.length > 0) {
    const status = project.activity?.lastCommitAt
      ? getActivityStatusFromDate(project.activity.lastCommitAt)
      : "dormant";
    if (!filters.activityStatus.includes(status)) {
      return false;
    }
  }

  return true;
}

export const useProjectsMatchingFilters = () => {
  const projects = useLoadedProjects();
  const filters = useAppStore((state) => state.filters);

  return useMemo(
    () => projects.filter((project) => projectMatchesFilters(project, filters)),
    [projects, filters]
  );
};

export const useFilteredProjects = () => {
  const projects = useProjectsMatchingFilters();
  const searchQuery = useAppStore((state) => state.searchQuery);
  const tags = useAppStore((state) => state.tags);
  const accounts = useAppStore((state) => state.accounts);

  return useMemo(
    () =>
      projects.filter((project) => {
        return projectMatchesSearch(project, searchQuery, tags, accounts);
      }),
    [projects, searchQuery, tags, accounts]
  );
};

export const useSearchResults = () => {
  const projects = useProjectsMatchingFilters();
  const searchQuery = useAppStore((state) => state.searchQuery);
  const tags = useAppStore((state) => state.tags);
  const accounts = useAppStore((state) => state.accounts);

  return useMemo(
    () =>
      projects.flatMap((project) =>
        getProjectSearchResults(project, searchQuery, tags, accounts)
      ),
    [projects, searchQuery, tags, accounts]
  );
};

function getActivityStatusFromDate(lastCommitAt: string): "active" | "stale" | "dormant" {
  const now = new Date();
  const lastCommit = new Date(lastCommitAt);
  const daysSinceCommit = Math.floor(
    (now.getTime() - lastCommit.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceCommit < 30) return "active";
  if (daysSinceCommit < 180) return "stale";
  return "dormant";
}

// Get all unique technologies across projects
export const useAllTechnologies = () => {
  const projects = useLoadedProjects();

  return useMemo(() => {
    const techMap = new Map<string, { name: string; category: string; count: number }>();

    projects.forEach((project) => {
      project.techInstances.forEach((ti) => {
        const key = ti.technologyName.toLowerCase();
        const existing = techMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          techMap.set(key, {
            name: ti.technologyName,
            category: ti.category,
            count: 1,
          });
        }
      });
    });

    return Array.from(techMap.values()).sort((a, b) => b.count - a.count);
  }, [projects]);
};
