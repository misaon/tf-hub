import { z } from "zod";

const storedCredentialsSchema = z.object({
  apiKey: z.string(),
  refreshToken: z.string(),
  idToken: z.string().optional(),
  idTokenExpiresAtMs: z.number().optional(),
});
export type StoredCredentials = z.infer<typeof storedCredentialsSchema>;

const service = "com.misaon.tf-hub";
const name = "session";

export async function readStoredCredentials(): Promise<StoredCredentials | null> {
  const serialized = await Bun.secrets.get({ service, name });

  return serialized ? storedCredentialsSchema.parse(JSON.parse(serialized)) : null;
}

export async function writeStoredCredentials(credentials: StoredCredentials): Promise<void> {
  await Bun.secrets.set({ service, name, value: JSON.stringify(credentials) });
}

export async function clearStoredCredentials(): Promise<void> {
  await Bun.secrets.delete({ service, name });
}
