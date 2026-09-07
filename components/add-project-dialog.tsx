"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AlertCircle, FolderOpen, Link, Plus, Upload, User } from "lucide-react";

type AddMode = "repo" | "username" | "upload";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyze: (mode: "repo" | "username", value: string) => Promise<boolean>;
  onUpload: (files: File[]) => Promise<boolean>;
  onConnectLocalFolder: () => Promise<boolean>;
  isLoading: boolean;
  error?: string | null;
  showFab?: boolean;
  defaultMode?: "repo" | "username" | "upload";
}

export function AddProjectDialog({
  open,
  onOpenChange,
  onAnalyze,
  onUpload,
  onConnectLocalFolder,
  isLoading,
  error,
  showFab = false,
  defaultMode = "repo",
}: AddProjectDialogProps) {
  const supportsFilePicker = typeof window !== "undefined" && "showDirectoryPicker" in window;
  const [mode, setMode] = useState<AddMode>(defaultMode);
  const [value, setValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const resetAndClose = useCallback(() => {
    setValue("");
    setIsDragging(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setValue("");
      setIsDragging(false);
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "upload" || !value.trim()) return;

    const added = await onAnalyze(mode, value);
    if (added) {
      resetAndClose();
    }
  };

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const added = await onUpload(files);
      if (added) {
        resetAndClose();
      }
    },
    [onUpload, resetAndClose]
  );

  const handleConnectLocalFolder = useCallback(async () => {
    const added = await onConnectLocalFolder();
    if (added) {
      resetAndClose();
    }
  }, [onConnectLocalFolder, resetAndClose]);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      void handleFiles(Array.from(event.dataTransfer.files));
    },
    [handleFiles]
  );

  return (
    <>
      {showFab && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="fixed bottom-4 right-4 z-30 h-12 w-12 rounded-xl border-2 border-dashed bg-background/95 shadow-lg backdrop-blur transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
          onClick={() => onOpenChange(true)}
          aria-label="Add project"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Projects</DialogTitle>
            <DialogDescription>
              Add another repository, connect a local folder, or analyze a package.json.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Tabs value={mode} onValueChange={(next) => setMode(next as AddMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="repo">
                <Link className="h-4 w-4" />
                Repo URL
              </TabsTrigger>
              <TabsTrigger value="username">
                <User className="h-4 w-4" />
                Username
              </TabsTrigger>
              <TabsTrigger value="upload">
                <FolderOpen className="h-4 w-4" />
                Local
              </TabsTrigger>
            </TabsList>

            <TabsContent value="repo" className="mt-4">
              <GitHubScan
                submitLabel="Add repository"
                placeholder="github.com/owner/repo or owner/repo"
                value={value}
                onChange={setValue}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="username" className="mt-4">
              <GitHubScan
                submitLabel="Add user repos"
                placeholder="GitHub username"
                value={value}
                onChange={setValue}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <div
                className={cn(
                  "flex min-h-44 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
                onDrop={handleDrop}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FolderOpen className="h-6 w-6 text-muted-foreground" />
                </div>
                {supportsFilePicker ? (
                  <div>
                    <p className="font-medium">
                      {isDragging ? "Drop package.json here" : "Connect a local folder"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Folder scanning runs in your browser and does not upload source files.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Local folder scanning requires Chrome or Edge</p>
                    <p className="text-sm text-muted-foreground">
                      Your browser doesn&apos;t support the File System Access API. You can still drop or upload a <code>package.json</code> below.
                    </p>
                  </div>
                )}
                {isLoading && <Spinner className="h-4 w-4" />}
                <div className="flex flex-wrap justify-center gap-2">
                  {supportsFilePicker && (
                  <Button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleConnectLocalFolder()}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Connect folder
                  </Button>
                  )}
                  <Button asChild variant="outline" className={cn(isLoading && "pointer-events-none opacity-50")}>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4" />
                      package.json
                      <input
                        type="file"
                        accept=".json"
                        disabled={isLoading}
                        className="hidden"
                        onChange={(event) => void handleFiles(Array.from(event.target.files || []))}
                      />
                    </label>
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface GitHubScanProps {
  submitLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  isLoading: boolean;
}

function GitHubScan(props: GitHubScanProps) {
  return <ScanForm {...props} />;
}

function ScanForm({ submitLabel, placeholder, value, onChange, onSubmit, isLoading }: GitHubScanProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <Button type="submit" disabled={!value.trim() || isLoading}>
        {isLoading ? <Spinner className="h-4 w-4" /> : submitLabel}
      </Button>
    </form>
  );
}
