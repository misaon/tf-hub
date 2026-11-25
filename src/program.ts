import { defineCommand } from "citty";

import packageJson from "../package.json" with { type: "json" };
import { findUpdateNotice } from "./cli/update-notifier.ts";
import { runCli } from "./cli/main.ts";
import { registryCommands } from "./domains/index.ts";

const main = defineCommand({
  meta: {
    name: "tf-hub",
    version: packageJson.version,
    description:
      "Command-line client for the TF Hub API. Run `tf-hub login` once to sign in with Google; " +
      "the session is stored locally and refreshed automatically. Commands are grouped by domain — " +
      "run `tf-hub <command> --help` to list its actions and `tf-hub <command> <action> --help` for the " +
      "full description. Add `--json` to any data command for machine-readable output.",
  },
  subCommands: {
    login: () => import("./commands/login.ts").then((module) => module.loginCommand),
    logout: () => import("./commands/logout.ts").then((module) => module.logoutCommand),
    ...registryCommands,
    update: () => import("./commands/update.ts").then((module) => module.updateCommand),
    "mcp-server": () => import("./commands/mcp-server.ts").then((module) => module.mcpServerCommand),
  },
});

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") {
    throw error;
  }

  process.exit(process.exitCode ?? 0);
});

// Started before the command so the network check overlaps with real work; printed only after its output.
const updateNotice = findUpdateNotice(packageJson.name, packageJson.version);

await runCli(main, packageJson.version);

const notice = await updateNotice;

if (notice) {
  process.stderr.write(`${notice}\n`);
}
