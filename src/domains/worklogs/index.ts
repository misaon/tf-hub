import { consola } from "consola";
import { colors } from "consola/utils";
import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  ellipsize,
  formatDate,
  formatMinutes,
  formatValue,
  printTable,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { getCurrentCollaborator } from "../collaborators/api.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import {
  allTimeFromDate,
  allTimeToDate,
  dateField,
  dateTimeField,
  idField,
  limitField,
  offsetField,
  uuidField,
} from "../fields.ts";
import {
  createWorklog,
  deleteWorklog,
  getWorklog,
  getWorklogCategorySum,
  getWorklogYearStats,
  listWorklogs,
  updateWorklog,
  type Worklog,
  type WorklogCategorySum,
} from "./api.ts";

const filterInput = z.object({
  limit: limitField,
  offset: offsetField,
  fromDate: dateField("Only worklogs on or after this date (YYYY-MM-DD).").default(allTimeFromDate),
  toDate: dateField("Only worklogs on or before this date (YYYY-MM-DD).").default(allTimeToDate),
  collaboratorUuid: uuidField("Only worklogs of the collaborator with this UUID.").optional(),
  costCategoryId: idField("Only worklogs in this cost category (see `cost-categories`).").optional(),
});

const worklogColumns = (descriptionLength: number): ColumnSpec<Worklog>[] => [
  ["ID", (worklog) => String(worklog.id)],
  ["Date", (worklog) => formatDate(worklog.started)],
  ["Time", (worklog) => formatMinutes(worklog.timeSpent)],
  ["Category", (worklog) => formatValue(worklog.costCategory?.name)],
  ["Project", (worklog) => formatValue(worklog.project?.name)],
  ["Collaborator", (worklog) => formatValue(worklog.collaborator?.name)],
  ["Description", (worklog) => ellipsize(worklog.description, descriptionLength)],
];

export const worklogsDomain: RegistryEntry = defineDomain({
  name: "worklogs",
  description: "Project time tracking: logged hours per cost category, sums and statistics. Feeds The Game XP.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List logged work (time tracking): date, time spent, cost category, project and description, plus the " +
        "total time of the selection. Worked hours feed the XP calculation in The Game.",
      input: filterInput,
      run: (input) => listWorklogs(input),
      render({ worklogs, timeSpentSum }) {
        tableRenderer(worklogColumns(40))(worklogs);
        consola.log(colors.dim(`Total time: ${formatMinutes(timeSpentSum)}`));
      },
    }),
    defineAction({
      action: "show",
      description: "Show one worklog entry in detail.",
      input: z.object({ id: idField("Numeric ID of the worklog.") }),
      positionals: ["id"],
      run: (input) => getWorklog(input),
      render: detailsRenderer(worklogColumns(100)),
    }),
    defineAction({
      action: "create",
      description:
        "Log work time: how many minutes were spent on which cost category (and optionally project), with a " +
        "description. Logging is limited to recent days and the daily maximum set by the company.",
      input: z.object({
        description: z.string().min(1).describe("What was worked on."),
        timeSpent: z.coerce.number().int().min(1).describe("Time spent in minutes, e.g. 90 for 1h 30m."),
        started: dateTimeField("When the work started (YYYY-MM-DD or full ISO date-time)."),
        costCategoryId: idField("Cost category ID (see `cost-categories`)."),
        projectUuid: uuidField("UUID of the related project (see `projects-list`).").optional(),
        collaboratorId: idField("Numeric ID of the collaborator. Defaults to the signed-in user.").optional(),
      }),
      async run({ projectUuid, collaboratorId, ...rest }) {
        let resolvedCollaboratorId = collaboratorId;

        if (resolvedCollaboratorId === undefined) {
          const me = await getCurrentCollaborator();
          resolvedCollaboratorId = me.id ?? undefined;
        }

        if (resolvedCollaboratorId === undefined) {
          throw new Error("Could not resolve the collaborator ID. Pass collaboratorId explicitly.");
        }

        return createWorklog({ ...rest, projectUuid: projectUuid ?? null, collaboratorId: resolvedCollaboratorId });
      },
      render: detailsRenderer(worklogColumns(100)),
    }),
    defineAction({
      action: "update",
      description: "Update an existing worklog entry. All fields are persisted as given.",
      input: z.object({
        id: idField("Numeric ID of the worklog to update."),
        description: z.string().min(1).describe("Updated description of the work."),
        timeSpent: z.coerce.number().int().min(1).describe("Updated time spent in minutes."),
        started: dateTimeField("Updated start of the work (YYYY-MM-DD or full ISO date-time)."),
        costCategoryId: idField("Updated cost category ID."),
        projectUuid: uuidField("Updated project UUID; omit to detach the worklog from a project.").optional(),
      }),
      positionals: ["id"],
      run: ({ projectUuid, ...rest }) => updateWorklog({ ...rest, projectUuid: projectUuid ?? null }),
      render: detailsRenderer(worklogColumns(100)),
    }),
    defineAction({
      action: "delete",
      description: "Delete a worklog entry.",
      input: z.object({ id: idField("Numeric ID of the worklog to delete.") }),
      positionals: ["id"],
      async run(input) {
        await deleteWorklog(input);

        return { deleted: input.id };
      },
      render: deletedRenderer("Worklog"),
    }),
    defineAction({
      action: "category-sum",
      description: "Sum the logged time per cost category for the selected period and filters.",
      input: filterInput,
      run: (input) => getWorklogCategorySum(input),
      render: tableRenderer<WorklogCategorySum>([
        ["Category", (sum) => formatValue(sum.costCategory?.name)],
        ["Time", (sum) => formatMinutes(sum.timeSpent)],
      ]),
    }),
    defineAction({
      action: "year-stats",
      description: "Show monthly logged time per cost category for the year ending at the given date (12 months back).",
      input: z.object({
        toDate: dateField("End of the one-year window (YYYY-MM-DD), e.g. today."),
        collaboratorUuid: uuidField("Only worklogs of the collaborator with this UUID.").optional(),
      }),
      positionals: ["toDate"],
      run: (input) => getWorklogYearStats(input),
      render(stats) {
        const rows = stats.flatMap((entry) =>
          (entry.yearStats ?? []).map((monthStat) => ({
            Category: formatValue(entry.costCategory?.name),
            Month: formatValue(monthStat.month),
            Time: formatMinutes(monthStat.timeSpent),
          })),
        );

        printTable(rows, ["Category", "Month", "Time"]);
      },
    }),
  ],
});
