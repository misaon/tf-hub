import { describe, expect, it, spyOn } from "bun:test";
import { consola } from "consola";

import {
  binaryAssetName,
  binaryDownloadUrl,
  notifyOnUpdate,
  runsAsStandaloneBinary,
  selectUpdateNotice,
  updateInstallCommand,
} from "../src/cli/update-notifier.ts";
import { jsonResponse, mockFetch } from "./support.ts";

describe("selectUpdateNotice", () => {
  it("advertises a strictly newer published version", () => {
    expect(selectUpdateNotice("0.1.0", "0.2.0")).toBe("0.2.0");
  });

  it("stays silent when the current version is equal or newer", () => {
    expect(selectUpdateNotice("0.2.0", "0.2.0")).toBeNull();
    expect(selectUpdateNotice("0.3.0", "0.2.0")).toBeNull();
  });

  it("stays silent when the latest version is unknown", () => {
    expect(selectUpdateNotice("0.1.0", null)).toBeNull();
  });

  it("never advertises a pre-release", () => {
    expect(selectUpdateNotice("0.1.0", "0.2.0-beta.1")).toBeNull();
  });

  it("compares version segments numerically, not lexicographically", () => {
    expect(selectUpdateNotice("0.9.0", "0.10.0")).toBe("0.10.0");
    expect(selectUpdateNotice("0.10.0", "0.9.0")).toBeNull();
  });

  it("advertises a stable release over a pre-release build of the same version", () => {
    expect(selectUpdateNotice("0.2.0-beta.1", "0.2.0")).toBe("0.2.0");
  });
});

describe("updateInstallCommand", () => {
  it("matches the package manager that installed the binary", () => {
    expect(updateInstallCommand("pkg", "/home/u/.bun/bin/tf-hub")).toBe("bun add -g pkg");
    expect(updateInstallCommand("pkg", "/home/u/Library/pnpm/tf-hub")).toBe("pnpm add -g pkg");
    expect(updateInstallCommand("pkg", "/home/u/.yarn/bin/tf-hub")).toBe("yarn global add pkg");
  });

  it("falls back to npm for unrecognized install locations", () => {
    expect(updateInstallCommand("pkg", "/usr/local/bin/tf-hub")).toBe("npm install -g pkg");
  });
});

describe("standalone binary mode", () => {
  it("detects Bun's virtual filesystem entry paths on every platform", () => {
    expect(runsAsStandaloneBinary("/$bunfs/root/index.mjs")).toBe(true);
    expect(runsAsStandaloneBinary(String.raw`B:\~BUN\root\index.mjs`)).toBe(true);
    expect(runsAsStandaloneBinary("/usr/local/bin/tf-hub/dist/index.mjs")).toBe(false);
  });

  it("names release assets after the running platform", () => {
    expect(binaryAssetName("darwin", "arm64")).toBe("tf-hub-darwin-arm64");
    expect(binaryAssetName("linux", "x64")).toBe("tf-hub-linux-x64");
    expect(binaryAssetName("win32", "x64")).toBe("tf-hub-windows-x64.exe");
  });

  it("links the download to the exact release tag", () => {
    expect(binaryDownloadUrl("1.2.3")).toContain("/releases/download/v1.2.3/tf-hub-");
  });
});

describe("notifyOnUpdate", () => {
  it("notifies about a newer version and reuses the cached answer within the interval", async () => {
    const originalIsTTY = process.stdout.isTTY;
    const originalContinuousIntegration = process.env["CI"];
    process.stdout.isTTY = true;
    process.env["CI"] = "";

    try {
      const box = spyOn(consola, "box").mockReturnValue(undefined);
      const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ version: "99.0.0" })));

      await notifyOnUpdate("test-package", "0.1.0");
      await notifyOnUpdate("test-package", "0.1.0");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(box).toHaveBeenCalledTimes(2);
      expect(String(box.mock.calls[0]?.[0])).toContain("99.0.0");
    } finally {
      process.stdout.isTTY = originalIsTTY;
      process.env["CI"] = originalContinuousIntegration;
    }
  });
});
