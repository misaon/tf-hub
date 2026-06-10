import { describe, expect, it, spyOn } from "bun:test";

import { readStoredCredentials } from "../src/auth/store.ts";
import { getValidIdToken, refreshIdToken } from "../src/auth/tokens.ts";
import { jsonResponse, seedValidSession } from "./support.ts";

const oneHourMs = 3_600_000;

describe("refreshIdToken", () => {
  it("exchanges the refresh token at the Secure Token Service and returns the new tokens", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ id_token: "NEW_ID", refresh_token: "NEW_RT", expires_in: "3600" }),
    );

    const result = await refreshIdToken("API_KEY", "OLD_RT");

    expect(result).toEqual({
      idToken: "NEW_ID",
      refreshToken: "NEW_RT",
      expiresAtMs: expect.any(Number),
    });

    const [requestUrl, requestInit] = fetchSpy.mock.calls[0]!;

    expect(String(requestUrl)).toContain("securetoken.googleapis.com");
    expect(String(requestUrl)).toContain("key=API_KEY");
    expect(requestInit?.method).toBe("POST");
    expect(String(requestInit?.body)).toContain("grant_type=refresh_token");
    expect(String(requestInit?.body)).toContain("refresh_token=OLD_RT");
  });

  it("asks for a new login when the session is expired or revoked", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
    await expect(refreshIdToken("k", "r")).rejects.toThrow(/session has expired or was revoked/u);
  });

  it("throws with the HTTP status on other refresh failures", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(refreshIdToken("k", "r")).rejects.toThrow(/Token refresh failed \(HTTP 500\)/u);
  });
});

describe("getValidIdToken", () => {
  it("returns the cached token without a network call when it is still valid", async () => {
    await seedValidSession({ idToken: "CACHED", idTokenExpiresAtMs: Date.now() + oneHourMs });

    const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not refresh"));

    expect(await getValidIdToken()).toBe("CACHED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes when the token is within the expiry safety window", async () => {
    await seedValidSession({ refreshToken: "OLD", idToken: "OLD_ID", idTokenExpiresAtMs: Date.now() + 30_000 });
    spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ id_token: "FRESH", refresh_token: "NEW", expires_in: "3600" }),
    );

    expect(await getValidIdToken()).toBe("FRESH");
  });

  it("refreshes and persists the new token when the cached one expired", async () => {
    await seedValidSession({ refreshToken: "OLD", idToken: "OLD_ID", idTokenExpiresAtMs: Date.now() - 1000 });
    spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ id_token: "FRESH", refresh_token: "NEW", expires_in: "3600" }),
    );

    expect(await getValidIdToken()).toBe("FRESH");

    const stored = await readStoredCredentials();
    expect(stored?.idToken).toBe("FRESH");
    expect(stored?.refreshToken).toBe("NEW");
  });

  it("throws when there is no stored session", async () => {
    await expect(getValidIdToken()).rejects.toThrow(/Not logged in/u);
  });
});
