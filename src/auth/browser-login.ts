import { consola } from "consola";
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

  const server = Bun.serve({
    port: 0,
    hostname: "localhost",
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/" && request.method === "GET") {
        return new Response(buildLoginPage(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      if (url.pathname === "/callback" && request.method === "POST") {
        if (!request.headers.get("content-type")?.includes("application/json")) {
          return new Response("Unsupported Media Type", { status: 415 });
        }

        const payload = callbackPayloadSchema.safeParse(await request.json().catch(() => null));

        if (!payload.success) {
          rejectResult(new Error("Incomplete response from the browser."));

          return new Response("Bad Request", { status: 400 });
        }

        if ("error" in payload.data) {
          rejectResult(new Error(payload.data.error));
        } else {
          resolveResult(payload.data);
        }

        return new Response("OK");
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const loginUrl = `http://localhost:${server.port}/`;

  consola.info(`Opening browser: ${loginUrl}`);
  launchBrowser(loginUrl);
  consola.start("Waiting for sign-in to complete in the browser…");

  try {
    return await resultPromise;
  } finally {
    await server.stop();
  }
}
