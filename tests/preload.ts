import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, mock } from "bun:test";

// Credentials live in a throwaway config directory — tests must never touch the real one.
const temporaryConfigDirectory = mkdtempSync(join(tmpdir(), "tf-hub-tests-"));
process.env["XDG_CONFIG_HOME"] = temporaryConfigDirectory;
process.env["XDG_CACHE_HOME"] = temporaryConfigDirectory;

beforeEach(() => {
  rmSync(join(temporaryConfigDirectory, "tf-hub"), { recursive: true, force: true });
});

afterEach(() => {
  mock.restore();
  process.exitCode = 0;
});

afterAll(() => {
  rmSync(temporaryConfigDirectory, { recursive: true, force: true });
});
