"use client";

import { type TechCategory, techCategories } from "@/lib/types";
import { useRenderDiagnostics } from "@/hooks/use-debug-diagnostics";
import { useAppStore } from "@/lib/store";
import { getDashboardUrl } from "@/lib/service-urls";
import {
  categoryDesign, TechGlyph, AccountBadge, CatDot, TechDetail,
  type DisplayTech,
} from "./tech-primitives";
import { ProjectAnnotations } from "./project-annotations";

function groupByCategory(techs: DisplayTech[]) {
  const groups = new Map<TechCategory, DisplayTech[]>();
  techs.forEach((t) => {
    const arr = groups.get(t.cat) ?? [];
    arr.push(t);
    groups.set(t.cat, arr);
  });
  return techCategories
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ cat, items: groups.get(cat)! }));
}

// ── Column wrapper ───────────────────────────────────────────────────────────

function Column({
  title, subtitle, count, rightMeta, accentColor, children,
}: {
  title: string;
  subtitle: string;
  count: number;
  rightMeta: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--line)",
      borderRadius: 2, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-3)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: 14, fontWeight: 600, color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}>{title}</span>
          <span style={{
            fontSize: 11, fontFamily: "var(--font-mono), monospace",
            padding: "2px 7px", borderRadius: 2,
            background: "var(--bg-2)", color: "var(--ink-mid)",
            border: "1px solid var(--line)",
          }}>{count}</span>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{subtitle}</span>
        </div>
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono), monospace",
          color: accentColor, letterSpacing: "0.04em",
        }}>
          {rightMeta}
        </span>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

// ── Category block ────────────────────────────────────────────────────────────

function CategoryBlock({
  cat, items, variant, openId, setOpenId, showVersions = true,
}: {
  cat: TechCategory;
  items: DisplayTech[];
  variant: "service" | "library";
  openId: string | null;
  setOpenId: (id: string | null) => void;
  showVersions?: boolean;
}) {
  const c = categoryDesign[cat];
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 10, fontFamily: "var(--font-mono), monospace",
        color: c.ink, letterSpacing: "0.14em", textTransform: "uppercase",
        marginBottom: 10,
      }}>
        <CatDot cat={cat} />
        <span>{c.label}</span>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span style={{ color: "var(--ink-soft)" }}>{items.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((t) =>
          variant === "service" ? (
            <ServiceRow key={t.id} tech={t} open={openId === t.id} onClick={() => setOpenId(openId === t.id ? null : t.id)} />
          ) : (
            <LibraryRow key={t.id} tech={t} open={openId === t.id} onClick={() => setOpenId(openId === t.id ? null : t.id)} showVersions={showVersions} />
          )
        )}
      </div>
    </div>
  );
}

// ── Service row ───────────────────────────────────────────────────────────────

function ServiceRow({ tech, open, onClick }: { tech: DisplayTech; open: boolean; onClick: () => void }) {
  const cat = categoryDesign[tech.cat];
  const missing = tech.account === "missing";

  const accountName = useAppStore((s) =>
    tech.accountId ? s.accounts.find((a) => a.id === tech.accountId)?.name : undefined
  );
  const dashboardUrl = getDashboardUrl(tech.name, accountName);

  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${
          open
            ? cat.accent
            : missing
            ? "color-mix(in oklab, var(--warn) 40%, var(--line))"
            : "var(--line)"
        }`,
        borderRadius: 2,
        background: missing
          ? "color-mix(in oklab, var(--warn) 6%, var(--bg-2))"
          : "var(--bg-2)",
        cursor: "pointer", overflow: "hidden",
        transition: "border-color 0.18s ease, background 0.18s ease",
      }}
    >
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <TechGlyph tech={tech} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{
              fontFamily: "var(--font-display), sans-serif",
              fontSize: 13, fontWeight: 600, color: "var(--ink)",
            }}>{tech.name}</span>
            {tech.desc && (
              <span style={{
                fontSize: 11, color: "var(--ink-soft)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {tech.desc}
              </span>
            )}
          </div>
          <div style={{ marginTop: 6 }}>
            <AccountBadge tech={tech} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {missing && !open && (
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: "color-mix(in oklab, var(--warn) 70%, var(--ink))",
              padding: "5px 9px",
              border: "1px solid color-mix(in oklab, var(--warn) 40%, var(--line))",
              borderRadius: 2,
              background: "var(--bg-2)",
              whiteSpace: "nowrap",
            }}>
              Set account →
            </span>
          )}
          {dashboardUrl && (
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={accountName ? `Open dashboard · ${accountName}` : "Open dashboard"}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 2,
                border: "1px solid var(--line)",
                background: "var(--bg-2)",
                color: "var(--ink-mid)",
                textDecoration: "none",
                fontSize: 13,
                transition: "border-color 0.15s, color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line-2)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)";
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-mid)";
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-2)";
              }}
            >
              ↗
            </a>
          )}
        </div>
      </div>
      {open && <TechDetail tech={tech} />}
    </div>
  );
}

// ── Library row ───────────────────────────────────────────────────────────────

function LibraryRow({ tech, open, onClick, showVersions }: { tech: DisplayTech; open: boolean; onClick: () => void; showVersions: boolean }) {
  const cat = categoryDesign[tech.cat];
  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${open ? cat.accent : "var(--line)"}`,
        borderRadius: 2, background: "var(--bg-2)",
        cursor: "pointer", overflow: "hidden",
        transition: "border-color 0.18s ease, background 0.18s ease",
      }}
    >
      <div style={{ padding: "8px 11px", display: "flex", alignItems: "center", gap: 10 }}>
        <TechGlyph tech={tech} size={24} />
        <span style={{
          fontFamily: "var(--font-display), sans-serif",
          fontSize: 12.5, fontWeight: 600, color: "var(--ink)", flex: 1,
        }}>{tech.name}</span>
        {showVersions && tech.version && (
          <span style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10.5, color: "var(--ink-soft)",
          }}>
            {tech.version}
          </span>
        )}
      </div>
      {open && <TechDetail tech={tech} />}
    </div>
  );
}

// ── Setup progress strip ──────────────────────────────────────────────────────

function SetupProgress({ services }: { services: DisplayTech[] }) {
  const missing = services.filter((s) => s.account === "missing").length;
  const connected = services.length - missing;

  return (
    <div style={{
      marginBottom: 14, padding: "10px 14px",
      background: "var(--bg-2)", border: "1px solid var(--line)",
      borderRadius: 2,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{
        fontSize: 10, fontFamily: "var(--font-mono), monospace",
        color: "var(--ink-soft)",
        letterSpacing: "0.16em", textTransform: "uppercase" as const,
      }}>Setup</span>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: services.length }).map((_, i) => (
          <span key={i} style={{
            width: 22, height: 6, borderRadius: 0,
            background: i < connected ? "var(--signal)" : "var(--line)",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 12, fontWeight: 600, color: "var(--ink)",
        fontFamily: "var(--font-display), 'Inter', system-ui, sans-serif",
      }}>
        {connected} of {services.length} accounts set
      </span>
      {missing > 0 && (
        <span style={{
          marginLeft: "auto", fontSize: 11,
          fontFamily: "var(--font-mono), monospace",
          color: "color-mix(in oklab, var(--warn) 70%, var(--ink))",
        }}>
          {missing} remaining
        </span>
      )}
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

export function ListView({
  techs,
  openId,
  setOpenId,
  showVersions = true,
  projectId,
}: {
  techs: DisplayTech[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  showVersions?: boolean;
  projectId?: string;
}) {
  const services = techs.filter((t) => t.kind === "service");
  const libraries = techs.filter((t) => t.kind === "library");
  const missing = services.filter((s) => s.account === "missing").length;

  useRenderDiagnostics("ListView", () => ({
    techCount: techs.length,
    serviceCount: services.length,
    libraryCount: libraries.length,
    missingCount: missing,
    openId,
  }));

  return (
    <div>
      {projectId && <ProjectAnnotations projectId={projectId} />}
      {services.length > 0 && <SetupProgress services={services} />}
      <div className="lv-columns">
        {/* Services column */}
        <Column
          title="Services"
          subtitle="Track which account you use"
          count={services.length}
          accentColor={missing > 0 ? "var(--warn)" : "var(--signal)"}
          rightMeta={missing > 0 ? `${missing} unassigned` : "all assigned"}
        >
          {groupByCategory(services).map(({ cat, items }) => (
            <CategoryBlock
              key={cat} cat={cat} items={items} variant="service"
              openId={openId} setOpenId={setOpenId}
            />
          ))}
          {services.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", padding: 16 }}>
              No services detected
            </div>
          )}
        </Column>

        {/* Libraries column */}
        <Column
          title="Libraries"
          subtitle="Bundled in package.json"
          count={libraries.length}
          accentColor="var(--ink-soft)"
          rightMeta="no setup needed"
        >
          {groupByCategory(libraries).map(({ cat, items }) => (
            <CategoryBlock
              key={cat} cat={cat} items={items} variant="library"
              openId={openId} setOpenId={setOpenId} showVersions={showVersions}
            />
          ))}
          {libraries.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", padding: 16 }}>
              No libraries detected
            </div>
          )}
        </Column>
      </div>
    </div>
  );
}
