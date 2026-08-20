"use client";

import { useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getTechLayer, type Account, type Project, type TechInstance } from "@/lib/types";
import { categoryDesign, CatDot, TechGlyph, type DisplayTech } from "./tech-primitives";
import { AccountSelector } from "@/components/account-selector";
import { Pencil, Trash2 } from "lucide-react";

// ── The cross-project answer: every account you have, everywhere it's used,
//    and every service still missing one — across all repos on the canvas. ──

interface Row {
  project: Project;
  ti: TechInstance;
}

function isService(ti: TechInstance) {
  return (ti.layer ?? getTechLayer(ti.technologyName, ti.category)) === "service";
}

function toDisplayTech(ti: TechInstance): DisplayTech {
  return {
    id: ti.id,
    name: ti.technologyName,
    cat: ti.category,
    kind: "service",
    account: ti.accountId ? "connected" : "missing",
    accountId: ti.accountId,
    version: ti.version,
  };
}

export function AccountsView({ projects }: { projects: Project[] }) {
  const accounts = useAppStore((s) => s.accounts);
  const assignAccountToTech = useAppStore((s) => s.assignAccountToTech);
  const assignAccountToInstances = useAppStore((s) => s.assignAccountToInstances);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const updateAccount = useAppStore((s) => s.updateAccount);

  const serviceRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const project of projects) {
      for (const ti of project.techInstances) {
        if (isService(ti)) rows.push({ project, ti });
      }
    }
    return rows;
  }, [projects]);

  const missingRows = serviceRows.filter((r) => !r.ti.accountId);

  // Group the unwired services by project for actionable triage.
  const missingByProject = useMemo(() => {
    const map = new Map<string, { project: Project; rows: Row[] }>();
    for (const row of missingRows) {
      const entry = map.get(row.project.id) ?? { project: row.project, rows: [] };
      entry.rows.push(row);
      map.set(row.project.id, entry);
    }
    return [...map.values()];
  }, [missingRows]);

  // Providers unassigned in more than one place — worth a one-shot bulk setup.
  const bulkByProvider = useMemo(() => {
    const map = new Map<string, { provider: string; rows: Row[] }>();
    for (const row of missingRows) {
      const key = row.ti.technologyName.toLowerCase();
      const entry = map.get(key) ?? { provider: row.ti.technologyName, rows: [] };
      entry.rows.push(row);
      map.set(key, entry);
    }
    return [...map.values()].filter((e) => e.rows.length >= 2);
  }, [missingRows]);

  // Which project/services use each account — the reuse story.
  const usageByAccount = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of serviceRows) {
      if (!row.ti.accountId) continue;
      const list = map.get(row.ti.accountId) ?? [];
      list.push(row);
      map.set(row.ti.accountId, list);
    }
    return map;
  }, [serviceRows]);

  function handleDeleteAccount(id: string, name: string, usageCount: number) {
    const suffix = usageCount > 0 ? ` It's used by ${usageCount} service${usageCount === 1 ? "" : "s"}.` : "";
    if (window.confirm(`Remove the account "${name}"?${suffix}`)) deleteAccount(id);
  }

  return (
    <div style={{ padding: "8px 0 64px", maxWidth: 1120, margin: "0 auto" }}>
      {/* Cross-project header stats */}
      <div style={statBarStyle}>
        <Stat value={accounts.length} label="accounts" />
        <Stat value={serviceRows.length} label="services" />
        <Stat value={projects.length} label="projects" />
        {missingRows.length > 0 && <Stat value={missingRows.length} label="need an account" warn />}
      </div>

      {/* ── Needs an account ── */}
      <section style={{ marginTop: 28 }}>
        <SectionHeading
          title="Needs an account"
          count={missingRows.length}
          hint="Services detected across your repos with no account set yet."
        />
        {missingRows.length === 0 ? (
          <EmptyNote>Every service across all your projects has an account set. 🎉</EmptyNote>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
            {bulkByProvider.length > 0 && (
              <div>
                <div style={bulkHeadingStyle}>Set up by provider</div>
                <div style={{ border: "1px solid var(--line)", borderRadius: 3, overflow: "hidden" }}>
                  {bulkByProvider.map(({ provider, rows }, i) => {
                    const projectCount = new Set(rows.map((r) => r.project.id)).size;
                    return (
                      <div key={provider} style={rowStyle(i === 0)}>
                        <TechGlyph tech={toDisplayTech(rows[0].ti)} size={26} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{provider}</div>
                          <div style={catLineStyle}>
                            <CatDot cat={rows[0].ti.category} size={7} />
                            {rows.length} services{projectCount > 1 ? ` across ${projectCount} projects` : ""} need an account
                          </div>
                        </div>
                        <AccountSelector
                          techInstanceId={rows[0].ti.id}
                          provider={provider}
                          onSelect={(accountId) => {
                            if (accountId) assignAccountToInstances(rows.map((r) => r.ti.id), accountId);
                          }}
                          trigger={
                            <button type="button" style={setAccountCtaStyle}>
                              Set all {rows.length} <span aria-hidden>→</span>
                            </button>
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {missingByProject.map(({ project, rows }) => (
              <div key={project.id}>
                <div style={projectLabelStyle}>
                  {project.label ?? project.displayName}
                  <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>
                    {" · "}{rows.length} to set up
                  </span>
                </div>
                <div style={{ border: "1px solid var(--line)", borderRadius: 3, overflow: "hidden" }}>
                  {rows.map(({ ti }, i) => (
                    <div key={ti.id} style={rowStyle(i === 0)}>
                      <TechGlyph tech={toDisplayTech(ti)} size={26} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                          {ti.technologyName}
                        </div>
                        <div style={catLineStyle}>
                          <CatDot cat={ti.category} size={7} />
                          {categoryDesign[ti.category].label}
                        </div>
                      </div>
                      <AccountSelector
                        techInstanceId={ti.id}
                        currentAccountId={ti.accountId}
                        provider={ti.technologyName}
                        onSelect={(accountId) => assignAccountToTech(ti.id, accountId)}
                        trigger={
                          <button type="button" style={setAccountCtaStyle}>
                            Set account <span aria-hidden>→</span>
                          </button>
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Your accounts ── */}
      <section style={{ marginTop: 40 }}>
        <SectionHeading
          title="Your accounts"
          count={accounts.length}
          hint="Labelled once, reusable across every project."
        />
        {accounts.length === 0 ? (
          <EmptyNote>
            No accounts yet. Assign one to a service above and it becomes reusable everywhere.
          </EmptyNote>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {accounts.map((account) => {
              const applicable = missingRows.filter(
                (r) => r.ti.technologyName.toLowerCase() === account.provider.toLowerCase()
              );
              return (
                <AccountCard
                  key={account.id}
                  account={account}
                  usage={usageByAccount.get(account.id) ?? []}
                  applicableCount={applicable.length}
                  onApplyToAll={() => assignAccountToInstances(applicable.map((r) => r.ti.id), account.id)}
                  onRename={(label) => updateAccount(account.id, { label: label || undefined })}
                  onDelete={() =>
                    handleDeleteAccount(account.id, account.label || account.name, (usageByAccount.get(account.id) ?? []).length)
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Account card with inline rename ──

function AccountCard({
  account,
  usage,
  applicableCount,
  onApplyToAll,
  onRename,
  onDelete,
}: {
  account: Account;
  usage: Row[];
  applicableCount: number;
  onApplyToAll: () => void;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(account.label || account.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const projectsUsing = new Set(usage.map((u) => u.project.id));

  function startEditing() {
    setValue(account.label || account.name);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== (account.label || account.name)) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div style={accountCardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              style={renameInputStyle}
            />
          ) : (
            <button type="button" onClick={startEditing} title="Rename account" style={nameButtonStyle}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {account.label || account.name}
              </span>
              <Pencil size={12} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
            </button>
          )}
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-mono), monospace" }}>{account.provider}</span>
            {account.label && account.name ? ` · ${account.name}` : ""}
          </div>
        </div>
        <button type="button" title="Remove account" onClick={onDelete} style={deleteBtnStyle}>
          <Trash2 size={14} />
        </button>
      </div>

      {usage.length === 0 ? (
        <div style={unusedTagStyle}>Not used yet</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", margin: "12px 0 6px", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.04em" }}>
            USED IN {projectsUsing.size} PROJECT{projectsUsing.size === 1 ? "" : "S"} · {usage.length} SERVICE{usage.length === 1 ? "" : "S"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {usage.map(({ project, ti }) => (
              <span key={ti.id} style={usageChipStyle}>
                <CatDot cat={ti.category} size={6} />
                {ti.technologyName}
                <span style={{ color: "var(--ink-soft)" }}>· {project.label ?? project.displayName}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {applicableCount > 0 && (
        <button type="button" onClick={onApplyToAll} style={applyAllStyle}>
          Apply to {applicableCount} unassigned {account.provider} service{applicableCount === 1 ? "" : "s"} <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}

// ── bits ──

function Stat({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <span
      style={{
        padding: "4px 9px",
        border: `1px solid ${warn ? "color-mix(in oklab, var(--warn) 40%, var(--line))" : "var(--line)"}`,
        borderRadius: 2,
        background: warn ? "color-mix(in oklab, var(--warn) 8%, var(--bg-2))" : "var(--bg-2)",
        color: warn ? "color-mix(in oklab, var(--warn) 70%, var(--ink))" : "var(--ink-mid)",
        fontSize: 11,
        fontFamily: "var(--font-mono), monospace",
        letterSpacing: "0.02em",
      }}
    >
      <span style={{ fontWeight: 600, color: warn ? "color-mix(in oklab, var(--warn) 80%, var(--ink))" : "var(--ink)" }}>{value}</span>{" "}
      {label}
    </span>
  );
}

function SectionHeading({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, color: "var(--ink-soft)" }}>{count}</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>{hint}</p>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginTop: 14, fontSize: 14, color: "var(--ink-mid)", border: "1px dashed var(--line-2)", borderRadius: 3, padding: "16px 18px", background: "var(--bg-2)" }}>
      {children}
    </p>
  );
}

const statBarStyle: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const projectLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 };
const bulkHeadingStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: "var(--font-mono), monospace", letterSpacing: "0.12em",
  textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8,
};
const catLineStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)", marginTop: 2 };
const accountCardStyle: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 3, background: "var(--bg-2)", padding: "14px 16px" };
const usageChipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 12, color: "var(--ink-mid)", background: "var(--bg-3)",
  border: "1px solid var(--line)", borderRadius: 2, padding: "3px 8px",
};
const unusedTagStyle: React.CSSProperties = {
  marginTop: 12, fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic",
};
const applyAllStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
  padding: "6px 10px", borderRadius: 2, cursor: "pointer",
  border: "1px solid var(--accent)",
  background: "color-mix(in oklab, var(--accent) 8%, var(--bg-2))",
  color: "var(--accent)", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
  textAlign: "left",
};
const deleteBtnStyle: React.CSSProperties = {
  flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 2, border: "1px solid var(--line)",
  background: "var(--bg-2)", color: "var(--ink-soft)", cursor: "pointer",
};
const setAccountCtaStyle: React.CSSProperties = {
  flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 2,
  border: "1px solid var(--accent)",
  background: "color-mix(in oklab, var(--accent) 8%, var(--bg-2))",
  color: "var(--accent)", cursor: "pointer",
  fontFamily: "inherit", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
};
const nameButtonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "transparent", border: "none", padding: 0, cursor: "pointer",
  fontFamily: "inherit", textAlign: "left",
};
const renameInputStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: "var(--ink)",
  border: "none", outline: "none", background: "transparent",
  borderBottom: "1.5px solid var(--accent)", padding: "0 0 2px",
  fontFamily: "inherit", width: "100%", maxWidth: 220,
};

function rowStyle(first: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 14px",
    borderTop: first ? "none" : "1px solid var(--line)",
    background: "var(--bg-2)",
  };
}
