"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { TechUsage, TechUsageLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const usageLevels: Array<{ key: TechUsageLevel; label: string }> = [
  { key: "installed", label: "Installed" },
  { key: "imported", label: "Imported" },
  { key: "used", label: "Used" },
];

export function UsageTicks({
  usage,
  compact = false,
}: {
  usage?: TechUsage;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
      {usageLevels.map((level) => {
        const isPresent = !!usage?.[level.key];
        const Icon = isPresent ? CheckCircle2 : Circle;

        return (
          <span
            key={level.key}
            title={getUsageTitle(level.key, usage)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
              isPresent
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                : "border-border bg-muted/50 text-muted-foreground"
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            {!compact && <span>{level.label}</span>}
          </span>
        );
      })}
    </div>
  );
}

function getUsageTitle(level: TechUsageLevel, usage?: TechUsage) {
  const evidence = usage?.evidence.find((item) => item.type === level);

  if (!evidence) {
    return `${capitalize(level)} evidence not found`;
  }

  const location = evidence.line ? `${evidence.file}:${evidence.line}` : evidence.file;
  return `${capitalize(level)}: ${location} - ${evidence.detail}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
