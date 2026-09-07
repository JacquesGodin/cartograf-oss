"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock } from "lucide-react";
import { getActivityStatus, type ActivityStatus } from "@/lib/types";

interface ActivityBadgeProps {
  lastCommitAt?: string;
  size?: "sm" | "default";
  showLabel?: boolean;
}

const statusConfig: Record<ActivityStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  active: {
    label: "Active",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  stale: {
    label: "Stale",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
  dormant: {
    label: "Dormant",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted-foreground/30",
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function ActivityBadge({ lastCommitAt, size = "default", showLabel = true }: ActivityBadgeProps) {
  const status = getActivityStatus(lastCommitAt);
  const config = statusConfig[status];
  
  const badge = (
    <Badge
      variant="outline"
      className={`gap-1 ${config.bgColor} ${config.borderColor} ${config.color} ${
        size === "sm" ? "text-[10px] px-1.5 py-0" : ""
      }`}
    >
      <Clock className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
  
  if (!lastCommitAt) {
    return badge;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            Last commit: {formatRelativeTime(lastCommitAt)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
