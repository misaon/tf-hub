import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  ellipsize,
  formatDate,
  formatName,
  formatValue,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { getCurrentCollaboratorUuid, resolveCollaboratorScope } from "../collaborators/api.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import {
  allTimeFromDate,
  allTimeToDate,
  dateField,
  explicitBooleanField,
  idField,
  limitField,
  offsetField,
  uuidField,
} from "../fields.ts";
import {
  createGoal,
  createVision,
  deleteGoal,
  getVision,
  listGoals,
  updateGoal,
  updateVision,
  type Goal,
  type Vision,
} from "./api.ts";

const goalIdentityColumns: ColumnSpec<Goal>[] = [
  ["ID", (goal) => formatValue(goal.id)],
  ["Collaborator", (goal) => formatName(goal.collaborator)],
  ["Start", (goal) => formatDate(goal.startDate)],
  ["Deadline", (goal) => formatDate(goal.deadline)],
];

const goalDetails = detailsRenderer<Goal>([
  ...goalIdentityColumns,
  ["Done", (goal) => formatValue(goal.done ?? false)],
  ["Active", (goal) => formatValue(goal.active ?? true)],
  ["Goal", (goal) => ellipsize(goal.message, 100)],
]);

const visionDetails = detailsRenderer<Vision>([
  ["ID", (vision) => formatValue(vision.id)],
  ["Collaborator", (vision) => formatName(vision.collaborator)],
  ["Updated", (vision) => formatDate(vision.updatedAt)],
  ["Vision", (vision) => ellipsize(vision.message, 200)],
]);

export const goalsDomain: RegistryEntry = defineDomain({
  name: "goals",
  description: "Personal development goals of collaborators.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List personal development goals of collaborators: goal text, start date, deadline and done/active " +
        "state. Use mine=true or pass collaboratorUuid to list one person's goals (own goals work without " +
        "extra permissions).",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        mine: z.boolean().default(false).describe("Only goals of the signed-in user."),
        collaboratorUuid: uuidField("Only goals of the collaborator with this UUID.").optional(),
        fromDate: dateField("Only goals created on or after this date (YYYY-MM-DD).").default(allTimeFromDate),
        toDate: dateField("Only goals created on or before this date (YYYY-MM-DD).").default(allTimeToDate),
      }),
      async run({ mine, collaboratorUuid, ...rest }) {
        return listGoals({ ...rest, collaboratorUuid: await resolveCollaboratorScope({ mine, collaboratorUuid }) });
      },
      render: tableRenderer<Goal>([
        ...goalIdentityColumns,
        ["Done", (goal) => formatValue(goal.done ?? false)],
        ["Goal", (goal) => ellipsize(goal.message, 50)],
      ]),
    }),
    defineAction({
      action: "create",
      description:
        "Create a personal development goal for a collaborator. Set the start date and deadline; validating " +
        "the draft against the person's vision first with `validate-goal` is recommended.",
      input: z.object({
        collaboratorUuid: uuidField("UUID of the collaborator the goal belongs to."),
        message: z
          .string()
          .min(1)
          .describe("Goal text, typically including a description and the reward for completion."),
        startDate: dateField("Date work on the goal starts (YYYY-MM-DD)."),
        deadline: dateField("Deadline for completing the goal (YYYY-MM-DD)."),
      }),
      async run(input) {
        const editorUuid = await getCurrentCollaboratorUuid();

        return createGoal({ ...input, editorUuid });
      },
      render: goalDetails,
    }),
    defineAction({
      action: "update",
      description:
        "Update a goal's text, dates or state. Mark a goal as completed with done=true, or deactivate it with " +
        "active=false. All fields are persisted as given.",
      input: z.object({
        id: idField("Numeric ID of the goal (see `goals-list`)."),
        collaboratorUuid: uuidField("UUID of the collaborator the goal belongs to."),
        message: z.string().min(1).describe("Updated goal text."),
        startDate: dateField("Updated start date (YYYY-MM-DD)."),
        deadline: dateField("Updated deadline (YYYY-MM-DD)."),
        done: explicitBooleanField("Whether the goal is completed (true/false)."),
        active: explicitBooleanField("Whether the goal is active (true/false).").default(true),
      }),
      positionals: ["id"],
      async run(input) {
        const editorUuid = await getCurrentCollaboratorUuid();

        return updateGoal({ ...input, editorUuid });
      },
      render: goalDetails,
    }),
    defineAction({
      action: "delete",
      description: "Delete a goal.",
      input: z.object({ id: idField("Numeric ID of the goal to delete.") }),
      positionals: ["id"],
      async run(input) {
        await deleteGoal(input);

        return { deleted: input.id };
      },
      render: deletedRenderer("Goal"),
    }),
  ],
});

export const visionDomain: RegistryEntry = defineDomain({
  name: "vision",
  description: "Long-term professional visions (2-5 year direction).",
  actions: [
    defineAction({
      action: "show",
      description:
        "Show a collaborator's long-term professional vision. It sets the 2-5 year direction their goals " +
        "should align with. Defaults to the signed-in user.",
      input: z.object({
        collaboratorUuid: uuidField("UUID of the collaborator; defaults to the signed-in user.").optional(),
      }),
      async run({ collaboratorUuid }) {
        return getVision({ collaboratorUuid: collaboratorUuid ?? (await getCurrentCollaboratorUuid()) });
      },
      render: visionDetails,
    }),
    defineAction({
      action: "create",
      description:
        "Create a collaborator's long-term professional vision. Tip: validate the draft first with `validate-vision`.",
      input: z.object({
        collaboratorUuid: uuidField("UUID of the collaborator the vision belongs to."),
        message: z.string().min(1).describe("Vision text describing the long-term direction, values and career goals."),
      }),
      run: (input) => createVision(input),
      render: visionDetails,
    }),
    defineAction({
      action: "update",
      description: "Update an existing vision's text.",
      input: z.object({
        id: idField("Numeric ID of the vision (see `vision-show`)."),
        message: z.string().min(1).describe("Updated vision text."),
      }),
      positionals: ["id"],
      run: (input) => updateVision(input),
      render: visionDetails,
    }),
  ],
});
