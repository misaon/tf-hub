import { describe, expect, it, spyOn } from "bun:test";
import { runCommand } from "citty";
import { consola } from "consola";

import { gameDomain } from "../src/domains/game/index.ts";
import { loginCommand } from "../src/commands/login.ts";
import { logoutCommand } from "../src/commands/logout.ts";
import { mcpServerCommand } from "../src/commands/mcp-server.ts";
import { updateCommand } from "../src/commands/update.ts";
import { readStoredCredentials, writeStoredCredentials } from "../src/auth/store.ts";
import { jsonResponse, makeJwt, mockFetch } from "./support.ts";

describe("logout command", () => {
  it("informs and changes nothing when already logged out", async () => {
    const info = spyOn(consola, "info").mockReturnValue(undefined);
    const success = spyOn(consola, "success").mockReturnValue(undefined);

    await runCommand(logoutCommand, { rawArgs: [] });

    expect(info).toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("clears the stored session when logged in", async () => {
    await writeStoredCredentials({
      apiKey: "k",
      refreshToken: "r",
      idToken: "x",
      idTokenExpiresAtMs: Date.now() + 3_600_000,
    });
    const success = spyOn(consola, "success").mockReturnValue(undefined);

    await runCommand(logoutCommand, { rawArgs: [] });

    expect(success).toHaveBeenCalled();
    expect(await readStoredCredentials()).toBeNull();
  });
});

describe("login command", () => {
  it("does not start a new login when a session already exists", async () => {
    await writeStoredCredentials({
      apiKey: "k",
      refreshToken: "r",
      idToken: makeJwt({ name: "Tester" }),
      idTokenExpiresAtMs: Date.now() + 3_600_000,
    });

    const info = spyOn(consola, "info").mockReturnValue(undefined);
    const serveSpy = spyOn(Bun, "serve");

    await runCommand(loginCommand, { rawArgs: [] });

    expect(info).toHaveBeenCalledWith(expect.stringContaining("Already logged in"));
    expect(serveSpy).not.toHaveBeenCalled();
  });
});

describe("error handling", () => {
  it("rejects invalid input via consola and sets a non-zero exit code", async () => {
    const error = spyOn(consola, "error").mockReturnValue(undefined);

    await runCommand(gameDomain.command, { rawArgs: ["show", "not-a-month"] });
    await runCommand(gameDomain.command, { rawArgs: ["show", "2026-13"] });

    expect(error).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBe(1);
  });
});

describe("mcp-server command", () => {
  it("refuses to start without a stored session", async () => {
    const error = spyOn(consola, "error").mockReturnValue(undefined);

    await runCommand(mcpServerCommand, { rawArgs: [] });

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Not logged in"));
    expect(process.exitCode).toBe(1);
  });
});

describe("update command", () => {
  it("reports up to date without spawning an installer", async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ version: "0.0.1" })));

    const success = spyOn(consola, "success").mockReturnValue(undefined);
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(() => {
      throw new Error("must not spawn");
    });

    await runCommand(updateCommand, { rawArgs: [] });

    expect(success).toHaveBeenCalledWith(expect.stringContaining("up to date"));
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it("errors cleanly when the registry is unreachable", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));

    const error = spyOn(consola, "error").mockReturnValue(undefined);

    await runCommand(updateCommand, { rawArgs: [] });

    expect(error).toHaveBeenCalledWith(expect.stringContaining("npm registry"));
    expect(process.exitCode).toBe(1);
  });
});
