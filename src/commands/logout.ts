import { consola } from "consola";

import { clearStoredCredentials, readStoredCredentials } from "../auth/store.ts";
import { defineCommand } from "../cli/command.ts";

export const logoutCommand = defineCommand({
  meta: {
    name: "logout",
    description: "Remove the stored session from your OS keychain.",
  },
  async run() {
    const session = await readStoredCredentials();

    if (!session) {
      consola.info("You are not logged in.");

      return;
    }

    await clearStoredCredentials();

    consola.success("Logged out.");
  },
});
