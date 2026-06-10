import { spawn } from "node:child_process";
import { once } from "node:events";
import { consola } from "consola";

import packageJson from "../../package.json" with { type: "json" };
import { defineCommand } from "../cli/command.ts";
import {
  binaryDownloadUrl,
  fetchLatestVersion,
  runsAsStandaloneBinary,
  selectUpdateNotice,
  updateInstallCommand,
} from "../cli/update-notifier.ts";

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

    if (runsAsStandaloneBinary()) {
      consola.info(`v${newerVersion} is available. Download the binary for this machine:`);
      consola.log(binaryDownloadUrl(newerVersion));
      consola.log("Replace the current executable with the downloaded file.");

      return;
    }

    const installCommand = updateInstallCommand(packageJson.name);

    consola.info(`Updating v${packageJson.version} → v${newerVersion} via \`${installCommand}\`…`);

    const [command = "", ...commandArguments] = installCommand.split(" ");
    const installer = spawn(command, commandArguments, { stdio: "inherit" });
    const [exitCode] = (await once(installer, "exit")) as [number | null];

    if (exitCode !== 0) {
      throw new Error(`Update failed (exit code ${exitCode}).`);
    }

    consola.success(`Updated to v${newerVersion}.`);
  },
});
