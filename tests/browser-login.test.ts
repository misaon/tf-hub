import { describe, expect, it } from "bun:test";

import { buildLoginPage, performBrowserLogin } from "../src/auth/browser-login.ts";
import { firebasePublicApiKey, firebaseTenantId } from "../src/config.ts";

function postCallback(baseUrl: string, payload: Record<string, string>): Promise<Response> {
  return fetch(new URL("/callback", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("buildLoginPage", () => {
  it("injects the Firebase config and wires the page to the local /callback", () => {
    const page = buildLoginPage();

    expect(page).not.toContain("__FIREBASE_CONFIG__");
    expect(page).not.toContain("__CDN_SCRIPTS__");
    expect(page).not.toContain("__FIREBASE_SDK_URL__");
    expect(page).toContain("integrity=");
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

  it("refuses non-JSON posts so a foreign page cannot inject tokens", async () => {
    let blockedStatus = 0;

    const result = await performBrowserLogin((url) => {
      void (async () => {
        const blocked = await fetch(new URL("/callback", url), {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: JSON.stringify({ idToken: "EVIL", refreshToken: "EVIL" }),
        });

        blockedStatus = blocked.status;

        await postCallback(url, { idToken: "ID", refreshToken: "RT" });
      })();
    });

    expect(blockedStatus).toBe(415);
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
