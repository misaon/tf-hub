import { describe, expect, it } from "bun:test";

import { decodeJwtClaims } from "../src/auth/jwt.ts";
import { makeJwt } from "./support.ts";

describe("decodeJwtClaims", () => {
  it("decodes claims, preserving UTF-8 names and Firebase metadata", () => {
    const token = makeJwt({
      name: "Žofie Křížová",
      email: "email@ondrejmisak.cz",
      exp: 1_781_031_026,
      firebase: { tenant: "tenant-1", sign_in_provider: "google.com" },
    });

    const claims = decodeJwtClaims(token);

    expect(claims.name).toBe("Žofie Křížová");
    expect(claims.email).toBe("email@ondrejmisak.cz");
    expect(claims.exp).toBe(1_781_031_026);
    expect(claims.firebase?.tenant).toBe("tenant-1");
    expect(claims.firebase?.sign_in_provider).toBe("google.com");
  });

  it("throws on a token without a payload segment", () => {
    expect(() => decodeJwtClaims("not-a-jwt")).toThrow(/payload/u);
  });
});
