"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { type Project, type TechInstance, getTechLayer } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { type DisplayTech } from "./tech-primitives";
import { MapView, type ProjectMapData } from "./map-view";
import { ListView } from "./list-view";
import { AccountsView } from "./accounts-view";
import { useRenderDiagnostics } from "@/hooks/use-debug-diagnostics";

// ── Data transform ────────────────────────────────────────────────────────────

function toDisplayTech(instance: TechInstance): DisplayTech {
  const layer = instance.layer ?? getTechLayer(instance.technologyName, instance.category);
  return {
    id: instance.id,
    name: instance.technologyName,
    cat: instance.category,
    kind: layer,
    account: layer === "service" ? (instance.accountId ? "connected" : "missing") : "missing",
    accountId: instance.accountId,
    version: instance.version,
    desc: instance.notes,
    environment: instance.environment,
    usage: instance.usage,
  };
}

// ── Header stats ──────────────────────────────────────────────────────────────

function HeaderStat({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <span style={{
      padding: "4px 9px",
      border: `1px solid ${warn ? "color-mix(in oklab, var(--warn) 40%, var(--line))" : "var(--line)"}`,
      borderRadius: 2,
      background: warn ? "color-mix(in oklab, var(--warn) 8%, var(--bg-2))" : "var(--bg-2)",
      color: warn ? "color-mix(in oklab, var(--warn) 70%, var(--ink))" : "var(--ink-mid)",
      fontSize: 11,
      fontFamily: "var(--font-mono), monospace",
      letterSpacing: "0.02em",
    }}>
      <span style={{ fontWeight: 600, color: warn ? "color-mix(in oklab, var(--warn) 80%, var(--ink))" : "var(--ink)" }}>{value}</span>
      {" "}{label}
    </span>
  );
}

// ── View toggle ───────────────────────────────────────────────────────────────

function ToggleBtn({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: "map" | "list" | "accounts";
  children: React.ReactNode;
}) {
  const stroke = active ? "var(--ink)" : "var(--ink-soft)";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 2, border: "none",
        background: active ? "var(--bg-2)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        fontFamily: "inherit", fontSize: 12, fontWeight: 500,
        cursor: "pointer", transition: "background 0.12s ease, color 0.12s ease",
      }}
    >
      {icon === "map" ? (
        <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" stroke={stroke} strokeWidth="1.4" />
          <circle cx="8" cy="8" r="6" stroke={stroke} strokeWidth="1.4" />
          <line x1="8" y1="2" x2="8" y2="6" stroke={stroke} strokeWidth="1.4" />
          <line x1="8" y1="10" x2="8" y2="14" stroke={stroke} strokeWidth="1.4" />
        </svg>
      ) : icon === "list" ? (
        <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
          <line x1="3" y1="4" x2="13" y2="4" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="3" y1="8" x2="13" y2="8" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="3" y1="12" x2="13" y2="12" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5" r="2.5" stroke={stroke} strokeWidth="1.4" />
          <path d="M3.5 13c0-2.2 2-3.6 4.5-3.6s4.5 1.4 4.5 3.6" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ── Project tab strip ─────────────────────────────────────────────────────────

function ProjectTabs({
  projects,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onOpenDetails,
}: {
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: () => void;
  onOpenDetails: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: 4, flexWrap: "wrap",
      marginBottom: 14,
    }}>
      {projects.map((p) => {
        const active = p.id === activeId;
        return (
          <div
            key={p.id}
            style={{ display: "flex", alignItems: "center", gap: 0 }}
          >
            <button
              onClick={() => active ? onRename() : onSelect(p.id)}
              title={active ? "Click to rename" : undefined}
              style={{
                padding: "5px 8px 5px 12px",
                borderRadius: 2,
                border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                borderRight: active ? "none" : undefined,
                background: active ? "var(--ink)" : "var(--bg-2)",
                color: active ? "var(--bg)" : "var(--ink-mid)",
                fontSize: 12, fontWeight: 500,
                cursor: active ? "text" : "pointer",
                transition: "background 0.12s, color 0.12s, border-color 0.12s",
                fontFamily: "inherit",
              }}
            >
              {p.label ?? p.displayName}
            </button>
            {active && (
              <button
                onClick={() => onOpenDetails(p.id)}
                title="Project details"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "0 7px", height: 26,
                  borderRadius: 2,
                  border: "1px solid var(--ink)", borderLeft: "none", borderRight: "none",
                  background: "var(--ink)",
                  color: "color-mix(in oklab, var(--bg) 60%, transparent)",
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "color 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "color-mix(in oklab, var(--bg) 60%, transparent)")}
              >
                <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <line x1="10" y1="3" x2="10" y2="13" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            )}
            {active && (
              <button
                onClick={() => onDelete(p.id)}
                title="Remove project"
                style={{
                  padding: "5px 8px",
                  borderRadius: 2,
                  border: "1px solid var(--ink)", borderLeft: "none",
                  background: "var(--ink)",
                  color: "color-mix(in oklab, var(--bg) 60%, transparent)",
                  fontSize: 11, lineHeight: 1,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "color 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "color-mix(in oklab, var(--bg) 60%, transparent)")}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Layer toggle chip ─────────────────────────────────────────────────────────

function LayerChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px", borderRadius: 999,
        border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
        background: active ? "var(--ink)" : "var(--bg-2)",
        color: active ? "var(--bg)" : "var(--ink-soft)",
        fontSize: 11, fontWeight: 500, fontFamily: "inherit",
        cursor: "pointer", transition: "background 0.12s, color 0.12s, border-color 0.12s",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}
    >
      {active && <span style={{ opacity: 0.7, fontSize: 9 }}>●</span>}
      {label}
    </button>
  );
}

// ── Main UnifiedView ──────────────────────────────────────────────────────────

export function UnifiedView({ projects, onImport }: { projects: Project[]; onImport?: (file: File) => void }) {
  const [view, setView] = useState<"map" | "list" | "accounts">("map");
  const [openTechId, setOpenTechId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // First-run nudge toward setting up accounts (dismissible, persisted).
  const [hintDismissed, setHintDismissed] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHintDismissed(localStorage.getItem("cartograf:accounts-hint-dismissed") === "1");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);
  function dismissHint() {
    setHintDismissed(true);
    localStorage.setItem("cartograf:accounts-hint-dismissed", "1");
  }

  const layerVisibility = useAppStore((s) => s.layerVisibility);
  const setLayerVisibility = useAppStore((s) => s.setLayerVisibility);
  const updateProject = useAppStore((s) => s.updateProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const accounts = useAppStore((s) => s.accounts);
  const tags = useAppStore((s) => s.tags);

  function handleExport() {
    const data = {
      exportedAt: new Date().toISOString(),
      generatedBy: "cartograf",
      accounts,
      tags,
      projects: projects.map((p) => ({
        id: p.id,
        displayName: p.label ?? p.displayName,
        url: p.url,
        githubOwner: p.githubOwner,
        githubRepo: p.githubRepo,
        tags: p.tags,
        notes: p.notes,
        techInstances: p.techInstances.map((ti) => ({
          technologyName: ti.technologyName,
          category: ti.category,
          layer: ti.layer,
          version: ti.version,
          environment: ti.environment,
          accountId: ti.accountId,
          notes: ti.notes,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cartograf-stack-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  function startEditName() {
    setNameInput(active?.label ?? active?.displayName ?? "");
    setEditingName(true);
  }

  function commitName() {
    if (!active) return;
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== active.displayName) {
      updateProject(active.id, { label: trimmed });
    } else if (!trimmed) {
      updateProject(active.id, { label: undefined });
    }
    setEditingName(false);
  }

  const handleProjectChange = (id: string | null) => {
    setSelectedProject(null);
    setActiveProjectId(id);
    setOpenTechId(null);
  };

  function handleDelete(projectId: string) {
    if (!window.confirm("Remove this project from cartograf?")) return;
    deleteProject(projectId);
  }

  const selectedProjectExists = selectedProjectId
    ? projects.some((project) => project.id === selectedProjectId)
    : false;
  const effectiveActiveProjectId = selectedProjectExists ? selectedProjectId : activeProjectId;
  const active = projects.find((p) => p.id === (effectiveActiveProjectId ?? projects[0]?.id)) ?? projects[0];

  // Memoize so child components don't get new array references on every render
  const allTechs = useMemo(
    () => (active ? active.techInstances.map(toDisplayTech) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active?.id, active?.techInstances]
  );

  const techs = useMemo(
    () => allTechs.filter((t) =>
      (t.kind === "service" && layerVisibility.services) ||
      (t.kind === "library" && layerVisibility.libraries)
    ),
    [allTechs, layerVisibility.services, layerVisibility.libraries]
  );

  const workspaceTechs = useMemo(
    () => projects.flatMap((project) =>
      project.techInstances
        .map((instance) => ({
          ...toDisplayTech(instance),
          projectName: project.label ?? project.displayName,
        }))
        .filter((tech) =>
          (tech.kind === "service" && layerVisibility.services) ||
          (tech.kind === "library" && layerVisibility.libraries)
        )
    ),
    [projects, layerVisibility.services, layerVisibility.libraries]
  );

  const projectMaps = useMemo<ProjectMapData[]>(
    () => projects.map((project) => ({
      id: project.id,
      name: project.label ?? project.displayName,
      githubOwner: project.githubOwner,
      icon: project.icon,
      techs: project.techInstances
        .map(toDisplayTech)
        .filter((t) =>
          (t.kind === "service" && layerVisibility.services) ||
          (t.kind === "library" && layerVisibility.libraries)
        ),
    })),
    [projects, layerVisibility.services, layerVisibility.libraries]
  );

  useRenderDiagnostics("UnifiedView", () => ({
    view,
    projectCount: projects.length,
    activeProjectId: active?.id,
    activeTechCount: active?.techInstances.length ?? 0,
    displayTechCount: view === "list" ? workspaceTechs.length : techs.length,
    openTechId,
  }));

  if (!active) return null;

  const viewTechs = view === "list" ? workspaceTechs : techs;
  const services = viewTechs.filter((t) => t.kind === "service");
  const libraries = viewTechs.filter((t) => t.kind === "library");
  const missingCount = services.filter((s) => s.account === "missing").length;

  // Cross-project totals for the Accounts view header.
  const crossServiceInstances = projects.flatMap((p) =>
    p.techInstances.filter((ti) => (ti.layer ?? getTechLayer(ti.technologyName, ti.category)) === "service")
  );
  const crossMissingCount = crossServiceInstances.filter((ti) => !ti.accountId).length;
  const isAccounts = view === "accounts";
  const isList = view === "list";

  function showWorkspaceView(nextView: "map" | "list") {
    handleProjectChange(null);
    setView(nextView);
  }

  return (
    <div style={{
      width: "100%",
      background: "var(--bg)",
      fontFamily: "var(--font-display), 'Inter', system-ui, sans-serif",
      color: "var(--ink)",
    }}>
      {/* Sticky navigation bar */}
      <div className="uv-topbar" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}>
        {/* Project tabs focus an individual map; List and Accounts remain workspace views. */}
        {isAccounts || isList ? null : editingName ? (
          <div style={{ paddingBottom: 14 }}>
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
              style={{
                fontSize: 12, fontWeight: 500, border: "none", outline: "none",
                borderBottom: "1.5px solid var(--accent)", background: "transparent",
                padding: "5px 12px", borderRadius: 0,
                fontFamily: "inherit", color: "var(--ink)",
                minWidth: 120, width: Math.max(120, nameInput.length * 8),
              }}
            />
          </div>
        ) : (
          <ProjectTabs
            projects={projects}
            activeId={effectiveActiveProjectId}
            onSelect={handleProjectChange}
            onDelete={handleDelete}
            onRename={startEditName}
            onOpenDetails={setSelectedProject}
          />
        )}

        {/* Controls bar */}
        <div className="uv-controls-bar" style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 16,
          paddingBottom: 14,
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {isAccounts ? (
              <>
                <HeaderStat value={crossServiceInstances.length} label="services" />
                <HeaderStat value={projects.length} label="projects" />
                {crossMissingCount > 0 && <HeaderStat value={crossMissingCount} label="to set up" warn />}
              </>
            ) : (
              <>
                <HeaderStat value={techs.length} label="techs" />
                <HeaderStat value={services.length} label="services" />
                <HeaderStat value={libraries.length} label="libs" />
                {missingCount > 0 && <HeaderStat value={missingCount} label="to set up" warn />}
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {!isAccounts && (
              <div style={{ display: "flex", gap: 4 }}>
                <LayerChip label="Services" active={layerVisibility.services} onClick={() => setLayerVisibility({ services: !layerVisibility.services })} />
                <LayerChip label="Libraries" active={layerVisibility.libraries} onClick={() => setLayerVisibility({ libraries: !layerVisibility.libraries })} />
                <LayerChip label="Versions" active={layerVisibility.versions} onClick={() => setLayerVisibility({ versions: !layerVisibility.versions })} />
              </div>
            )}
            {onImport && (
              <label
                title="Import a saved stack JSON"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 12px", borderRadius: 2,
                  border: "1px solid var(--line)", background: "var(--bg-2)",
                  color: "var(--ink-mid)", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 500,
                }}
              >
                <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 10V2m0 8L5 7m3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 8 6)" />
                  <path d="M3 12v1.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Import
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
            )}
            <button
              type="button"
              onClick={handleExport}
              title="Export stack as JSON"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 2,
                border: "1px solid var(--line)", background: "var(--bg-2)",
                color: "var(--ink-mid)", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 500,
              }}
            >
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 2v8m0 0 3-3m-3 3L5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 12v1.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Export
            </button>
            <div style={{
              display: "inline-flex", padding: 3,
              background: "var(--bg-3)", border: "1px solid var(--line)",
              borderRadius: 2, gap: 2,
            }}>
              <ToggleBtn active={view === "map"} onClick={() => showWorkspaceView("map")} icon="map">Map</ToggleBtn>
              <ToggleBtn active={view === "list"} onClick={() => showWorkspaceView("list")} icon="list">List</ToggleBtn>
              <ToggleBtn active={view === "accounts"} onClick={() => setView("accounts")} icon="accounts">All accounts</ToggleBtn>
            </div>
          </div>
        </div>
      </div>

      {/* First-run nudge: unwired services across projects */}
      {!isAccounts && crossMissingCount > 0 && !hintDismissed && (
        <div className="uv-content" style={{ paddingTop: 12, paddingBottom: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "10px 14px", borderRadius: 3,
            border: "1px solid color-mix(in oklab, var(--warn) 40%, var(--line))",
            background: "color-mix(in oklab, var(--warn) 8%, var(--bg-2))",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warn)", flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 200, fontSize: 13, color: "var(--ink-mid)" }}>
              <strong style={{ color: "var(--ink)" }}>{crossMissingCount} service{crossMissingCount === 1 ? "" : "s"}</strong>{" "}
              across your projects {crossMissingCount === 1 ? "has" : "have"} no account set yet.
            </span>
            <button
              type="button"
              onClick={() => setView("accounts")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 2, cursor: "pointer",
                border: "1px solid var(--accent)", background: "var(--accent)",
                color: "var(--bg)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              Review in All accounts <span aria-hidden>→</span>
            </button>
            <button
              type="button"
              onClick={dismissHint}
              title="Dismiss"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: 2, cursor: "pointer",
                border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink-soft)",
                fontFamily: "inherit", fontSize: 14, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="uv-content">
      <div>
        {view === "map" ? (
          <MapView
            projects={projectMaps}
            activeProjectId={effectiveActiveProjectId}
            onProjectSelect={handleProjectChange}
            openId={openTechId}
            setOpenId={setOpenTechId}
          />
        ) : view === "list" ? (
          <ListView
            techs={workspaceTechs}
            openId={openTechId}
            setOpenId={setOpenTechId}
            showVersions={layerVisibility.versions}
          />
        ) : (
          <AccountsView projects={projects} />
        )}
      </div>
      </div>
    </div>
  );
}
