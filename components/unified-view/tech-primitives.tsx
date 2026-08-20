"use client";

import { useEffect, useRef, useState } from "react";
import { type TechCategory, type Environment, type TechUsage } from "@/lib/types";
import { getTechnologyLogo } from "@/lib/technology-logos";
import { categoryIcons } from "@/components/category-icons";
import { AccountSelector } from "@/components/account-selector";
import { UsageTicks } from "@/components/usage-ticks";
import { getDashboardUrl } from "@/lib/service-urls";
import { useAppStore } from "@/lib/store";

// Category hues are functional (one-glance differentiation) — kept saturated
// on purpose. The rest of the system stays cool paper + ink + accent orange.
export const categoryDesign: Record<TechCategory, {
  label: string;
  accent: string;
  soft: string;
  ink: string;
}> = {
  frontend:     { label: "Frontend",     accent: "#06b6d4", soft: "#ecfeff", ink: "#0e7490" },
  backend:      { label: "Backend",      accent: "#3b82f6", soft: "#eff6ff", ink: "#1d4ed8" },
  database:     { label: "Database",     accent: "#10b981", soft: "#ecfdf5", ink: "#065f46" },
  auth:         { label: "Auth",         accent: "#8b5cf6", soft: "#f5f3ff", ink: "#5b21b6" },
  storage:      { label: "Storage",      accent: "#f59e0b", soft: "#fffbeb", ink: "#92400e" },
  payments:     { label: "Payments",     accent: "#f43f5e", soft: "#fff1f2", ink: "#9f1239" },
  ai:           { label: "AI",           accent: "#14b8a6", soft: "#f0fdfa", ink: "#0f766e" },
  email:        { label: "Email",        accent: "#0ea5e9", soft: "#f0f9ff", ink: "#0369a1" },
  analytics:    { label: "Analytics",    accent: "#6366f1", soft: "#eef2ff", ink: "#3730a3" },
  observability:{ label: "Observability",accent: "#a855f7", soft: "#faf5ff", ink: "#6b21a8" },
  cms:          { label: "CMS",          accent: "#d946ef", soft: "#fdf4ff", ink: "#86198f" },
  testing:      { label: "Testing",      accent: "#84cc16", soft: "#f7fee7", ink: "#365314" },
  devops:       { label: "DevOps",       accent: "#64748b", soft: "#f8fafc", ink: "#334155" },
  deployment:   { label: "Deployment",   accent: "#0284c7", soft: "#f0f9ff", ink: "#075985" },
  search:       { label: "Search",       accent: "#eab308", soft: "#fefce8", ink: "#713f12" },
  queue:        { label: "Queue",        accent: "#ec4899", soft: "#fdf2f8", ink: "#831843" },
  cache:        { label: "Cache",        accent: "#22c55e", soft: "#f0fdf4", ink: "#14532d" },
  realtime:     { label: "Realtime",     accent: "#7c3aed", soft: "#f5f3ff", ink: "#4c1d95" },
  validation:   { label: "Validation",   accent: "#fb7185", soft: "#fff1f2", ink: "#9f1239" },
};

export interface DisplayTech {
  id: string;
  name: string;
  cat: TechCategory;
  kind: "service" | "library";
  account: "connected" | "missing";
  accountId?: string;
  version?: string;
  desc?: string;
  environment?: Environment;
  usage?: TechUsage;
}

export type TechDetailFocus = "details" | "account" | "environment" | "note";

export function TechGlyph({ tech, size = 28 }: { tech: DisplayTech; size?: number }) {
  const cat = categoryDesign[tech.cat];
  const logo = getTechnologyLogo(tech.name);
  const Icon = categoryIcons[tech.cat];

  return (
    <span style={{
      width: size, height: size, borderRadius: 2,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: cat.soft,
      border: `1px solid ${cat.accent}40`,
      color: cat.ink, flexShrink: 0,
    }}>
      {logo ? (
        <svg aria-label={`${tech.name} logo`} width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" role="img">
          <path d={logo.path} fill={logo.hex === "ffffff" ? cat.ink : `#${logo.hex}`} />
        </svg>
      ) : (
        <Icon style={{ width: size * 0.55, height: size * 0.55, color: cat.ink }} />
      )}
    </span>
  );
}

export function AccountBadge({ tech, size = "sm" }: { tech: DisplayTech; size?: "sm" | "md" | "lg" }) {
  const cat = categoryDesign[tech.cat];
  const px = size === "lg" ? 28 : size === "md" ? 22 : 18;
  const fontPx = size === "lg" ? 12 : size === "md" ? 10 : 9;

  if (tech.kind === "library") {
    return (
      <span style={{
        fontFamily: "var(--font-mono), monospace", fontSize: fontPx,
        color: "var(--ink-soft)", background: "var(--bg-3)",
        border: "1px solid var(--line)",
        padding: "2px 6px", borderRadius: 2,
        letterSpacing: "0.06em", whiteSpace: "nowrap",
      }}>lib</span>
    );
  }

  const connected = tech.account === "connected";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: px, height: px, borderRadius: "50%",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono), monospace", fontSize: fontPx, fontWeight: 600,
        color: connected ? cat.ink : "var(--ink-soft)",
        background: connected ? cat.soft : "transparent",
        border: connected ? `1.5px solid ${cat.accent}` : "1.5px dashed var(--line-2)",
        position: "relative",
      }}>
        {connected ? "✓" : ""}
        {!connected && (
          <span style={{
            position: "absolute", top: -1, right: -1,
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--warn)", border: "1.5px solid var(--bg-2)",
          }} />
        )}
      </span>
      <span style={{
        fontFamily: "var(--font-mono), monospace", fontSize: fontPx + 1,
        color: connected ? cat.ink : "var(--ink-mid)", whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}>
        {connected ? "Account set" : "No account"}
      </span>
    </span>
  );
}

export function CatDot({ cat, size = 8 }: { cat: TechCategory; size?: number }) {
  const c = categoryDesign[cat];
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      borderRadius: "50%", background: c.accent, flexShrink: 0,
    }} />
  );
}

const ENV_OPTIONS: Environment[] = ["unknown", "dev", "staging", "prod"];

export function TechDetail({
  tech,
  focusTarget = "details",
  focusKey,
}: {
  tech: DisplayTech;
  focusTarget?: TechDetailFocus;
  focusKey?: number;
}) {
  const cat = categoryDesign[tech.cat];
  const environmentRef = useRef<HTMLSelectElement>(null);
  const assignAccountToTech = useAppStore((s) => s.assignAccountToTech);
  const setTechEnvironment = useAppStore((s) => s.setTechEnvironment);
  const accountName = useAppStore((s) =>
    tech.accountId ? s.accounts.find((a) => a.id === tech.accountId)?.name : undefined
  );

  const isService = tech.kind === "service";
  const hasUsage = !!tech.usage && (tech.usage.installed || tech.usage.imported || tech.usage.used);
  const dashboardUrl = isService ? getDashboardUrl(tech.name, accountName) : null;

  useEffect(() => {
    if (!focusKey) return;

    const frame = requestAnimationFrame(() => {
      if (focusTarget === "environment") {
        const select = environmentRef.current;
        select?.focus();

        try {
          (select as (HTMLSelectElement & { showPicker?: () => void }) | null)?.showPicker?.();
        } catch {
          // Some browsers only allow showPicker during the original click gesture.
        }
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [focusKey, focusTarget]);

  return (
    <div style={{
      padding: "10px 12px 12px",
      borderTop: "1px solid var(--line)",
      background: "var(--bg-3)",
      fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.5,
    }}>
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "6px 14px",
        fontFamily: "var(--font-mono), monospace", fontSize: 11, marginBottom: hasUsage ? 8 : 10,
      }}>
        {tech.version && (
          <span><span style={{ color: "var(--ink-soft)" }}>v </span>{tech.version}</span>
        )}
        <span>
          <span style={{ color: "var(--ink-soft)" }}>category </span>
          <span style={{ color: cat.ink }}>{cat.label.toLowerCase()}</span>
        </span>
        <span>
          <span style={{ color: "var(--ink-soft)" }}>type </span>
          {tech.kind}
        </span>
      </div>

      {hasUsage && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase",
            color: "var(--ink-soft)", marginBottom: 5,
          }}>
            Found in your code
          </div>
          <UsageTicks usage={tech.usage} />
        </div>
      )}

      {isService && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <select
            ref={environmentRef}
            value={tech.environment ?? "unknown"}
            onChange={(e) => setTechEnvironment(tech.id, e.target.value as Environment)}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: "var(--font-mono), monospace", fontSize: 11,
              padding: "4px 6px", borderRadius: 2,
              border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink-mid)",
              cursor: "pointer",
            }}
          >
            {ENV_OPTIONS.map((env) => (
              <option key={env} value={env}>env: {env}</option>
            ))}
          </select>
          <AccountSelector
            techInstanceId={tech.id}
            currentAccountId={tech.accountId}
            provider={tech.name}
            onSelect={(accountId) => assignAccountToTech(tech.id, accountId)}
            autoOpenKey={focusTarget === "account" ? focusKey : undefined}
          />
        </div>
      )}

      {dashboardUrl && (
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10,
            fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 500,
          }}
        >
          Open {tech.name} dashboard <span aria-hidden>↗</span>
        </a>
      )}

      <TechNotes
        key={`${tech.id}:${focusTarget === "details" ? focusKey ?? 0 : "controls"}`}
        techId={tech.id}
        notes={tech.desc}
        focusKey={focusTarget === "note" ? focusKey : undefined}
      />
    </div>
  );
}

// Keyed at the call site so switching nodes or returning to Details resets edit state.
function TechNotes({
  techId,
  notes,
  focusKey,
}: {
  techId: string;
  notes?: string;
  focusKey?: number;
}) {
  const updateTechInstance = useAppStore((s) => s.updateTechInstance);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");

  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => editTriggerRef.current?.click());
    return () => cancelAnimationFrame(frame);
  }, [focusKey]);

  function save() {
    updateTechInstance(techId, { notes: draft.trim() || undefined });
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note…"
          style={{
            width: "100%", minHeight: 56, resize: "vertical",
            border: "1px solid var(--line-2)", borderRadius: 2, background: "var(--bg-2)",
            padding: "6px 8px", fontSize: 12, lineHeight: 1.5, color: "var(--ink)",
            fontFamily: "inherit", outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" onClick={() => setEditing(false)} style={noteGhostBtn}>Cancel</button>
          <button type="button" onClick={save} style={notePrimaryBtn}>Save</button>
        </div>
      </div>
    );
  }

  return notes ? (
    <button
      type="button"
      ref={editTriggerRef}
      onClick={(e) => { e.stopPropagation(); setDraft(notes); setEditing(true); }}
      title="Edit note"
      style={{
        display: "block", textAlign: "left", width: "100%", marginTop: 10, cursor: "pointer",
        border: "1px solid var(--line)", borderRadius: 2, background: "var(--bg-2)",
        padding: "6px 8px", fontSize: 12, lineHeight: 1.5, color: "var(--ink-mid)",
        fontFamily: "inherit", whiteSpace: "pre-wrap",
      }}
    >
      {notes}
    </button>
  ) : (
    <button
      type="button"
      ref={editTriggerRef}
      onClick={(e) => { e.stopPropagation(); setDraft(""); setEditing(true); }}
      style={{
        marginTop: 10, cursor: "pointer", background: "none",
        border: "none", padding: 0, fontFamily: "inherit",
        fontSize: 12, color: "var(--ink-soft)",
      }}
    >
      + Add a note
    </button>
  );
}

const noteGhostBtn: React.CSSProperties = {
  cursor: "pointer", border: "1px solid var(--line)", borderRadius: 2,
  background: "var(--bg-2)", padding: "4px 10px", fontSize: 11, color: "var(--ink-mid)", fontFamily: "inherit",
};
const notePrimaryBtn: React.CSSProperties = {
  cursor: "pointer", border: "1px solid var(--accent)", borderRadius: 2,
  background: "var(--accent)", padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--bg)", fontFamily: "inherit",
};
