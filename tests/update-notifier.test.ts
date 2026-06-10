import { describe, expect, it } from "bun:test";

import { selectUpdateNotice, updateInstallCommand } from "../src/cli/update-notifier.ts";

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
