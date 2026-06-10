import { homedir } from "node:os";
import { join } from "node:path";
import { consola } from "consola";
import { colors } from "consola/utils";
import { ofetch } from "ofetch";
import { z } from "zod";

const checkIntervalMs = 24 * 60 * 60 * 1000;
const networkTimeoutMs = 1500;

const cacheSchema = z.object({ checkedAt: z.number(), latestVersion: z.string() });

type UpdateCache = z.infer<typeof cacheSchema>;

const registryManifestSchema = z.object({ version: z.string() });

function cacheFilePath(packageName: string): string {
  const baseDirectory = process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache");

  return join(baseDirectory, "tf-hub", `${packageName.replace("/", "__")}.json`);
}

async function readCache(filePath: string): Promise<UpdateCache | null> {
  try {
    return cacheSchema.parse(await Bun.file(filePath).json());
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, cache: UpdateCache): Promise<void> {
  try {
    await Bun.write(filePath, JSON.stringify(cache), { createPath: true });
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

export function selectUpdateNotice(currentVersion: string, latestVersion: string | null): string | null {
  if (!latestVersion) {
    return null;
  }

  return Bun.semver.order(latestVersion, currentVersion) === 1 ? latestVersion : null;
}

export function updateInstallCommand(packageName: string, binPath = process.argv[1] ?? ""): string {
  if (binPath.includes(".bun")) {
    return `bun add -g ${packageName}`;
  }

  if (binPath.includes("pnpm")) {
    return `pnpm add -g ${packageName}`;
  }

  if (binPath.includes("yarn")) {
    return `yarn global add ${packageName}`;
  }

  return `npm install -g ${packageName}`;
}

function notificationsDisabled(): boolean {
  return Boolean(process.env["NO_UPDATE_NOTIFIER"] || process.env["CI"]) || !process.stdout.isTTY;
}

export async function notifyOnUpdate(packageName: string, currentVersion: string): Promise<void> {
  if (notificationsDisabled()) {
    return;
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

  const notice = selectUpdateNotice(currentVersion, latestVersion);

  if (notice) {
    consola.box(
      `Update available ${colors.dim(currentVersion)} → ${colors.green(notice)}\nRun ${colors.cyan(updateInstallCommand(packageName))} to update.`,
    );
  }
}
