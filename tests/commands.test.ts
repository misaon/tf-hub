import { EventEmitter } from "node:events";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { runCommand } from "citty";
import { consola } from "consola";

import { gameDomain } from "../src/domains/game/index.ts";
import { loginCommand } from "../src/commands/login.ts";
import { logoutCommand } from "../src/commands/logout.ts";
import { mcpServerCommand } from "../src/commands/mcp-server.ts";
import { updateCommand } from "../src/commands/update.ts";
import { readStoredCredentials } from "../src/auth/store.ts";
import { jsonResponse, makeJwt, mockFetch, seedValidSession } from "./support.ts";

let spawnImplementation: () => unknown = () => {
  throw new Error("The update command must not spawn an installer in tests.");
};
const spawnGuard = mock(() => spawnImplementation());
mock.module("node:child_process", () => ({ spawn: spawnGuard }));

describe("logout command", () => {
  it("informs and changes nothing when already logged out", async () => {
    const info = spyOn(consola, "info").mockReturnValue(undefined);
    const success = spyOn(consola, "success").mockReturnValue(undefined);

    await runCommand(logoutCommand, { rawArgs: [] });

    expect(info).toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("clears the stored session when logged in", async () => {
    await seedValidSession();
    const success = spyOn(consola, "success").mockReturnValue(undefined);

    await runCommand(logoutCommand, { rawArgs: [] });

    expect(success).toHaveBeenCalled();
    expect(await readStoredCredentials()).toBeNull();
  });
});

describe("login command", () => {
  it("does not start a new login when a session already exists", async () => {
    await seedValidSession({ idToken: makeJwt({ name: "Tester" }) });

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

    await runCommand(updateCommand, { rawArgs: [] });

    expect(success).toHaveBeenCalledWith(expect.stringContaining("up to date"));
    expect(spawnGuard).not.toHaveBeenCalled();
  });

  it("runs the package-manager install when an update exists", async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ version: "99.0.0" })));

    const info = spyOn(consola, "info").mockReturnValue(undefined);
    const success = spyOn(consola, "success").mockReturnValue(undefined);
    // oxlint-disable-next-line unicorn/prefer-event-target -- a spawned child process is an EventEmitter
    const installer = new EventEmitter();
    spawnImplementation = () => {
      setTimeout(() => installer.emit("exit", 0), 0);

      return installer;
    };

    await runCommand(updateCommand, { rawArgs: [] });
    spawnImplementation = () => {
      throw new Error("The update command must not spawn an installer in tests.");
    };

    expect(info).toHaveBeenCalledWith(expect.stringContaining("99.0.0"));
    expect(success).toHaveBeenCalledWith(expect.stringContaining("99.0.0"));
  });

  it("reports a failed installer with a nonzero exit code", async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ version: "99.0.0" })));

    spyOn(consola, "info").mockReturnValue(undefined);
    const error = spyOn(consola, "error").mockReturnValue(undefined);
    // oxlint-disable-next-line unicorn/prefer-event-target -- a spawned child process is an EventEmitter
    const installer = new EventEmitter();
    spawnImplementation = () => {
      setTimeout(() => installer.emit("exit", 1), 0);

      return installer;
    };

    await runCommand(updateCommand, { rawArgs: [] });
    spawnImplementation = () => {
      throw new Error("The update command must not spawn an installer in tests.");
    };

    expect(error).toHaveBeenCalledWith(expect.stringContaining("exit code 1"));
    expect(process.exitCode).toBe(1);
  });

  it("errors cleanly when the registry is unreachable", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));

    const error = spyOn(consola, "error").mockReturnValue(undefined);

    await runCommand(updateCommand, { rawArgs: [] });

    expect(error).toHaveBeenCalledWith(expect.stringContaining("npm registry"));
    expect(process.exitCode).toBe(1);
  });
});
