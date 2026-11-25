import { randomBytes, timingSafeEqual } from "node:crypto";
import { consola } from "consola";
import { H3, HTTPError, html, raw, readValidatedBody, serve } from "h3";
import open from "open";
import { z } from "zod";

import {
  firebaseAuthDomain,
  firebaseProjectId,
  firebasePublicApiKey,
  firebaseSdkBaseUrl,
  firebaseSdkModules,
  firebaseTenantId,
  loginPageCdnScripts,
  loginTimeoutMs,
} from "../config.ts";
import loginHtml from "./login.html" with { type: "text" };

export interface BrowserLoginResult {
  idToken: string;
  refreshToken: string;
}

const callbackPayloadSchema = z.union([
  z.object({ error: z.string().min(1) }),
  z.object({ idToken: z.string().min(1), refreshToken: z.string().min(1) }),
]);

export const loginNonceHeaderName = "x-login-nonce";

export function buildLoginPage(nonce: string): string {
  const config = {
    apiKey: firebasePublicApiKey,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
    tenantId: firebaseTenantId,
  };
  const scriptTags = loginPageCdnScripts
    .map(({ src, integrity }) => `<script src="${src}" integrity="${integrity}" crossorigin="anonymous"></script>`)
    .join("\n    ");
  const importMap = { integrity: Object.fromEntries(firebaseSdkModules.map(({ src, integrity }) => [src, integrity])) };

  return loginHtml
    .replace("__IMPORT_MAP__", () => JSON.stringify(importMap))
    .replace("__CDN_SCRIPTS__", () => scriptTags)
    .replaceAll("__FIREBASE_SDK_URL__", () => firebaseSdkBaseUrl)
    .replace("__FIREBASE_CONFIG__", () => JSON.stringify(config))
    .replace("__LOGIN_NONCE_HEADER__", () => JSON.stringify(loginNonceHeaderName))
    .replace("__LOGIN_NONCE__", () => JSON.stringify(nonce));
}

function matchesSecret(presented: string, expected: string): boolean {
  const presentedBytes = Buffer.from(presented);
  const expectedBytes = Buffer.from(expected);

  return presentedBytes.length === expectedBytes.length && timingSafeEqual(presentedBytes, expectedBytes);
}

// Only the page this process served may post tokens: other local pages, DNS rebinding and
// CORS-simple requests fail the host, origin or nonce check, and the custom header forces a preflight.
function assertTrustedCallback(headers: Headers, port: string, nonce: string): void {
  const mediaType = headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();

  if (mediaType !== "application/json") {
    throw new HTTPError({ status: 415 });
  }

  const trusted =
    headers.get("host") === `localhost:${port}` &&
    headers.get("origin") === `http://localhost:${port}` &&
    matchesSecret(headers.get(loginNonceHeaderName) ?? "", nonce);

  if (!trusted) {
    throw new HTTPError({ status: 403 });
  }
}

function openInBrowser(url: string): void {
  void open(url).catch(() => consola.warn(`Could not open a browser. Open this URL manually:\n${url}`));
}

export async function performBrowserLogin(
  launchBrowser: (url: string) => void = openInBrowser,
  timeoutMs = loginTimeoutMs,
): Promise<BrowserLoginResult> {
  const {
    promise: resultPromise,
    resolve: resolveResult,
    reject: rejectResult,
  } = Promise.withResolvers<BrowserLoginResult>();
  const nonce = randomBytes(32).toString("base64url");
  let boundPort = "";

  const app = new H3()
    .get(`/${nonce}`, () => html(raw(buildLoginPage(nonce))))
    .post("/callback", async (event) => {
      assertTrustedCallback(event.req.headers, boundPort, nonce);

      // A malformed request (another local process, a stray probe) must not kill the pending sign-in.
      const payload = await readValidatedBody(event, callbackPayloadSchema);

      if ("error" in payload) {
        rejectResult(new Error(payload.error));
      } else {
        resolveResult(payload);
      }

      return "OK";
    });

  const server = await serve(app, {
    port: 0,
    hostname: "localhost",
    silent: true,
    gracefulShutdown: false,
  }).ready();

  const deadline = setTimeout(() => {
    const minutes = Math.round(timeoutMs / 60_000);

    rejectResult(new Error(`Sign-in was not completed within ${minutes} minutes. Run \`tf-hub login\` again.`));
  }, timeoutMs);

  try {
    boundPort = server.url ? new URL(server.url).port : "";

    if (boundPort === "") {
      throw new Error("Could not determine the local login server port.");
    }

    // Firebase only authorizes the literal `localhost` origin, so never hand the browser the raw bound address.
    const loginUrl = `http://localhost:${boundPort}/${nonce}`;

    consola.info(`Opening browser: ${loginUrl}`);
    launchBrowser(loginUrl);
    consola.start("Waiting for sign-in to complete in the browser… Press Ctrl+C to cancel.");

    return await resultPromise;
  } finally {
    clearTimeout(deadline);

    // Graceful close lets the final callback response flush; the timer force-closes lingering connections.
    const forceCloseTimer = setTimeout(() => void server.close(true), 1000);

    await server.close();
    clearTimeout(forceCloseTimer);
  }
}
