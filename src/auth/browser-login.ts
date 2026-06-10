import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
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

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

interface Reply {
  status: number;
  body: string;
  contentType?: string;
}

function respond(response: ServerResponse, { status, body, contentType = "text/plain" }: Reply): void {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
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

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.url === "/" && request.method === "GET") {
      respond(response, { status: 200, body: buildLoginPage(), contentType: "text/html; charset=utf-8" });

      return;
    }

    if (request.url === "/callback" && request.method === "POST") {
      if (!request.headers["content-type"]?.includes("application/json")) {
        respond(response, { status: 415, body: "Unsupported Media Type" });

        return;
      }

      const payload = callbackPayloadSchema.safeParse(await readJsonBody(request));

      if (!payload.success) {
        rejectResult(new Error("Incomplete response from the browser."));
        respond(response, { status: 400, body: "Bad Request" });

        return;
      }

      if ("error" in payload.data) {
        rejectResult(new Error(payload.data.error));
      } else {
        resolveResult(payload.data);
      }

      respond(response, { status: 200, body: "OK" });

      return;
    }

    respond(response, { status: 404, body: "Not found" });
  }

  server.listen(0, "localhost");
  await once(server, "listening");

  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not determine the local login server port.");
  }

  const loginUrl = `http://localhost:${address.port}/`;

  consola.info(`Opening browser: ${loginUrl}`);
  launchBrowser(loginUrl);
  consola.start("Waiting for sign-in to complete in the browser…");

  try {
    return await resultPromise;
  } finally {
    server.closeAllConnections();
    server.close();
  }
}
