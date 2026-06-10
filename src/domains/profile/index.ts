import { z } from "zod";

import { decodeJwtClaims } from "../../auth/jwt.ts";
import { getValidIdToken } from "../../auth/tokens.ts";
import { detailsRenderer, formatValue, missingValue } from "../../cli/output.ts";
import { standaloneEntry, type RegistryEntry } from "../domain.ts";
import { defineOperation } from "../operation.ts";
import { getCurrentCollaborator } from "../collaborators/api.ts";
import { fullName, positionOf } from "../collaborators/index.ts";

export const whoamiEntry: RegistryEntry = standaloneEntry(
  defineOperation({
    name: "whoami",
    description: "Show the signed-in user and token expiry.",
    input: z.object({}),
    async run() {
      const claims = decodeJwtClaims(await getValidIdToken());

      return {
        name: claims.name ?? null,
        email: claims.email ?? null,
        userId: claims.user_id ?? claims.sub ?? null,
        tenant: claims.firebase?.tenant ?? null,
        expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
      };
    },
  }),
  {
    render: detailsRenderer([
      ["Name", (session) => formatValue(session.name)],
      ["Email", (session) => formatValue(session.email)],
      ["UID", (session) => formatValue(session.userId)],
      ["Tenant", (session) => formatValue(session.tenant)],
      ["Expires", (session) => (session.expiresAt ? new Date(session.expiresAt).toLocaleString() : missingValue)],
    ]),
  },
);

export const meEntry: RegistryEntry = standaloneEntry(
  defineOperation({
    name: "me",
    description: "Show the TF Hub profile of the signed-in user.",
    input: z.object({}),
    run: () => getCurrentCollaborator(),
  }),
  {
    render: detailsRenderer([
      ["Name", fullName],
      ["Email", (me) => formatValue(me.email)],
      ["Position", positionOf],
      ["Department", (me) => formatValue(me.positions?.[0]?.department?.name)],
      ["Permissions", (me) => String(me.positions?.[0]?.permissions?.length ?? 0)],
      ["UUID", (me) => formatValue(me.uuid)],
    ]),
  },
);
