"use client";

import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

interface AccountBadgeProps {
  accountId?: string;
  size?: "sm" | "default";
  showProvider?: boolean;
}

export function AccountBadge({ accountId, size = "default", showProvider = false }: AccountBadgeProps) {
  const accounts = useAppStore((state) => state.accounts);
  
  if (!accountId) {
    return (
      <Badge 
        variant="outline" 
        className={`gap-1 text-muted-foreground border-dashed ${size === "sm" ? "text-[10px] px-1.5 py-0" : ""}`}
      >
        <User className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        <span>No account</span>
      </Badge>
    );
  }
  
  const account = accounts.find((a) => a.id === accountId);
  
  if (!account) {
    return (
      <Badge 
        variant="outline" 
        className={`gap-1 text-muted-foreground ${size === "sm" ? "text-[10px] px-1.5 py-0" : ""}`}
      >
        <User className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        <span>Unknown</span>
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="secondary" 
      className={`gap-1 ${size === "sm" ? "text-[10px] px-1.5 py-0" : ""}`}
    >
      <User className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span>{account.label || account.name}</span>
      {showProvider && (
        <span className="text-muted-foreground">({account.provider})</span>
      )}
    </Badge>
  );
}
