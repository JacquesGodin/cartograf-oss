"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Check, Plus, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  projectId: string;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  compact?: boolean;
}

const tagColors = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#6b7280", // gray
];

export function TagSelector({
  projectId: _projectId,
  selectedTagIds,
  onTagsChange,
  compact = false,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(tagColors[0]);
  
  const tags = useAppStore((state) => state.tags);
  const addTag = useAppStore((state) => state.addTag);
  
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));
  
  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };
  
  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      color: newTagColor,
    };
    
    addTag(newTag);
    onTagsChange([...selectedTagIds, newTag.id]);
    setNewTagName("");
    setNewTagColor(tagColors[0]);
    setShowNewForm(false);
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 border-dashed",
            compact && "h-7 text-xs"
          )}
        >
          <Tag className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {selectedTags.length > 0 ? (
            <span>{selectedTags.length} tag{selectedTags.length !== 1 && "s"}</span>
          ) : (
            <span>Add tags</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {!showNewForm ? (
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup heading="Tags">
                {tags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => handleToggleTag(tag.id)}
                    className="gap-2"
                  >
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1">{tag.name}</span>
                    <Check
                      className={cn(
                        "h-3.5 w-3.5",
                        selectedTagIds.includes(tag.id)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={() => setShowNewForm(true)} className="gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create new tag</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">New Tag</h4>
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
              <Label htmlFor="tag-name" className="text-xs">
                Tag Name
              </Label>
              <Input
                id="tag-name"
                placeholder="e.g., Client Project"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {tagColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all",
                      newTagColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
            >
              Create Tag
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function TagBadges({ tagIds, size = "default" }: { tagIds: string[]; size?: "sm" | "default" }) {
  const tags = useAppStore((state) => state.tags);
  const selectedTags = tags.filter((t) => tagIds.includes(t.id));
  
  if (selectedTags.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn(
            "gap-1",
            size === "sm" && "text-[10px] px-1.5 py-0"
          )}
          style={{ borderColor: tag.color, color: tag.color }}
        >
          <Tag className={size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"} />
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}
