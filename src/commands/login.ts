import { consola } from "consola";

import { decodeJwtClaims } from "../auth/jwt.ts";
import { acquireSession } from "../auth/session.ts";
import { readStoredCredentials, writeStoredCredentials } from "../auth/store.ts";
import { defineCommand } from "../cli/command.ts";

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description: "Authenticate with Google and store the session in your OS keychain. Opens your browser.",
  },
  async run() {
    const existingSession = await readStoredCredentials();

    if (existingSession?.idToken) {
      const current = decodeJwtClaims(existingSession.idToken);

      consola.info(
        `Already logged in as ${current.name ?? current.email ?? current.user_id}. Run \`tf-hub logout\` to switch accounts.`,
      );

      return;
    }

    const session = await acquireSession();
    await writeStoredCredentials(session);

    const claims = decodeJwtClaims(session.idToken);
    consola.success(`Logged in as ${claims.name ?? claims.email ?? claims.user_id}`);
  },
});
