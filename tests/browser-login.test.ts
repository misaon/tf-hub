import { describe, expect, it } from "bun:test";

import { buildLoginPage, loginNonceHeaderName, performBrowserLogin } from "../src/auth/browser-login.ts";
import { firebasePublicApiKey, firebaseTenantId } from "../src/config.ts";

function postCallback(
  loginUrl: string,
  payload: Record<string, string>,
  headerOverrides: Record<string, string> = {},
): Promise<Response> {
  const { origin, pathname } = new URL(loginUrl);

  return fetch(new URL("/callback", loginUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      [loginNonceHeaderName]: pathname.slice(1),
      ...headerOverrides,
    },
    body: JSON.stringify(payload),
  });
}

describe("buildLoginPage", () => {
  it("injects the Firebase config, the nonce and integrity pins, and wires the page to the local /callback", () => {
    const page = buildLoginPage("NONCE-$&");

    expect(page).not.toMatch(/__[A-Z_]+__/u);
    expect(page).toContain('"NONCE-$&"');
    expect(page).toContain("integrity=");
    expect(page).toContain('"integrity":{"https://www.gstatic.com/');
    expect(page).toContain(firebasePublicApiKey);
    expect(page).toContain(firebaseTenantId);
    expect(page).toContain("/callback");
  });
});

describe("performBrowserLogin", () => {
  it("resolves with the tokens the page posts to /callback", async () => {
    const result = await performBrowserLogin((url) => {
      void postCallback(url, { idToken: "ID", refreshToken: "RT" });
    });

    expect(result).toEqual({ idToken: "ID", refreshToken: "RT" });
  });

  it.each([
    ["a CORS-simple content type", { "content-type": "text/plain; x=application/json" }, 415],
    ["a foreign origin", { origin: "https://evil.example" }, 403],
    ["a rebound host name", { host: "evil.example" }, 403],
    ["a missing nonce", { [loginNonceHeaderName]: "" }, 403],
    ["a wrong nonce", { [loginNonceHeaderName]: "guessed" }, 403],
  ])("refuses callbacks with %s so a foreign page cannot inject tokens", async (_case, headers, status) => {
    let blockedStatus = 0;

    const result = await performBrowserLogin((url) => {
      void (async () => {
        const blocked = await postCallback(url, { idToken: "EVIL", refreshToken: "EVIL" }, headers);

        blockedStatus = blocked.status;

        await postCallback(url, { idToken: "ID", refreshToken: "RT" });
      })();
    });

    expect(blockedStatus).toBe(status);
    expect(result).toEqual({ idToken: "ID", refreshToken: "RT" });
  });

  it("serves the unescaped login page only under the per-login nonce path", async () => {
    let rootStatus = 0;
    let page = "";

    await performBrowserLogin((url) => {
      void (async () => {
        const rootResponse = await fetch(new URL("/", url));
        const pageResponse = await fetch(url);

        rootStatus = rootResponse.status;
        page = await pageResponse.text();

        await postCallback(url, { idToken: "ID", refreshToken: "RT" });
      })();
    });

    expect(rootStatus).toBe(404);
    expect(page).toStartWith("<!doctype html>");
  });

  it("gives up when the sign-in is not completed in time", async () => {
    await expect(performBrowserLogin(() => undefined, 20)).rejects.toThrow(/not completed within/u);
  });

  it("survives a malformed callback payload and still completes the sign-in", async () => {
    let malformedStatus = 0;

    const result = await performBrowserLogin((url) => {
      void (async () => {
        const malformed = await postCallback(url, { idToken: "" });

        malformedStatus = malformed.status;

        await postCallback(url, { idToken: "ID", refreshToken: "RT" });
      })();
    });

    expect(malformedStatus).toBe(400);
    expect(result).toEqual({ idToken: "ID", refreshToken: "RT" });
  });

  it("rejects when the page reports a sign-in error", async () => {
    await expect(
      performBrowserLogin((url) => {
        void postCallback(url, { error: "popup_closed_by_user" });
      }),
    ).rejects.toThrow(/popup_closed_by_user/u);
  });
});
