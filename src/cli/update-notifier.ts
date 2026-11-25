import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { box, colors } from "consola/utils";
import { ofetch } from "ofetch";
import { z } from "zod";

import { repositoryUrl } from "../config.ts";
import { cacheDirectory } from "../user-directories.ts";

const checkIntervalMs = 24 * 60 * 60 * 1000;
const networkTimeoutMs = 1500;

const cacheSchema = z.object({ checkedAt: z.number(), latestVersion: z.string() });

type UpdateCache = z.infer<typeof cacheSchema>;

const registryManifestSchema = z.object({ version: z.string() });

function cacheFilePath(packageName: string): string {
  return join(cacheDirectory(), `${packageName.replace("/", "__")}.json`);
}

async function readCache(filePath: string): Promise<UpdateCache | null> {
  try {
    return cacheSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, cache: UpdateCache): Promise<void> {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(cache));
  } catch {
    // A non-writable cache directory must never break a command.
  }
}

export async function fetchLatestVersion(packageName: string, timeoutMs = networkTimeoutMs): Promise<string | null> {
  try {
    const manifest = await ofetch(`https://registry.npmjs.org/${packageName}/latest`, {
      timeout: timeoutMs,
    });

    return registryManifestSchema.parse(manifest).version;
  } catch {
    return null;
  }
}

// Strict x.y.z comparison; a pre-release never wins, and a stable build supersedes its own pre-releases.
function isNewerVersion(candidate: string, current: string): boolean {
  if (candidate.includes("-")) {
    return false;
  }

  const candidateParts = candidate.split(".").map(Number);
  const currentParts = current.split("-")[0]?.split(".").map(Number) ?? [];

  for (let index = 0; index < 3; index += 1) {
    const difference = (candidateParts[index] ?? 0) - (currentParts[index] ?? 0);

    if (difference !== 0) {
      return difference > 0;
    }
  }

  return current.includes("-");
}

export function selectUpdateNotice(currentVersion: string, latestVersion: string | null): string | null {
  if (!latestVersion) {
    return null;
  }

  return isNewerVersion(latestVersion, currentVersion) ? latestVersion : null;
}

// Compiled executables serve their modules from Bun's virtual filesystem; under Node there is no Bun global.
export function runsAsStandaloneBinary(entryPath = typeof Bun === "undefined" ? "" : Bun.main): boolean {
  return entryPath.includes("/$bunfs/") || entryPath.includes("~BUN");
}

export function binaryAssetName(platform = process.platform, architecture = process.arch): string {
  const operatingSystem = platform === "win32" ? "windows" : platform;
  const extension = platform === "win32" ? ".exe" : "";

  return `tf-hub-${operatingSystem}-${architecture}${extension}`;
}

export function binaryDownloadUrl(version: string): string {
  return `${repositoryUrl}/releases/download/v${version}/${binaryAssetName()}`;
}

type InstallCommand = readonly [executable: string, ...commandArguments: string[]];

export function updateInstallCommand(packageName: string, binPath = process.argv[1] ?? ""): InstallCommand {
  if (binPath.includes(".bun")) {
    return ["bun", "add", "-g", packageName];
  }

  if (binPath.includes("pnpm")) {
    return ["pnpm", "add", "-g", packageName];
  }

  if (binPath.includes("yarn")) {
    return ["yarn", "global", "add", packageName];
  }

  return ["npm", "install", "-g", packageName];
}

function notificationsDisabled(): boolean {
  return (
    Boolean(process.env["NO_UPDATE_NOTIFIER"] || process.env["CI"]) || !process.stdout.isTTY || !process.stderr.isTTY
  );
}

// Returns the rendered notice instead of printing it, so it lands on stderr after the command's own output.
export async function findUpdateNotice(packageName: string, currentVersion: string): Promise<string | null> {
  if (notificationsDisabled()) {
    return null;
  }

  const filePath = cacheFilePath(packageName);
  const cache = await readCache(filePath);
  let latestVersion = cache?.latestVersion ?? null;

  const isStale = !cache || Date.now() - cache.checkedAt >= checkIntervalMs;

  if (isStale) {
    latestVersion = await fetchLatestVersion(packageName);

    if (latestVersion) {
      await writeCache(filePath, { checkedAt: Date.now(), latestVersion });
    }
  }

  const newerVersion = selectUpdateNotice(currentVersion, latestVersion);

  if (!newerVersion) {
    return null;
  }

  const instruction = runsAsStandaloneBinary()
    ? `Run ${colors.cyan("tf-hub update")} to see the download link.`
    : `Run ${colors.cyan(updateInstallCommand(packageName).join(" "))} to update.`;

  return box(`Update available ${colors.dim(currentVersion)} → ${colors.green(newerVersion)}\n${instruction}`);
}
