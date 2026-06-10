import { firebasePublicApiKey } from "../config.ts";
import { type BrowserLoginResult, performBrowserLogin } from "./browser-login.ts";
import { expiryMsFromIdToken } from "./jwt.ts";
import type { StoredCredentials } from "./store.ts";

export type AcquiredSession = StoredCredentials & { idToken: string };

export async function acquireSession(
  login: () => Promise<BrowserLoginResult> = performBrowserLogin,
): Promise<AcquiredSession> {
  const { idToken, refreshToken } = await login();

  return {
    apiKey: firebasePublicApiKey,
    idToken,
    refreshToken,
    idTokenExpiresAtMs: expiryMsFromIdToken(idToken),
  };
}
