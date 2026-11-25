import { describe, expect, it, spyOn } from "bun:test";

import { callApi } from "../src/api/client.ts";
import { apiBaseUrl, idTokenHeaderName, webApplicationOrigin } from "../src/config.ts";

import { jsonResponse, mockFetch, seedValidSession } from "./support.ts";

const probePath = "/tf/hub/v3/tf/probe";

describe("callApi", () => {
  it("passes an envelope-less response through unchanged", async () => {
    await seedValidSession();
    spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ status: "deleted" }));

    expect(await callApi("/tf/hub/v3/tf/substitute-groups/1", { method: "DELETE" })).toEqual({ status: "deleted" });
  });

  it("authenticates with the configured identity header and returns the unwrapped data", async () => {
    await seedValidSession();

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "OK", data: { ok: true } }));
    const data = await callApi("/tf/hub/v2/ping");

    expect(data).toEqual({ ok: true });

    const [requestUrl, requestInit] = fetchSpy.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${apiBaseUrl}/tf/hub/v2/ping`);

    const headers = new Headers(requestInit?.headers);
    expect(headers.get(idTokenHeaderName)).toBe("ID");
    expect(headers.get("origin")).toBe(webApplicationOrigin);
  });

  it("advises a fresh login on 401", async () => {
    await seedValidSession();
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("unauthorized", { status: 401 }));

    await expect(callApi(probePath)).rejects.toThrow(/failed \(HTTP 401\).*run `tf-hub login`/u);
  });

  it("explains a missing permission on 403 with the server detail, without a login hint", async () => {
    await seedValidSession();
    spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Insufficient permissions", statusCode: 403 }, 403),
    );

    const failure = await callApi(probePath).catch((error: Error) => error.message);

    expect(failure).toContain("failed (HTTP 403). Insufficient permissions.");
    expect(failure).toContain("missing the TF Hub permission");
    expect(failure).not.toContain("tf-hub login");
  });

  it("includes the server validation message in the error", async () => {
    await seedValidSession();
    spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: ["hours must be a number", "type must be valid"], statusCode: 400 }, 400),
    );

    await expect(callApi(probePath)).rejects.toThrow(/hours must be a number; type must be valid/u);
  });

  it("sends JSON bodies and drops undefined query values", async () => {
    await seedValidSession();

    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "OK", data: { ok: true } }));

    await callApi("/tf/hub/v2/things", {
      method: "POST",
      query: { limit: 5, skip: undefined },
      body: { name: "x" },
    });

    const [requestUrl, requestInit] = fetchSpy.mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain("limit=5");
    expect(String(requestUrl)).not.toContain("skip");
    expect(requestInit?.method).toBe("POST");
    expect(JSON.parse(String(requestInit?.body))).toEqual({ name: "x" });
  });

  it.each([
    [404, "does not exist or is not visible to you"],
    [503, "unavailable right now"],
  ])("adds next-step advice to HTTP %i failures", async (status, advice) => {
    await seedValidSession();
    mockFetch(() => Promise.resolve(new Response("failure", { status })));

    await expect(callApi(probePath)).rejects.toThrow(advice);
  });

  it("refuses paths outside the TF Hub gateway so the ID token never reaches another host", async () => {
    await seedValidSession();
    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: {} })));

    await expect(callApi("https://attacker.example/collect")).rejects.toThrow(/outside the TF Hub API/u);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("surfaces an auth error without making a request", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "OK", data: {} }));

    await expect(callApi(probePath)).rejects.toThrow(/Not logged in/u);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
