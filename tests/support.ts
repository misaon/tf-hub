import { spyOn, type Mock } from "bun:test";

import { writeStoredCredentials, type StoredCredentials } from "../src/auth/store.ts";

export function seedValidSession(overrides: Partial<StoredCredentials> = {}): Promise<void> {
  return writeStoredCredentials({
    apiKey: "k",
    refreshToken: "r",
    idToken: "ID",
    idTokenExpiresAtMs: Date.now() + 3_600_000,
    ...overrides,
  });
}

type FetchImplementation = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Promise<Response>;

export function mockFetch(implementation: FetchImplementation): Mock<typeof fetch> {
  return spyOn(globalThis, "fetch").mockImplementation(Object.assign(implementation, { preconnect: fetch.preconnect }));
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, { status });
}

const encodeJwtSegment = (value: object): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

export function makeJwt(payload: object): string {
  return `${encodeJwtSegment({ alg: "RS256", typ: "JWT" })}.${encodeJwtSegment(payload)}.signature`;
}
