"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { UnifiedView } from "@/components/unified-view/unified-view";
import { AddProjectDialog } from "@/components/add-project-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { isCompleteProject, useAppStore, useFilteredProjects } from "@/lib/store";
import {
  analyzeLocalPackageFile,
  pickLocalFolder,
  scanDirectoryHandle,
} from "@/lib/local-project-scanner";
import { readStackFile } from "@/lib/import-stack";
import {
  debugLog,
  debugWarn,
  measureDuration,
  summarizeProjects,
} from "@/lib/debug-logger";
import {
  useBrowserDiagnostics,
  useRenderDiagnostics,
} from "@/hooks/use-debug-diagnostics";
import { type Project } from "@/lib/types";
import { Link as LinkIcon, AlertCircle, User, FolderOpen } from "lucide-react";
import { CgWordmark } from "@/components/cg-logo";
import { SearchFilters } from "@/components/search-filters";
import { SummaryPanel } from "@/components/summary-panel";

// A realistic full-stack manifest so first-timers can see a rich map instantly,
// without needing a repo of their own. Analyzed entirely in the browser.
const EXAMPLE_PACKAGE_JSON = JSON.stringify({
  name: "example-web-app",
  description: "A sample JavaScript app - see how cartograf maps a stack.",
  dependencies: {
    next: "^15.1.0",
    react: "^19.0.0",
    tailwindcss: "^4.0.0",
    zod: "^3.24.1",
    zustand: "^5.0.0",
    "date-fns": "^4.1.0",
    "react-hook-form": "^7.54.1",
    "lucide-react": "^0.564.0",
  },
  devDependencies: {
    vitest: "^4.1.0",
    typescript: "^5.7.0",
    eslint: "^9.39.0",
  },
});

export default function HomePage() {
  return <WorkspacePage />;
}

function WorkspacePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addDialogMode, setAddDialogMode] = useState<"repo" | "username" | "upload">("repo");

  function openDialog(mode: "repo" | "username" | "upload") {
    setError(null);
    setAddDialogMode(mode);
    setIsAddDialogOpen(true);
  }

  // Clear any stale error when the dialog is dismissed, so reopening it starts clean.
  function handleDialogOpenChange(open: boolean) {
    if (!open) setError(null);
    setIsAddDialogOpen(open);
  }

  const projects = useAppStore((state) => state.projects);
  const setProjects = useAppStore((state) => state.setProjects);
  const importData = useAppStore((state) => state.importData);
  const visibleProjects = useFilteredProjects();
  const hasWorkspace = hasLoaded || projects.length > 0;

  const handleImport = useCallback(
    async (file: File) => {
      try {
        importData(await readStackFile(file));
        setHasLoaded(true);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to import file.");
      }
    },
    [importData]
  );

  useRenderDiagnostics("HomePage", () => ({
    isLoading,
    hasLoaded: hasWorkspace,
    hasError: !!error,
    stored: summarizeProjects(projects),
    visible: summarizeProjects(visibleProjects),
  }));
  useBrowserDiagnostics("HomePage", () => ({
    isLoading,
    hasLoaded: hasWorkspace,
    hasError: !!error,
    stored: summarizeProjects(projects),
    visible: summarizeProjects(visibleProjects),
  }));

  const mergeProjects = useCallback(
    (fetchedProjects: Project[]) => {
      const existingProjects = projects;
      const fetchedProjectIds = new Set(fetchedProjects.map((p) => p.id));

      const merged = fetchedProjects.map((fetched) => {
        const existing = existingProjects.find((p) => p.id === fetched.id);
        if (!existing) return fetched;

        const existingTechInstances = Array.isArray(existing.techInstances)
          ? existing.techInstances
          : [];

        return {
          ...fetched,
          label: existing.label,
          notes: existing.notes,
          tags: Array.isArray(existing.tags) ? existing.tags : fetched.tags,
          techInstances: fetched.techInstances.map((ti) => {
            const existingTi = existingTechInstances.find((e) => e.id === ti.id);
            return existingTi
              ? { ...ti, accountId: existingTi.accountId, environment: existingTi.environment, notes: existingTi.notes }
              : ti;
          }),
        };
      });

      return [
        ...existingProjects.filter((p) => isCompleteProject(p) && !fetchedProjectIds.has(p.id)),
        ...merged,
      ];
    },
    [projects]
  );

  const analyzeSource = useCallback(
    async (mode: "username" | "repo", value: string) => {
      if (!value.trim()) return false;
      const startedAt = performance.now();
      debugLog("HomePage", "analysis started", {
        mode,
        value: value.trim(),
        before: summarizeProjects(projects),
      });
      setIsLoading(true);
      setError(null);
      try {
        const param = mode === "username" ? "username" : "repo";
        const response = await fetch(`/api/stack?${param}=${encodeURIComponent(value.trim())}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to fetch");
        if (Array.isArray(data)) {
          debugLog("HomePage", "analysis completed", {
            mode,
            durationMs: measureDuration(startedAt),
            fetched: summarizeProjects(data),
          });
        }
        setProjects(mergeProjects(data));
        setHasLoaded(true);
        return true;
      } catch (err) {
        debugWarn("HomePage", "analysis failed", {
          mode,
          durationMs: measureDuration(startedAt),
          error: err instanceof Error ? err.message : String(err),
        });
        setError(err instanceof Error ? err.message : "Something went wrong");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [mergeProjects, setProjects, projects]
  );

  const applyAnalyzedProjects = useCallback(
    (data: Project[]) => {
      debugLog("HomePage", "applying analyzed projects", {
        incoming: summarizeProjects(data),
        before: summarizeProjects(projects),
      });
      setProjects(mergeProjects(data));
      setHasLoaded(true);
    },
    [mergeProjects, projects, setProjects]
  );

  const handlePackageFileUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) { setError("Select a package.json file."); return false; }
      const startedAt = performance.now();
      debugLog("HomePage", "package upload started", {
        fileCount: files.length,
        firstFile: files[0]?.name,
      });
      setIsLoading(true);
      setError(null);
      try {
        const file = files[0];
        if (!file.name.endsWith(".json")) throw new Error("Select a package.json file.");
        applyAnalyzedProjects(await analyzeLocalPackageFile(file));
        debugLog("HomePage", "package upload completed", {
          durationMs: measureDuration(startedAt),
        });
        return true;
      } catch (err) {
        debugWarn("HomePage", "package upload failed", {
          durationMs: measureDuration(startedAt),
          error: err instanceof Error ? err.message : String(err),
        });
        setError(err instanceof Error ? err.message : "Failed to process file");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [applyAnalyzedProjects]
  );

  const handleTryExample = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const file = new File([EXAMPLE_PACKAGE_JSON], "Example project.json", { type: "application/json" });
      applyAnalyzedProjects(await analyzeLocalPackageFile(file));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load example");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [applyAnalyzedProjects]);

  const handleLocalFolderScan = useCallback(async () => {
    setError(null);
    try {
      const directory = await pickLocalFolder();
      const startedAt = performance.now();
      debugLog("HomePage", "local folder scan started");
      setIsLoading(true);
      applyAnalyzedProjects(await scanDirectoryHandle(directory));
      debugLog("HomePage", "local folder scan completed", { durationMs: measureDuration(startedAt) });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      debugWarn("HomePage", "local folder scan failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : "Failed to scan local folder");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [applyAnalyzedProjects]);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--bg)", color: "var(--ink-mid)" }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-2)",
        }}
      >
        <div className="cg-app-header">
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <CgWordmark size={22} />
          </Link>

          {hasWorkspace && projects.length > 0 && (
            <div className="cg-app-search">
              <SearchFilters />
            </div>
          )}

          <div className="cg-app-sync">
          </div>
        </div>
      </header>

      {/* Project detail drawer — opens when a project is selected (Details button or search) */}
      <SummaryPanel />

      {/* Main */}
      <main className="flex-1 relative overflow-y-auto">
        <AddProjectDialog
          key={addDialogMode}
          open={isAddDialogOpen}
          onOpenChange={handleDialogOpenChange}
          onAnalyze={analyzeSource}
          onUpload={handlePackageFileUpload}
          onConnectLocalFolder={handleLocalFolderScan}
          isLoading={isLoading}
          error={isAddDialogOpen ? error : null}
          showFab={hasWorkspace}
          defaultMode={addDialogMode}
        />

        {(!hasWorkspace || projects.length === 0) && !isLoading && !error && (
          <EmptyState
            onOpenDialog={openDialog}
            onLocalFolder={handleLocalFolderScan}
            onTryExample={handleTryExample}
            onImport={handleImport}
            />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center"
               style={{ background: "color-mix(in oklab, var(--bg) 70%, transparent)", backdropFilter: "blur(6px)" }}>
            <Card
              style={{
                padding: 20,
                borderRadius: 2,
                borderColor: "var(--line-2)",
                background: "var(--bg-2)",
              }}
            >
              <div className="flex items-center gap-3">
                <Spinner className="h-5 w-5" />
                <span style={{ fontSize: 14, color: "var(--ink)" }}>Analyzing tech stack…</span>
              </div>
            </Card>
          </div>
        )}

        {error && !isAddDialogOpen && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Card
              className="max-w-md mx-4"
              style={{ borderRadius: 2, borderColor: "color-mix(in oklab, var(--destructive) 40%, var(--line-2))" }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "var(--destructive)" }} />
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--destructive)", marginBottom: 4 }}>
                      Analysis failed
                    </p>
                    <p style={{ fontSize: 14, color: "var(--ink-mid)" }}>{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {hasWorkspace && projects.length > 0 && visibleProjects.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Card className="max-w-md mx-4" style={{ borderRadius: 2, borderColor: "var(--line-2)" }}>
              <CardContent className="pt-6 text-center">
                <p style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                  No matching projects
                </p>
                <p style={{ fontSize: 14, color: "var(--ink-mid)" }}>
                  Try adjusting your filters.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {hasWorkspace && visibleProjects.length > 0 && !isLoading && (
          <UnifiedView projects={visibleProjects} onImport={handleImport} />
        )}
      </main>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────
function EmptyState({
  onOpenDialog,
  onLocalFolder,
  onTryExample,
  onImport,
}: {
  onOpenDialog: (mode: "repo" | "username" | "upload") => void;
  onLocalFolder: () => void;
  onTryExample: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        backgroundImage: `radial-gradient(circle, var(--line) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        backgroundPosition: "0 0",
      }}
    >
      <div style={{ textAlign: "center", width: "100%", maxWidth: 480, margin: "0 24px" }}>
        <p
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            marginBottom: 18,
          }}
        >
          ▎ new scan
        </p>
        <h2
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: 40,
            fontWeight: 500,
            color: "var(--ink)",
            margin: "0 0 14px",
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          Map your{" "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>stack.</span>
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "var(--ink-mid)",
            margin: "0 0 36px",
            lineHeight: 1.55,
            maxWidth: "44ch",
            marginInline: "auto",
          }}
        >
          Point cartograf at any GitHub repo or local folder. It reads your manifest
          files and arranges every library, service, and account around a hub.
        </p>
        <div style={{ display: "grid", gap: 8, textAlign: "left" }}>
          {[
            { icon: LinkIcon,   title: "Repo URL",      desc: "Paste any public GitHub repository URL", action: () => onOpenDialog("repo") },
            { icon: User,       title: "Username",      desc: "Analyze all repos from a GitHub user",   action: () => onOpenDialog("username") },
            { icon: FolderOpen, title: "Local Project", desc: "Scan a folder from this browser",        action: () => void onLocalFolder() },
          ].map(({ icon: Icon, title, desc, action }) => (
            <EmptyCard key={title} Icon={Icon} title={title} desc={desc} action={action} />
          ))}
        </div>

        <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: "6px 18px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={onTryExample}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              color: "var(--accent)", padding: 4,
            }}
          >
            Just curious? See an example map →
          </button>
          <label
            style={{
              cursor: "pointer", fontFamily: "inherit", fontSize: 14,
              color: "var(--ink-soft)", padding: 4,
            }}
          >
            Import a saved map
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({
  Icon,
  title,
  desc,
  action,
}: {
  Icon: React.ComponentType<{ style?: React.CSSProperties }>;
  title: string;
  desc: string;
  action: () => void;
}) {
  return (
    <button
      type="button"
      onClick={action}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        borderRadius: 2,
        padding: "14px 18px",
        textAlign: "left",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        cursor: "pointer",
        transition: "background 0.12s ease, border-color 0.12s ease",
        fontFamily: "inherit",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--line-2)";
        e.currentTarget.style.background = "var(--bg-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--line)";
        e.currentTarget.style.background = "var(--bg-2)";
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 2,
          flexShrink: 0,
          background: "var(--bg-3)",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: 16, height: 16, color: "var(--accent)" }} />
      </div>
      <div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "2px 0 0" }}>
          {desc}
        </p>
      </div>
    </button>
  );
}
