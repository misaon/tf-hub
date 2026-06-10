import { consola } from "consola";

import packageJson from "../../package.json" with { type: "json" };
import { defineCommand } from "../cli/command.ts";
import { fetchLatestVersion, selectUpdateNotice, updateInstallCommand } from "../cli/update-notifier.ts";

const registryTimeoutMs = 10_000;

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Update tf-hub to the latest published version.",
  },
  async run() {
    const latestVersion = await fetchLatestVersion(packageJson.name, registryTimeoutMs);

    if (!latestVersion) {
      throw new Error("Could not reach the npm registry. Try again later.");
    }

    const newerVersion = selectUpdateNotice(packageJson.version, latestVersion);

    if (!newerVersion) {
      consola.success(`Already up to date (v${packageJson.version}).`);

      return;
    }

    const installCommand = updateInstallCommand(packageJson.name);

    consola.info(`Updating v${packageJson.version} → v${newerVersion} via \`${installCommand}\`…`);

    const exitCode = await Bun.spawn(installCommand.split(" "), { stdout: "inherit", stderr: "inherit" }).exited;

    if (exitCode !== 0) {
      throw new Error(`Update failed (exit code ${exitCode}).`);
    }

    consola.success(`Updated to v${newerVersion}.`);
  },
});
