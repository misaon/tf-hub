import { ofetch, type FetchError } from "ofetch";
import { z } from "zod";

import { secureTokenEndpoint } from "../config.ts";
import { isTokenExpiringSoon } from "./jwt.ts";
import { readStoredCredentials, writeStoredCredentials } from "./store.ts";

const secureTokenResponseSchema = z.object({
  id_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.string(),
});

export interface RefreshedToken {
  idToken: string;
  refreshToken: string;
  expiresAtMs: number;
}

export async function refreshIdToken(apiKey: string, refreshToken: string): Promise<RefreshedToken> {
  const rawResponse = await ofetch(secureTokenEndpoint, {
    method: "POST",
    query: { key: apiKey },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  }).catch((error: FetchError) => {
    if (error.status === 400 || error.status === 401 || error.status === 403) {
      throw new Error("Your session has expired or was revoked — run `tf-hub login`.", { cause: error });
    }

    throw new Error(`Token refresh failed (HTTP ${error.status ?? "?"}).`, { cause: error });
  });

  const parsed = secureTokenResponseSchema.safeParse(rawResponse);

  if (!parsed.success) {
    throw new Error("Unexpected response from the token service — try `tf-hub login` again.", { cause: parsed.error });
  }

  const response = parsed.data;

  return {
    idToken: response.id_token,
    refreshToken: response.refresh_token,
    expiresAtMs: Date.now() + Number(response.expires_in) * 1000,
  };
}

export async function getValidIdToken(): Promise<string> {
  const credentials = await readStoredCredentials();

  if (!credentials) {
    throw new Error("Not logged in. Run `tf-hub login`.");
  }

  if (credentials.idToken && credentials.idTokenExpiresAtMs && !isTokenExpiringSoon(credentials.idTokenExpiresAtMs)) {
    return credentials.idToken;
  }

  const refreshed = await refreshIdToken(credentials.apiKey, credentials.refreshToken);

  await writeStoredCredentials({
    apiKey: credentials.apiKey,
    refreshToken: refreshed.refreshToken,
    idToken: refreshed.idToken,
    idTokenExpiresAtMs: refreshed.expiresAtMs,
  });

  return refreshed.idToken;
}
