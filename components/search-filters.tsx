"use client";

import { useMemo } from "react";
import { useAppStore, useAllTechnologies, useSearchResults } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  X,
  User,
  Tag,
  Cpu,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchFilters() {
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const clearFilters = useAppStore((state) => state.clearFilters);
  const accounts = useAppStore((state) => state.accounts);
  const tags = useAppStore((state) => state.tags);
  const setSelectedProject = useAppStore((state) => state.setSelectedProject);
  const allTechnologies = useAllTechnologies();
  const searchResults = useSearchResults();
  const visibleSearchResults = useMemo(
    () => searchResults.slice(0, 8),
    [searchResults]
  );

  const hasActiveFilters =
    searchQuery ||
    filters.accounts.length > 0 ||
    filters.tags.length > 0 ||
    filters.technologies.length > 0 ||
    filters.activityStatus.length > 0;

  const activeFilterCount =
    filters.accounts.length +
    filters.tags.length +
    filters.technologies.length +
    filters.activityStatus.length;

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[150px] sm:flex-none">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search projects, tech, accounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 w-full sm:w-48 lg:w-64 h-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        {searchQuery && (
          <div className="absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="border-b px-3 py-2 text-xs text-muted-foreground">
              {searchResults.length === 0
                ? "No search results"
                : `${searchResults.length} search result${
                    searchResults.length === 1 ? "" : "s"
                  }`}
            </div>
            {visibleSearchResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto p-1">
                {visibleSearchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setSelectedProject(result.projectId)}
                  >
                    <SearchResultBadge type={result.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {result.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {result.context}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account Filter */}
      <FilterPopover
        icon={User}
        label="Accounts"
        count={filters.accounts.length}
        items={accounts.map((a) => ({ id: a.id, label: a.label || a.name }))}
        selectedIds={filters.accounts}
        onSelectionChange={(ids) => setFilters({ accounts: ids })}
      />

      {/* Tag Filter */}
      <FilterPopover
        icon={Tag}
        label="Tags"
        count={filters.tags.length}
        items={tags.map((t) => ({ id: t.id, label: t.name, color: t.color }))}
        selectedIds={filters.tags}
        onSelectionChange={(ids) => setFilters({ tags: ids })}
      />

      {/* Technology Filter */}
      <FilterPopover
        icon={Cpu}
        label="Tech"
        count={filters.technologies.length}
        items={allTechnologies.map((t) => ({
          id: t.name.toLowerCase(),
          label: t.name,
          count: t.count,
        }))}
        selectedIds={filters.technologies}
        onSelectionChange={(ids) => setFilters({ technologies: ids })}
      />

      {/* Activity Status Filter */}
      <FilterPopover
        icon={Clock}
        label="Activity"
        count={filters.activityStatus.length}
        items={[
          { id: "active", label: "Active", color: "#10b981" },
          { id: "stale", label: "Stale", color: "#f59e0b" },
          { id: "dormant", label: "Dormant", color: "#6b7280" },
        ]}
        selectedIds={filters.activityStatus}
        onSelectionChange={(ids) =>
          setFilters({ activityStatus: ids as ("active" | "stale" | "dormant")[] })
        }
      />

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-1 h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      )}
    </div>
  );
}

function SearchResultBadge({
  type,
}: {
  type: "project" | "tech" | "tag" | "account" | "note";
}) {
  const labels = {
    project: "Project",
    tech: "Tech",
    tag: "Tag",
    account: "Account",
    note: "Note",
  };

  return (
    <Badge variant="secondary" className="mt-0.5 text-[10px]">
      {labels[type]}
    </Badge>
  );
}

interface FilterItem {
  id: string;
  label: string;
  color?: string;
  count?: number;
}

interface FilterPopoverProps {
  icon: React.ElementType;
  label: string;
  count: number;
  items: FilterItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

function FilterPopover({
  icon: Icon,
  label,
  count,
  items,
  selectedIds,
  onSelectionChange,
}: FilterPopoverProps) {
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 h-9",
            count > 0 && "border-primary bg-primary/5"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
          {count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Filter ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleToggle(item.id)}
                  className="gap-2"
                >
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    className="pointer-events-none"
                  />
                  {item.color && (
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {item.count}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
