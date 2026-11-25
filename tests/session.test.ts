import { mkdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "bun:test";

import { acquireSession } from "../src/auth/session.ts";
import { credentialsFilePath, readStoredCredentials, writeStoredCredentials } from "../src/auth/store.ts";
import { firebasePublicApiKey } from "../src/config.ts";
import { configDirectory } from "../src/user-directories.ts";
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

describe("readStoredCredentials", () => {
  it("treats a corrupted credentials file as logged out so recovery commands keep working", async () => {
    await mkdir(dirname(credentialsFilePath()), { recursive: true });
    await writeFile(credentialsFilePath(), "{ truncated");

    expect(await readStoredCredentials()).toBeNull();
  });
});

describe("writeStoredCredentials", () => {
  it.skipIf(process.platform === "win32")(
    "replaces a credentials file that has looser permissions with an owner-only one",
    async () => {
      await mkdir(dirname(credentialsFilePath()), { recursive: true });
      await writeFile(credentialsFilePath(), "{}", { mode: 0o644 });

      await writeStoredCredentials({ apiKey: "k", refreshToken: "r" });

      const fileStats = await stat(credentialsFilePath());
      const directoryStats = await stat(dirname(credentialsFilePath()));

      expect(fileStats.mode & 0o777).toBe(0o600);
      expect(directoryStats.mode & 0o777).toBe(0o700);
      expect(await readStoredCredentials()).toEqual({ apiKey: "k", refreshToken: "r" });
    },
  );
});

describe("configDirectory", () => {
  it.each(["", "relative/config"])("ignores the invalid XDG_CONFIG_HOME value %p", (value) => {
    const configured = process.env["XDG_CONFIG_HOME"];
    process.env["XDG_CONFIG_HOME"] = value;

    try {
      expect(configDirectory()).toBe(join(homedir(), ".config", "tf-hub"));
    } finally {
      process.env["XDG_CONFIG_HOME"] = configured;
    }
  });
});
