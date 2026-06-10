import { consola } from "consola";
import { H3, HTTPError, html, readValidatedBody, serve } from "h3";
import open from "open";
import { z } from "zod";

import {
  firebaseAuthDomain,
  firebaseProjectId,
  firebasePublicApiKey,
  firebaseSdkBaseUrl,
  firebaseTenantId,
  loginPageCdnScripts,
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

export function buildLoginPage(): string {
  const config = {
    apiKey: firebasePublicApiKey,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
    tenantId: firebaseTenantId,
  };
  const scriptTags = loginPageCdnScripts
    .map(({ src, integrity }) => `<script src="${src}" integrity="${integrity}" crossorigin="anonymous"></script>`)
    .join("\n    ");

  return loginHtml
    .replace("__CDN_SCRIPTS__", scriptTags)
    .replaceAll("__FIREBASE_SDK_URL__", firebaseSdkBaseUrl)
    .replace("__FIREBASE_CONFIG__", JSON.stringify(config));
}

export async function performBrowserLogin(
  launchBrowser: (url: string) => void = (url) =>
    void open(url).catch(() => consola.warn(`Couldn't open a browser. Open this URL manually:\n${url}`)),
): Promise<BrowserLoginResult> {
  const {
    promise: resultPromise,
    resolve: resolveResult,
    reject: rejectResult,
  } = Promise.withResolvers<BrowserLoginResult>();

  const app = new H3()
    .get("/", () => html(buildLoginPage()))
    .post("/callback", async (event) => {
      if (!event.req.headers.get("content-type")?.includes("application/json")) {
        throw new HTTPError({ status: 415 });
      }

      const payload = await readValidatedBody(event, callbackPayloadSchema).catch((error: unknown) => {
        rejectResult(new Error("Incomplete response from the browser."));
        throw error;
      });

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

  try {
    const boundPort = server.url ? new URL(server.url).port : "";

    if (boundPort === "") {
      throw new Error("Could not determine the local login server port.");
    }

    // Firebase only authorizes the literal `localhost` origin, so never hand the browser the raw bound address.
    const loginUrl = `http://localhost:${boundPort}/`;

    consola.info(`Opening browser: ${loginUrl}`);
    launchBrowser(loginUrl);
    consola.start("Waiting for sign-in to complete in the browser…");

    return await resultPromise;
  } finally {
    // Graceful close lets the final callback response flush; the timer force-closes lingering connections.
    const forceCloseTimer = setTimeout(() => void server.close(true), 1000);

    await server.close();
    clearTimeout(forceCloseTimer);
  }
}
