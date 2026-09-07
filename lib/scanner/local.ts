import type { Project } from "@/lib/types";
import {
  debugLog,
  debugLogThrottled,
  debugWarn,
  measureDuration,
} from "@/lib/debug-logger";
import {
  buildStack,
  detectSourceUsageInFiles,
  getDetectedPackageNames,
  getPackageJsonDetails,
  hasRecognizedStack,
  isSensitiveFilePath,
  isSourceFile,
  MAX_SOURCE_FILE_SIZE,
  MAX_SOURCE_FILES,
  normalizeProjectPath,
  parsePackageJsonContent,
  pathDepth,
  pathHasIgnoredSegment,
  stackToProject,
  type SourceFile,
} from "@/lib/scanner/core";

interface BrowserFileHandle {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
}

interface BrowserDirectoryHandle {
  kind: "directory";
  name: string;
  entries: () => AsyncIterableIterator<[string, BrowserFileHandle | BrowserDirectoryHandle]>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" }) => Promise<BrowserDirectoryHandle>;
}

interface DirectoryScanState {
  scannedEntries: number;
  truncated: boolean;
  startedAt: number;
}

const MAX_LOCAL_FILE_PATHS = 20_000;
const MAX_LOCAL_SCANNED_ENTRIES = 8_000;
const LOCAL_SCAN_YIELD_INTERVAL = 100;
export const MAX_PACKAGE_JSON_FILE_SIZE = 1_000_000;

export async function pickLocalFolder(): Promise<BrowserDirectoryHandle> {
  const pickerWindow = window as DirectoryPickerWindow;
  if (!pickerWindow.showDirectoryPicker) {
    throw new Error("Local folder scanning requires Chrome or Edge because this browser does not support folder access.");
  }
  return pickerWindow.showDirectoryPicker({ mode: "read" });
}

export async function scanDirectoryHandle(directory: BrowserDirectoryHandle): Promise<Project[]> {
  debugLog("local-scan", "directory selected", { name: directory.name });
  const snapshot = await readDirectorySnapshot(directory);
  return [
    await analyzeLocalSnapshot({
      projectName: directory.name,
      packageJsonContent: snapshot.packageJsonContent,
      filePaths: snapshot.filePaths,
      sourceFiles: snapshot.sourceFiles,
      iconDataUrl: snapshot.iconDataUrl,
    }),
  ];
}

export async function scanLocalProjectFolder(): Promise<Project[]> {
  const directory = await pickLocalFolder();
  return scanDirectoryHandle(directory);
}

export async function analyzeLocalPackageFile(file: File): Promise<Project[]> {
  return [
    await analyzeLocalSnapshot({
      projectName: file.name.replace(/\.json$/, "") || "Local Project",
      packageJsonContent: await readPackageJsonFile(file),
      filePaths: ["package.json"],
      sourceFiles: [],
    }),
  ];
}

async function readDirectorySnapshot(directory: BrowserDirectoryHandle) {
  const filePaths: string[] = [];
  const sourceFiles: SourceFile[] = [];
  const packageFiles: Array<{ path: string; handle: BrowserFileHandle }> = [];
  const state: DirectoryScanState = {
    scannedEntries: 0,
    truncated: false,
    startedAt: performance.now(),
  };

  await collectDirectoryFiles(directory, "", filePaths, sourceFiles, packageFiles, state);

  const scanSummary = {
    durationMs: measureDuration(state.startedAt),
    scannedEntries: state.scannedEntries,
    filePathCount: filePaths.length,
    sourceFileCount: sourceFiles.length,
    packageFileCount: packageFiles.length,
    truncated: state.truncated,
  };
  if (state.truncated) {
    debugWarn("local-scan", "directory scan capped", scanSummary);
  } else {
    debugLog("local-scan", "directory scan completed", scanSummary);
  }

  const packageFile = packageFiles.sort((a, b) => pathDepth(a.path) - pathDepth(b.path))[0];
  if (!packageFile) {
    if (state.truncated) {
      throw new Error("The selected folder is too large to scan safely and no package.json was found before the scan limit. Select the project folder directly.");
    }
    throw new Error("The selected folder does not contain a package.json file.");
  }

  const iconDataUrl = await readProjectIcon(directory);
  const packageJsonFile = await packageFile.handle.getFile();

  return {
    filePaths,
    sourceFiles,
    packageJsonContent: await readPackageJsonFile(packageJsonFile),
    iconDataUrl,
  };
}

async function readProjectIcon(directory: BrowserDirectoryHandle): Promise<string | undefined> {
  const candidates = [
    ["public", "icon.png"],
    ["public", "icon.svg"],
    ["public", "favicon.ico"],
    ["public", "apple-touch-icon.png"],
    ["favicon.ico"],
  ];
  for (const parts of candidates) {
    try {
      let handle: BrowserDirectoryHandle = directory;
      for (const part of parts.slice(0, -1)) {
        handle = await (handle as unknown as FileSystemDirectoryHandle).getDirectoryHandle(part) as unknown as BrowserDirectoryHandle;
      }
      const fileHandle = await (handle as unknown as FileSystemDirectoryHandle).getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch {
      // not found, try next candidate
    }
  }
  return undefined;
}

async function collectDirectoryFiles(
  directory: BrowserDirectoryHandle,
  basePath: string,
  filePaths: string[],
  sourceFiles: SourceFile[],
  packageFiles: Array<{ path: string; handle: BrowserFileHandle }>,
  state: DirectoryScanState
) {
  for await (const [, handle] of directory.entries()) {
    if (state.truncated) return;

    state.scannedEntries++;
    if (state.scannedEntries > MAX_LOCAL_SCANNED_ENTRIES) {
      state.truncated = true;
      return;
    }

    if (state.scannedEntries % LOCAL_SCAN_YIELD_INTERVAL === 0) {
      debugLogThrottled(
        "local-scan:progress",
        "local-scan",
        "directory scan progress",
        {
          scannedEntries: state.scannedEntries,
          filePathCount: filePaths.length,
          sourceFileCount: sourceFiles.length,
          packageFileCount: packageFiles.length,
          currentDirectory: basePath || ".",
        },
        1_000
      );
      await yieldToBrowser();
    }

    const path = normalizeProjectPath(basePath ? `${basePath}/${handle.name}` : handle.name);

    if (pathHasIgnoredSegment(path)) {
      continue;
    }

    if (handle.kind === "directory") {
      await collectDirectoryFiles(handle, path, filePaths, sourceFiles, packageFiles, state);
      continue;
    }

    if (isSensitiveFilePath(path)) {
      continue;
    }

    if (filePaths.length < MAX_LOCAL_FILE_PATHS) {
      filePaths.push(path);
    }

    if (path === "package.json" || path.endsWith("/package.json")) {
      packageFiles.push({ path, handle });
    }

    if (
      sourceFiles.length < MAX_SOURCE_FILES &&
      isSourceFile(path) &&
      !pathHasIgnoredSegment(path, true)
    ) {
      const file = await handle.getFile();
      if (file.size <= MAX_SOURCE_FILE_SIZE) {
        sourceFiles.push({
          path,
          content: await file.text(),
        });
      }
    }
  }
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

async function analyzeLocalSnapshot({
  projectName,
  packageJsonContent,
  filePaths,
  sourceFiles,
  iconDataUrl,
}: {
  projectName: string;
  packageJsonContent: string;
  filePaths: string[];
  sourceFiles: SourceFile[];
  iconDataUrl?: string;
}) {
  const startedAt = performance.now();
  debugLog("local-analysis", "analysis started", {
    projectName,
    filePathCount: filePaths.length,
    sourceFileCount: sourceFiles.length,
  });

  const parsed = parsePackageJsonContent(packageJsonContent);
  const packageJson = getPackageJsonDetails(parsed);
  const installedStack = buildStack(packageJson, filePaths);
  await yieldToBrowser();

  const detectedPackageNames = getDetectedPackageNames(installedStack);
  let sourceCheckedPairs = 0;
  const sourceUsageByPackage = await detectSourceUsageInFiles(
    sourceFiles,
    detectedPackageNames,
    {
      yieldEvery: 10,
      onProgress: async (progress) => {
        sourceCheckedPairs = progress.checkedPairs;
        debugLogThrottled(
          "local-analysis:source-progress",
          "local-analysis",
          "source usage progress",
          {
            ...progress,
            durationMs: measureDuration(startedAt),
          },
          1_000
        );
        await yieldToBrowser();
      },
    }
  );
  await yieldToBrowser();
  sourceCheckedPairs = detectedPackageNames.length * sourceFiles.length;

  const stack = buildStack(packageJson, filePaths, sourceUsageByPackage);

  if (!hasRecognizedStack(stack)) {
    throw new Error("No recognized tech stack found in package.json.");
  }

  debugLog("local-analysis", "analysis completed", {
    durationMs: measureDuration(startedAt),
    checkedPairs: sourceCheckedPairs,
    projectName,
    dependencyCount: Object.keys(packageJson.dependencies).length,
    detectedPackageCount: detectedPackageNames.length,
    sourceFileCount: sourceFiles.length,
    evidencePackageCount: sourceUsageByPackage.size,
  });

  const displayName = packageJson.name || projectName || "Local Project";
  return stackToProject({
    projectId: `local/${slugify(displayName)}`,
    githubOwner: "local",
    githubRepo: displayName,
    url: "",
    displayName,
    description: packageJson.description || null,
    stack,
    icon: iconDataUrl,
  });
}

async function readPackageJsonFile(file: File) {
  if (file.size > MAX_PACKAGE_JSON_FILE_SIZE) {
    throw new Error("package.json is too large to scan safely. Select a file under 1 MB.");
  }
  return file.text();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "local-project";
}
