"use client";

import { useState } from "react";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagSelector, TagBadges } from "@/components/tag-selector";
import { AccountSelector } from "@/components/account-selector";
import { ActivityBadge } from "@/components/activity-badge";
import { AccountBadge } from "@/components/account-badge";
import { UsageTicks } from "@/components/usage-ticks";
import { safeExternalUrl } from "@/lib/safe-url";
import { categoryIcons } from "@/components/category-icons";
import {
  GitBranch,
  ExternalLink,
  StickyNote,
  Clock,
  AlertTriangle,
  Check,
  X,
  Tags,
  Layers3,
  Users,
  ServerCog,
} from "lucide-react";
import {
  categoryConfig,
  getTechLayer,
  techMatchesLayer,
  type Environment,
  type TechCategory,
} from "@/lib/types";

export function SummaryPanel() {
  const isPanelOpen = useAppStore((state) => state.isPanelOpen);
  const setPanelOpen = useAppStore((state) => state.setPanelOpen);
  const selectedProject = useSelectedProject();
  const updateProjectNotes = useAppStore((state) => state.updateProjectNotes);
  const updateProjectTags = useAppStore((state) => state.updateProjectTags);
  const assignAccountToTech = useAppStore((state) => state.assignAccountToTech);
  const setTechEnvironment = useAppStore((state) => state.setTechEnvironment);
  const accounts = useAppStore((state) => state.accounts);
  
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  if (!selectedProject) return null;

  // Only link out to a validated http(s) URL — a project URL is user-controlled
  // (via the API or an imported map file) and could otherwise be a javascript: URI.
  const safeProjectUrl = safeExternalUrl(selectedProject.url);

  const handleOpenNotes = () => {
    setNotesValue(selectedProject.notes || "");
    setIsEditingNotes(true);
  };

  const handleSaveNotes = () => {
    updateProjectNotes(selectedProject.id, notesValue);
    setIsEditingNotes(false);
  };

  const handleCancelNotes = () => {
    setIsEditingNotes(false);
    setNotesValue(selectedProject.notes || "");
  };

  const serviceTechInstances = selectedProject.techInstances.filter((tech) =>
    techMatchesLayer(tech, "services")
  );
  const libraryTechInstances = selectedProject.techInstances.filter((tech) =>
    techMatchesLayer(tech, "libraries")
  );

  const techByCategory = selectedProject.techInstances.reduce(
    (acc, tech) => {
      if (!acc[tech.category]) {
        acc[tech.category] = [];
      }
      acc[tech.category].push(tech);
      return acc;
    },
    {} as Record<TechCategory, typeof selectedProject.techInstances>
  );

  const techWithoutAccounts = serviceTechInstances.filter(
    (ti) => !ti.accountId
  );
  const hasWarnings = techWithoutAccounts.length > 0;

  const usedAccountIds = [
    ...new Set(
      serviceTechInstances
        .map((ti) => ti.accountId)
        .filter(Boolean)
    ),
  ];
  const usedAccounts = accounts.filter((a) => usedAccountIds.includes(a.id));
  const environmentCounts = selectedProject.techInstances.reduce(
    (acc, tech) => {
      const environment = tech.environment || "unknown";
      acc[environment] = (acc[environment] || 0) + 1;
      return acc;
    },
    {} as Record<Environment, number>
  );

  return (
    <Sheet open={isPanelOpen} onOpenChange={setPanelOpen}>
      <SheetContent className="w-[min(92vw,460px)] gap-0 overflow-hidden border-l bg-background/95 p-0 shadow-2xl backdrop-blur sm:max-w-[460px]">
        <SheetHeader className="border-b border-border/70 bg-muted/20 px-5 py-5 pr-12">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border bg-background shadow-sm">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <SheetTitle className="truncate text-lg font-semibold leading-tight">
                  {selectedProject.displayName}
                </SheetTitle>
                {safeProjectUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 rounded-full"
                    asChild
                  >
                    <a
                      href={safeProjectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
              {selectedProject.description && (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {selectedProject.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ActivityBadge lastCommitAt={selectedProject.activity?.lastCommitAt} />
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Layers3 className="h-3 w-3" />
                  {selectedProject.techInstances.length} techs
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  {serviceTechInstances.length} service{serviceTechInstances.length !== 1 && "s"}
                </Badge>
                {usedAccounts.length > 0 && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    {usedAccounts.length} account{usedAccounts.length !== 1 && "s"}
                  </Badge>
                )}
                {hasWarnings && (
                  <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-xs text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    {techWithoutAccounts.length} service{techWithoutAccounts.length !== 1 && "s"} unassigned
                  </Badge>
                )}
              </div>
              <div className="mt-2">
                <TagBadges tagIds={selectedProject.tags} size="sm" />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <PanelSection
            title="Tags"
            icon={<Tags className="h-4 w-4" />}
            action={
              <TagSelector
                projectId={selectedProject.id}
                selectedTagIds={selectedProject.tags}
                onTagsChange={(tagIds) =>
                  updateProjectTags(selectedProject.id, tagIds)
                }
                compact
              />
            }
          />

          <PanelSection
            title="Tech Stack"
            icon={<Layers3 className="h-4 w-4" />}
            subtitle={`${serviceTechInstances.length} services, ${libraryTechInstances.length} libraries`}
          >
            <div className="space-y-3">
              {(Object.entries(techByCategory) as [TechCategory, typeof selectedProject.techInstances][]).map(
                ([category, techs]) => {
                  const config = categoryConfig[category];
                  const Icon = categoryIcons[category];

                  return (
                    <div key={category} className="rounded-2xl border bg-card/70 p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${config.color}18` }}
                          >
                            <Icon className="h-4 w-4" style={{ color: config.color }} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{config.label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {techs.length} item{techs.length !== 1 && "s"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {techs.map((tech) => {
                          const layer =
                            tech.layer || getTechLayer(tech.technologyName, tech.category);

                          return (
                            <div
                              key={tech.id}
                              className="rounded-xl border border-border/60 bg-background/85 p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-medium">
                                      {tech.technologyName}
                                    </span>
                                    <Badge variant="secondary" className="h-5 flex-shrink-0 px-1.5 text-[10px] font-normal capitalize">
                                      {layer}
                                    </Badge>
                                    {tech.version && (
                                      <Badge variant="outline" className="h-5 flex-shrink-0 px-1.5 text-[10px] font-normal">
                                        {tech.version}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <UsageTicks usage={tech.usage} compact />
                                  </div>
                                </div>
                              </div>
                              {layer === "service" && (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <EnvironmentSelector
                                    value={tech.environment || "unknown"}
                                    onChange={(environment) =>
                                      setTechEnvironment(tech.id, environment)
                                    }
                                  />
                                  <AccountSelector
                                    techInstanceId={tech.id}
                                    currentAccountId={tech.accountId}
                                    provider={tech.technologyName}
                                    onSelect={(accountId) =>
                                      assignAccountToTech(tech.id, accountId)
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </PanelSection>

          <PanelSection title="Accounts" icon={<Users className="h-4 w-4" />}>
            {usedAccounts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {usedAccounts.map((account) => (
                  <AccountBadge key={account.id} accountId={account.id} showProvider />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                No accounts assigned yet.
              </p>
            )}
          </PanelSection>

          <PanelSection title="Environments" icon={<ServerCog className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              {environmentOptions.map((environment) => (
                <div key={environment.value} className="rounded-xl border bg-card/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {environment.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {environmentCounts[environment.value] || 0}
                  </p>
                </div>
              ))}
            </div>
          </PanelSection>

          <PanelSection
            title="Notes"
            icon={<StickyNote className="h-4 w-4" />}
            action={
              !isEditingNotes ? (
                <Button variant="ghost" size="sm" onClick={handleOpenNotes}>
                  {selectedProject.notes ? "Edit" : "Add"}
                </Button>
              ) : null
            }
          >
            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add notes about this project..."
                  className="min-h-24 resize-none rounded-xl"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelNotes}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : selectedProject.notes ? (
              <p className="rounded-xl border bg-card/70 p-3 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                {selectedProject.notes}
              </p>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                No notes added.
              </p>
            )}
          </PanelSection>

          <PanelSection title="Activity" icon={<Clock className="h-4 w-4" />}>
            <div className="overflow-hidden rounded-xl border bg-card/70 text-sm">
              {selectedProject.activity?.lastCommitAt && (
                <InfoRow
                  label="Last commit"
                  value={new Date(selectedProject.activity.lastCommitAt).toLocaleDateString()}
                />
              )}
              {selectedProject.activity?.defaultBranch && (
                <InfoRow
                  label="Default branch"
                  value={selectedProject.activity.defaultBranch}
                  mono
                />
              )}
              {selectedProject.activity?.openIssues !== undefined && (
                <InfoRow label="Open issues" value={selectedProject.activity.openIssues} />
              )}
              {selectedProject.lastAnalyzedAt && (
                <InfoRow
                  label="Last analyzed"
                  value={new Date(selectedProject.lastAnalyzedAt).toLocaleDateString()}
                />
              )}
            </div>
          </PanelSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PanelSection({
  title,
  icon,
  subtitle,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}

const environmentOptions: Array<{ value: Environment; label: string }> = [
  { value: "unknown", label: "Unknown" },
  { value: "dev", label: "Dev" },
  { value: "staging", label: "Staging" },
  { value: "prod", label: "Prod" },
];

function EnvironmentSelector({
  value,
  onChange,
}: {
  value: Environment;
  onChange: (environment: Environment) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Environment)}>
      <SelectTrigger size="sm" className="h-8 w-[112px] rounded-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {environmentOptions.map((environment) => (
          <SelectItem key={environment.value} value={environment.value}>
            {environment.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
