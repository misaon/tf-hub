import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zSubstituteGroupDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { deletedRenderer, detailsRenderer, formatValue, tableRenderer, type ColumnSpec } from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { commaSeparatedNumbersField, idField } from "../fields.ts";

const groupsPath = v3("substitute-groups");

type SubstituteGroup = z.infer<typeof zSubstituteGroupDto>;
const substituteGroupListSchema = z.array(zSubstituteGroupDto);

async function listSubstituteGroups(): Promise<SubstituteGroup[]> {
  return substituteGroupListSchema.parse(await callApi(groupsPath));
}

async function createSubstituteGroup(options: { name: string; userIds: number[] }): Promise<SubstituteGroup> {
  return zSubstituteGroupDto.parse(await callApi(groupsPath, { method: "POST", body: options }));
}

async function updateSubstituteGroup(options: {
  id: number;
  name: string;
  userIds: number[];
}): Promise<SubstituteGroup> {
  const { id, ...body } = options;

  return zSubstituteGroupDto.parse(await callApi(`${groupsPath}/${id}`, { method: "PUT", body }));
}

async function deleteSubstituteGroup(options: { id: number }): Promise<void> {
  await callApi(`${groupsPath}/${options.id}`, { method: "DELETE" });
}

const groupColumns: ColumnSpec<SubstituteGroup>[] = [
  ["ID", (group) => formatValue(group.id)],
  ["Name", (group) => formatValue(group.name)],
  ["Members", (group) => formatValue((group.users ?? []).map((user) => user.name ?? "?").join(", "))],
];

const memberIdsField = commaSeparatedNumbersField(
  "Comma-separated numeric collaborator IDs of the members, e.g. 1,2,3.",
);

export const substituteGroupsDomain: RegistryEntry = defineDomain({
  name: "substitute-groups",
  description: "Teams whose members cover for each other during absences.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List substitute groups — teams whose members cover for each other. When someone requests an absence, " +
        "the system checks that at least one group member stays available.",
      input: z.object({}),
      run: () => listSubstituteGroups(),
      render: tableRenderer(groupColumns),
    }),
    defineAction({
      action: "create",
      description: "Create a substitute group with a name and member list (admin).",
      input: z.object({
        name: z.string().min(1).describe("Name of the group."),
        userIds: memberIdsField,
      }),
      run: (input) => createSubstituteGroup(input),
      render: detailsRenderer(groupColumns),
    }),
    defineAction({
      action: "update",
      description:
        "Update a substitute group's name and member list (admin). The member list replaces the current one.",
      input: z.object({
        id: idField("Numeric ID of the group."),
        name: z.string().min(1).describe("Updated name of the group."),
        userIds: memberIdsField,
      }),
      positionals: ["id"],
      run: (input) => updateSubstituteGroup(input),
      render: detailsRenderer(groupColumns),
    }),
    defineAction({
      action: "delete",
      description: "Delete a substitute group (admin).",
      input: z.object({ id: idField("Numeric ID of the group to delete.") }),
      positionals: ["id"],
      async run(input) {
        await deleteSubstituteGroup(input);

        return { deleted: input.id };
      },
      render: deletedRenderer("Substitute group"),
    }),
  ],
});
