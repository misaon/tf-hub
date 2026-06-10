import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  ellipsize,
  formatDate,
  formatName,
  formatValue,
  tableRenderer,
} from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { dateField, limitField, offsetField, uuidField } from "../fields.ts";
import {
  createOneOnOne,
  deleteOneOnOne,
  listOneOnOnes,
  oneOnOneRatings,
  updateOneOnOne,
  type OneOnOne,
} from "./api.ts";

const ratingDescription = (side: string): string => `${side} rating of the period: BAD, OK or GREAT.`;

const financialFlagField = z
  .boolean()
  .default(false)
  .describe("Mark as a financial (salary) note with restricted visibility.");

const oneOnOneDetails = detailsRenderer<OneOnOne>([
  ["Date", (oneOnOne) => formatDate(oneOnOne.date)],
  ["Collaborator", (oneOnOne) => formatName(oneOnOne.collaborator)],
  ["Company rating", (oneOnOne) => formatValue(oneOnOne.companyRating)],
  ["Collaborator rating", (oneOnOne) => formatValue(oneOnOne.collaboratorRating)],
  ["Financial", (oneOnOne) => formatValue(oneOnOne.isFinancialMessage ?? false)],
  ["Message", (oneOnOne) => ellipsize(oneOnOne.message, 100)],
  ["UUID", (oneOnOne) => formatValue(oneOnOne.uuid)],
]);

export const oneOnOnesDomain: RegistryEntry = defineDomain({
  name: "one-on-ones",
  description: "1on1 meeting records between managers and team members.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List 1on1 meeting records between managers and team members: date, notes, mutual ratings and whether " +
        "the note contains financial (salary) information. Use mine=true to list the signed-in user's own 1on1s.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        mine: z.boolean().default(false).describe("Only 1on1s of the signed-in user."),
        collaboratorUuid: uuidField("Only 1on1s with the collaborator with this UUID.").optional(),
        onlyFinancialMessages: z.boolean().default(false).describe("Only records flagged as financial (salary) notes."),
        dateFrom: dateField("Only 1on1s on or after this date (YYYY-MM-DD).").optional(),
        dateTo: dateField("Only 1on1s on or before this date (YYYY-MM-DD).").optional(),
      }),
      run: (input) => listOneOnOnes(input),
      render: tableRenderer<OneOnOne>([
        ["Date", (oneOnOne) => formatDate(oneOnOne.date)],
        ["Collaborator", (oneOnOne) => formatName(oneOnOne.collaborator)],
        ["Company", (oneOnOne) => formatValue(oneOnOne.companyRating)],
        ["Own", (oneOnOne) => formatValue(oneOnOne.collaboratorRating)],
        ["Financial", (oneOnOne) => formatValue(oneOnOne.isFinancialMessage ?? false)],
        ["Message", (oneOnOne) => ellipsize(oneOnOne.message, 40)],
        ["UUID", (oneOnOne) => formatValue(oneOnOne.uuid)],
      ]),
    }),
    defineAction({
      action: "create",
      description:
        "Record a 1on1 meeting with a team member: discussion notes, how the collaborator and the company rate " +
        "the period, and a financial flag for salary topics (managers).",
      input: z.object({
        collaboratorUuid: uuidField("UUID of the team member the 1on1 was held with."),
        date: dateField("Date of the 1on1 (YYYY-MM-DD)."),
        message: z.string().min(1).describe("Notes from the 1on1 (HTML or plain text)."),
        companyRating: z.enum(oneOnOneRatings).describe(ratingDescription("Company/manager")),
        collaboratorRating: z.enum(oneOnOneRatings).describe(ratingDescription("Collaborator's own")).optional(),
        isFinancialMessage: financialFlagField,
      }),
      run: (input) => createOneOnOne(input),
      render: oneOnOneDetails,
    }),
    defineAction({
      action: "update",
      description: "Update a 1on1 record's notes, ratings or financial flag (managers).",
      input: z.object({
        uuid: uuidField("UUID of the 1on1 record."),
        message: z.string().min(1).describe("Updated notes."),
        companyRating: z.enum(oneOnOneRatings).describe(ratingDescription("Company/manager")),
        collaboratorRating: z.enum(oneOnOneRatings).describe(ratingDescription("Collaborator's own")).optional(),
        isFinancialMessage: financialFlagField,
      }),
      positionals: ["uuid"],
      run: (input) => updateOneOnOne(input),
      render: oneOnOneDetails,
    }),
    defineAction({
      action: "delete",
      description: "Delete a 1on1 record (managers).",
      input: z.object({ uuid: uuidField("UUID of the 1on1 record to delete.") }),
      positionals: ["uuid"],
      async run(input) {
        await deleteOneOnOne(input);

        return { deleted: input.uuid };
      },
      render: deletedRenderer("1on1 record"),
    }),
  ],
});
