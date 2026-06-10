import { describe, expect, it } from "bun:test";

import { acquireSession } from "../src/auth/session.ts";
import { firebasePublicApiKey } from "../src/config.ts";
import { makeJwt } from "./support.ts";

describe("acquireSession", () => {
  it("maps the browser login result into stored credentials with the token expiry", async () => {
    const idToken = makeJwt({ name: "Tester", exp: 1_900_000_000 });
    const session = await acquireSession(() => Promise.resolve({ idToken, refreshToken: "RT-123" }));

    expect(session.apiKey).toBe(firebasePublicApiKey);
    expect(session.idToken).toBe(idToken);
    expect(session.refreshToken).toBe("RT-123");
    expect(session.idTokenExpiresAtMs).toBe(1_900_000_000 * 1000);
  });
});
