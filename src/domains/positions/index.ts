import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zPositionsDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { detailsRenderer, formatValue, tableRenderer } from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { commaSeparatedNumbersField, idField, limitField, offsetField } from "../fields.ts";
import type { Paging } from "../shared.ts";

const positionsPath = v3("positions");

type Position = z.infer<typeof zPositionsDto>;
const positionListSchema = z.array(zPositionsDto);

async function listPositions(options: Paging): Promise<Position[]> {
  return positionListSchema.parse(await callApi(positionsPath, { query: options }));
}

async function updatePosition(options: { id: number; permissionsIds: number[]; order: number }): Promise<Position> {
  const { id, ...body } = options;

  return zPositionsDto.parse(await callApi(`${positionsPath}/${id}`, { method: "PUT", body }));
}

export const positionsDomain: RegistryEntry = defineDomain({
  name: "positions",
  description: "Job positions with permissions and game leagues.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List job positions. Each carries its permissions, game league (DEV/TL/QA), cost categories, auditors " +
        "and assigned collaborators.",
      input: z.object({ limit: limitField, offset: offsetField }),
      run: (input) => listPositions(input),
      render: tableRenderer<Position>([
        ["ID", (position) => formatValue(position.id)],
        ["Name", (position) => formatValue(position.name)],
        ["League", (position) => formatValue(position.gameLeague)],
        ["Order", (position) => formatValue(position.order)],
        ["Permissions", (position) => String(position.permissions?.length ?? 0)],
        ["Users", (position) => String(position.users?.length ?? 0)],
      ]),
    }),
    defineAction({
      action: "update",
      description:
        "Update a position's permission set and display order (admin). The permission list replaces the current " +
        "one; see `permissions` for available IDs.",
      input: z.object({
        id: idField("Numeric ID of the position (see `positions-list`)."),
        permissionsIds: commaSeparatedNumbersField("Comma-separated permission IDs to assign, e.g. 1,4,7."),
        order: z.coerce.number().int().min(0).describe("Display order of the position."),
      }),
      positionals: ["id"],
      run: (input) => updatePosition(input),
      render: detailsRenderer<Position>([
        ["ID", (position) => formatValue(position.id)],
        ["Name", (position) => formatValue(position.name)],
        ["Order", (position) => formatValue(position.order)],
        [
          "Permissions",
          (position) =>
            formatValue((position.permissions ?? []).map((permission) => permission.name ?? "?").join(", ")),
        ],
      ]),
    }),
  ],
});
