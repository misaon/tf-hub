import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zCollaboratorFeedbackDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { formatDate, formatName, formatValue, tableRenderer } from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { allTimeFromDate, allTimeToDate, dateField, uuidField } from "../fields.ts";

const feedbacksPath = v3("collaborator-feedbacks");

type Feedback = z.infer<typeof zCollaboratorFeedbackDto>;
const feedbackListSchema = z.array(zCollaboratorFeedbackDto);

async function listFeedbacks(options: {
  fromDate: string;
  toDate: string;
  collaboratorUuid?: string | undefined;
}): Promise<Feedback[]> {
  const { collaboratorUuid, ...query } = options;
  const path = collaboratorUuid === undefined ? feedbacksPath : `${feedbacksPath}/single/${collaboratorUuid}`;

  return feedbackListSchema.parse(await callApi(path, { query }));
}

async function listMyFeedbacks(options: { fromDate: string; toDate: string }): Promise<Feedback[]> {
  return feedbackListSchema.parse(await callApi(`${feedbacksPath}/my-feedbacks`, { query: options }));
}

const fromDateField = dateField("Only feedback covering periods on or after this date (YYYY-MM-DD).").default(
  allTimeFromDate,
);
const toDateField = dateField("Only feedback covering periods on or before this date (YYYY-MM-DD).").default(
  allTimeToDate,
);

const feedbackTable = tableRenderer<Feedback>([
  ["Collaborator", (feedback) => formatName(feedback.collaborator)],
  ["From", (feedback) => formatDate(feedback.fromDate)],
  ["To", (feedback) => formatDate(feedback.toDate)],
  ["Value", (feedback) => formatValue(feedback.value)],
]);

export const feedbacksDomain: RegistryEntry = defineDomain({
  name: "feedbacks",
  description: "Periodic colleague feedback ratings (the data behind the feedback heatmap).",
  actions: [
    defineAction({
      action: "list",
      description:
        "List periodic colleague feedback ratings (BAD/GOOD/GREAT per period) — the data behind the feedback " +
        "heatmap. Visibility depends on permissions (own, team or all); mine=true lists only your own.",
      input: z.object({
        mine: z.boolean().default(false).describe("Only feedback received by the signed-in user."),
        collaboratorUuid: uuidField("Only feedback received by the collaborator with this UUID.").optional(),
        fromDate: fromDateField,
        toDate: toDateField,
      }),
      run: ({ mine, ...rest }) => (mine ? listMyFeedbacks(rest) : listFeedbacks(rest)),
      render: feedbackTable,
    }),
  ],
});
