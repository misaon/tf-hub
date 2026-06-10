import { z } from "zod";

import { decodeJwtClaims } from "../../auth/jwt.ts";
import { getValidIdToken } from "../../auth/tokens.ts";
import { detailsRenderer, formatName, formatValue, missingValue } from "../../cli/output.ts";
import { getCurrentCollaborator, omitBio } from "../collaborators/api.ts";
import { positionOf } from "../collaborators/index.ts";
import { standaloneEntry, type RegistryEntry } from "../domain.ts";
import { defineOperation } from "../operation.ts";

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
    description:
      "Show the signed-in user's TF Hub identity and profile (uuid, id, email, positions, game state). " +
      "The bio is omitted — fetch it with colleagues-show when needed.",
    input: z.object({}),
    async run() {
      return omitBio(await getCurrentCollaborator());
    },
  }),
  {
    render: detailsRenderer([
      ["Name", formatName],
      ["Email", (me) => formatValue(me.email)],
      ["Position", positionOf],
      ["Department", (me) => formatValue(me.positions?.[0]?.department?.name)],
      ["Permissions", (me) => String(me.positions?.[0]?.permissions?.length ?? 0)],
      ["UUID", (me) => formatValue(me.uuid)],
    ]),
  },
);
