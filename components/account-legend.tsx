"use client";

import { useMemo } from "react";
import { AccountBadge } from "@/components/account-badge";
import { Badge } from "@/components/ui/badge";
import { useAppStore, useLoadedProjects } from "@/lib/store";
import { techMatchesLayer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AccountLegend() {
  const projects = useLoadedProjects();
  const accounts = useAppStore((state) => state.accounts);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);

  const { accountCounts, unassignedCount } = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;

    projects.forEach((project) => {
      project.techInstances
        .filter((tech) => techMatchesLayer(tech, "services"))
        .forEach((tech) => {
          if (!tech.accountId) {
            unassigned += 1;
            return;
          }

          counts.set(tech.accountId, (counts.get(tech.accountId) || 0) + 1);
        });
    });

    return { accountCounts: counts, unassignedCount: unassigned };
  }, [projects]);

  const assignedAccounts = accounts
    .filter((account) => accountCounts.has(account.id))
    .sort((a, b) => (accountCounts.get(b.id) || 0) - (accountCounts.get(a.id) || 0));

  if (assignedAccounts.length === 0 && unassignedCount === 0) {
    return null;
  }

  const toggleAccountFilter = (accountId: string) => {
    const nextAccounts = filters.accounts.includes(accountId)
      ? filters.accounts.filter((id) => id !== accountId)
      : [...filters.accounts, accountId];

    setFilters({ accounts: nextAccounts });
  };

  return (
    <div className="hidden xl:flex items-center gap-2 border-l border-border/70 pl-3">
      <span className="text-xs font-medium text-muted-foreground">Accounts</span>
      <div className="flex max-w-[520px] items-center gap-1.5 overflow-hidden">
        {assignedAccounts.slice(0, 4).map((account) => {
          const isSelected = filters.accounts.includes(account.id);

          return (
            <button
              key={account.id}
              type="button"
              className={cn(
                "flex items-center gap-1 rounded-full border border-transparent transition-colors",
                isSelected && "border-primary bg-primary/5"
              )}
              onClick={() => toggleAccountFilter(account.id)}
            >
              <AccountBadge accountId={account.id} size="sm" showProvider />
              <span className="pr-1.5 text-[10px] text-muted-foreground">
                {accountCounts.get(account.id)}
              </span>
            </button>
          );
        })}
        {assignedAccounts.length > 4 && (
          <Badge variant="outline" className="text-[10px]">
            +{assignedAccounts.length - 4}
          </Badge>
        )}
        {unassignedCount > 0 && (
          <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
            {unassignedCount} unassigned
          </Badge>
        )}
      </div>
    </div>
  );
}
