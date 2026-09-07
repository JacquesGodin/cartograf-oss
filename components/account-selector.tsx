"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountBadge } from "./account-badge";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountSelectorProps {
  techInstanceId: string;
  currentAccountId?: string;
  provider: string;
  onSelect: (accountId: string | undefined) => void;
  /** Optional custom trigger; defaults to the account badge. Must be a focusable element. */
  trigger?: React.ReactNode;
  autoOpenKey?: number;
}

export function AccountSelector({
  techInstanceId: _techInstanceId,
  currentAccountId,
  provider,
  onSelect,
  trigger,
  autoOpenKey,
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountLabel, setNewAccountLabel] = useState("");
  
  const accounts = useAppStore((state) => state.accounts);
  const addAccount = useAppStore((state) => state.addAccount);
  
  useEffect(() => {
    if (!autoOpenKey) return;
    const frame = requestAnimationFrame(() => {
      setShowNewForm(false);
      setOpen(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [autoOpenKey]);
  
  const handleCreateAccount = () => {
    if (!newAccountName.trim()) return;
    
    const newAccount = {
      id: `${provider.toLowerCase()}-${Date.now()}`,
      provider: provider,
      name: newAccountName.trim(),
      label: newAccountLabel.trim() || undefined,
    };
    
    addAccount(newAccount);
    onSelect(newAccount.id);
    setNewAccountName("");
    setNewAccountLabel("");
    setShowNewForm(false);
    setOpen(false);
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <AccountBadge accountId={currentAccountId} size="sm" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        {!showNewForm ? (
          <Command>
            <CommandInput placeholder="Search your accounts..." />
            <CommandList>
              <CommandEmpty>No accounts found.</CommandEmpty>
              <CommandGroup heading="Your accounts">
                {currentAccountId && (
                  <CommandItem
                    onSelect={() => {
                      onSelect(undefined);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Remove account</span>
                  </CommandItem>
                )}
                {accounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    onSelect={() => {
                      onSelect(account.id);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5",
                        currentAccountId === account.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <span>{account.label || account.name}</span>
                    {account.label && (
                      <span className="text-xs text-muted-foreground">
                        ({account.name})
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={() => setShowNewForm(true)} className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create new account</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">New {provider} Account</h4>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowNewForm(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name" className="text-xs">
                Email or username *
              </Label>
              <Input
                id="account-name"
                placeholder="e.g., you@example.com"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-label" className="text-xs">
                Label (optional)
              </Label>
              <Input
                id="account-label"
                placeholder="e.g., Personal"
                value={newAccountLabel}
                onChange={(e) => setNewAccountLabel(e.target.value)}
                className="h-8"
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleCreateAccount}
              disabled={!newAccountName.trim()}
            >
              Create Account
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
