#!/usr/bin/env node
import { defineCommand, runMain } from "citty";

import packageJson from "../package.json" with { type: "json" };
import { notifyOnUpdate } from "./cli/update-notifier.ts";
import { loginCommand } from "./commands/login.ts";
import { logoutCommand } from "./commands/logout.ts";
import { mcpServerCommand } from "./commands/mcp-server.ts";
import { updateCommand } from "./commands/update.ts";
import { registryCommands } from "./domains";

const main = defineCommand({
  meta: {
    name: "tf-hub",
    version: packageJson.version,
    description:
      "Command-line client for the TF Hub API. Run `tf-hub login` once to sign in with Google; " +
      "the session is stored locally and refreshed automatically. Commands are grouped by domain — " +
      "run `tf-hub <command> --help` to list its actions. Add `--json` to any data command " +
      "for machine-readable output.",
  },
  subCommands: {
    login: loginCommand,
    logout: logoutCommand,
    ...registryCommands,
    update: updateCommand,
    "mcp-server": mcpServerCommand,
  },
});

// Started before the command so the network check overlaps with real work; prints only after.
const updateNotice = notifyOnUpdate(packageJson.name, packageJson.version);

await runMain(main);
await updateNotice;
