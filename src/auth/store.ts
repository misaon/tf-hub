import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

import { configDirectory } from "../user-directories.ts";

const storedCredentialsSchema = z.object({
  apiKey: z.string(),
  refreshToken: z.string(),
  idToken: z.string().optional(),
  idTokenExpiresAtMs: z.number().optional(),
});
export type StoredCredentials = z.infer<typeof storedCredentialsSchema>;

// Owner-only credentials file — the same storage model npm, gcloud and docker use.
export function credentialsFilePath(): string {
  return join(configDirectory(), "credentials.json");
}

async function readCredentialsFile(): Promise<string | null> {
  try {
    return await readFile(credentialsFilePath(), "utf8");
  } catch {
    return null;
  }
}

// A corrupted credentials file must never block recovery commands like `tf-hub logout`.
export async function readStoredCredentials(): Promise<StoredCredentials | null> {
  const serialized = await readCredentialsFile();

  if (!serialized) {
    return null;
  }

  try {
    return storedCredentialsSchema.parse(JSON.parse(serialized));
  } catch {
    return null;
  }
}

// A fresh 0600 file renamed into place: no torn reads, and an old file's looser permissions never carry over.
export async function writeStoredCredentials(credentials: StoredCredentials): Promise<void> {
  const filePath = credentialsFilePath();
  const directory = dirname(filePath);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(temporaryPath, JSON.stringify(credentials), { mode: 0o600, flag: "wx" });

  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });

    throw error;
  }
}

export async function clearStoredCredentials(): Promise<void> {
  await rm(credentialsFilePath(), { force: true });
}
