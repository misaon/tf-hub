import { FetchError, ofetch } from "ofetch";
import { z } from "zod";

import { apiRequestTimeoutMs, secureTokenEndpoint } from "../config.ts";
import { isTokenExpiringSoon } from "./jwt.ts";
import { readStoredCredentials, writeStoredCredentials, type StoredCredentials } from "./store.ts";

const secureTokenResponseSchema = z.object({
  id_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.coerce.number().int().positive(),
});

const sessionEndedStatuses = new Set([400, 401, 403]);

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
    timeout: apiRequestTimeoutMs,
  }).catch((error: unknown) => {
    const status = error instanceof FetchError ? error.status : undefined;

    if (status !== undefined && sessionEndedStatuses.has(status)) {
      throw new Error("Your session has expired or was revoked — run `tf-hub login`.", { cause: error });
    }

    throw new Error(`Token refresh failed (${status === undefined ? "network error or timeout" : `HTTP ${status}`}).`, {
      cause: error,
    });
  });

  const parsed = secureTokenResponseSchema.safeParse(rawResponse);

  if (!parsed.success) {
    throw new Error("Unexpected response from the token service — try `tf-hub login` again.", { cause: parsed.error });
  }

  const response = parsed.data;

  return {
    idToken: response.id_token,
    refreshToken: response.refresh_token,
    expiresAtMs: Date.now() + response.expires_in * 1000,
  };
}

function freshIdToken(credentials: StoredCredentials): string | undefined {
  const { idToken, idTokenExpiresAtMs } = credentials;

  return idToken && idTokenExpiresAtMs && !isTokenExpiringSoon(idTokenExpiresAtMs) ? idToken : undefined;
}

async function refreshStoredSession(staleCredentials: StoredCredentials): Promise<string> {
  // Another caller may have refreshed between our read and now; reuse its token instead of refreshing again.
  const credentials = (await readStoredCredentials()) ?? staleCredentials;
  const alreadyFresh = freshIdToken(credentials);

  if (alreadyFresh !== undefined) {
    return alreadyFresh;
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

// Parallel MCP tool calls at expiry share one refresh instead of racing to rotate the refresh token.
let pendingRefresh: Promise<string> | null = null;

export async function getValidIdToken(): Promise<string> {
  const credentials = await readStoredCredentials();

  if (!credentials) {
    throw new Error("Not logged in. Run `tf-hub login`.");
  }

  const cachedIdToken = freshIdToken(credentials);

  if (cachedIdToken !== undefined) {
    return cachedIdToken;
  }

  pendingRefresh ??= refreshStoredSession(credentials).finally(() => {
    pendingRefresh = null;
  });

  return pendingRefresh;
}
