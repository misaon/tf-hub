import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

const storedCredentialsSchema = z.object({
  apiKey: z.string(),
  refreshToken: z.string(),
  idToken: z.string().optional(),
  idTokenExpiresAtMs: z.number().optional(),
});
export type StoredCredentials = z.infer<typeof storedCredentialsSchema>;

// Owner-only credentials file — the same storage model npm, gcloud and docker use.
function credentialsFilePath(): string {
  const configDirectory = process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config");

  return join(configDirectory, "tf-hub", "credentials.json");
}

async function readCredentialsFile(): Promise<string | null> {
  try {
    return await readFile(credentialsFilePath(), "utf8");
  } catch {
    return null;
  }
}

export async function readStoredCredentials(): Promise<StoredCredentials | null> {
  const serialized = await readCredentialsFile();

  return serialized ? storedCredentialsSchema.parse(JSON.parse(serialized)) : null;
}

export async function writeStoredCredentials(credentials: StoredCredentials): Promise<void> {
  const filePath = credentialsFilePath();

  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, JSON.stringify(credentials), { mode: 0o600 });
}

export async function clearStoredCredentials(): Promise<void> {
  await rm(credentialsFilePath(), { force: true });
}
