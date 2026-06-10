import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  formatName,
  formatValue,
  missingValue,
  printJson,
  printSuccess,
  tableRenderer,
} from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { idField, jsonField, limitField, monthField, offsetField, uuidField } from "../fields.ts";
import {
  deleteWorkingTimeRecord,
  getWorkingTimeRecordMonth,
  getWorkingTimeRecordsSummary,
  legalTypes,
  listWorkingTimeRecords,
  regenerateWorkingTimeRecords,
  updateWorkingTimeRecordItem,
  updateWorkingTimeRecordItemStatus,
  workingTimeRecordStates,
  workingTimeRecordTypes,
  type WorkingTimeRecord,
  type WorkingTimeRecordItem,
  type WorkingTimeRecordSummary,
} from "./api.ts";

const stateDescription =
  "Record state: WAITING_FOR_CONFIRMATION (employee is editing), WAITING_FOR_CLOSURE (awaiting HR approval), " +
  "RETURNED (HR returned it for fixes), CLOSED (approved, final).";

const dateItemsSchema = z.array(
  z.object({
    date: z.string(),
    workItems: z.array(
      z.object({
        type: z.enum(workingTimeRecordTypes),
        workStart: z.string(),
        workEnd: z.string(),
      }),
    ),
  }),
);

const hours = (minutes: number | null | undefined): string =>
  typeof minutes === "number" ? `${Math.round((minutes / 60) * 10) / 10}h` : missingValue;

export const workingTimeDomain: RegistryEntry = defineDomain({
  name: "working-time",
  description: "Legal attendance records, separate from worklogs.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List working time records (legal attendance). They record the start and end of work per day and are " +
        "separate from worklogs. Regular users see their own records.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        collaboratorUuid: uuidField("Only records of the collaborator with this UUID.").optional(),
        month: monthField("Only records for this month (YYYY-MM).").optional(),
      }),
      run: (input) => listWorkingTimeRecords(input),
      render: tableRenderer<WorkingTimeRecord>([
        ["Month", (record) => formatValue(record.month)],
        ["User", (record) => formatName(record.user)],
        [
          "Items",
          (record) =>
            formatValue(
              (record.items ?? [])
                .map((item) => `${item.id}: ${item.legalType ?? "?"} ${item.state ?? "?"}`)
                .join(", "),
            ),
        ],
      ]),
    }),
    defineAction({
      action: "show",
      description:
        "Show the working time record for one month. Includes all daily work blocks (start/end times, " +
        "vacation, illness).",
      input: z.object({
        month: monthField(),
        collaboratorUuid: uuidField("Record owner; defaults to the signed-in user.").optional(),
      }),
      positionals: ["month"],
      run: (input) => getWorkingTimeRecordMonth(input),
      render: printJson,
    }),
    defineAction({
      action: "summary",
      description:
        "Summarize working time records per collaborator and month: worked, vacation, illness, unpaid and " +
        "holiday minutes plus the approval state (HR administration).",
      input: z.object({
        collaboratorUuid: uuidField("Only the collaborator with this UUID.").optional(),
        month: z.coerce.number().int().min(1).max(12).describe("Calendar month number (1-12).").optional(),
        year: z.coerce.number().int().min(2000).max(2200).describe("Calendar year, e.g. 2026.").optional(),
        legalType: z
          .enum(legalTypes)
          .describe("Employment legal type: HPP (full-time), DPP (work agreement), ZL (other).")
          .optional(),
        state: z.enum(workingTimeRecordStates).describe(stateDescription).optional(),
      }),
      run: ({ month, year, ...rest }) =>
        getWorkingTimeRecordsSummary({
          ...rest,
          month: month === undefined ? undefined : String(month),
          year: year === undefined ? undefined : String(year),
        }),
      render: tableRenderer<WorkingTimeRecordSummary>([
        ["Month", (summary) => formatValue(summary.month)],
        ["User", (summary) => formatName(summary.user)],
        ["Type", (summary) => formatValue(summary.legalType)],
        ["State", (summary) => formatValue(summary.state)],
        ["Worked", (summary) => hours(summary.workMinutes)],
        ["Vacation", (summary) => hours(summary.vacationMinutes)],
        ["Illness", (summary) => hours(summary.illnessMinutes)],
      ]),
    }),
    defineAction({
      action: "item-update",
      description:
        "Replace the daily blocks of a working time record item. One item covers one collaborator, month " +
        "and legal type. Rules: max 6h per block, max 12h per day, 30-minute gap between blocks, no overlaps.",
      input: z.object({
        id: idField("Numeric ID of the working time record item (see `working-time-show`)."),
        state: z.enum(workingTimeRecordStates).describe(stateDescription),
        note: z.string().describe("Note attached to the record item.").optional(),
        dateItems: jsonField(
          dateItemsSchema,
          'Daily blocks as JSON, e.g. [{"date":"2026-06-10","workItems":[{"type":"WORK",' +
            '"workStart":"2026-06-10T08:00:00","workEnd":"2026-06-10T12:00:00"}]}]. ' +
            `Item types: ${workingTimeRecordTypes.join(", ")}.`,
        ),
      }),
      positionals: ["id"],
      run: (input) => updateWorkingTimeRecordItem(input),
      render: printJson,
    }),
    defineAction({
      action: "item-set-status",
      description:
        "Change the approval state of a working time record item: submit for closure (WAITING_FOR_CLOSURE), " +
        "approve (CLOSED) or return for fixes (RETURNED) with a note.",
      input: z.object({
        id: idField("Numeric ID of the working time record item."),
        state: z.enum(workingTimeRecordStates).describe(stateDescription),
        note: z.string().default("").describe("Reason or note for the state change."),
      }),
      positionals: ["id", "state"],
      run: (input) => updateWorkingTimeRecordItemStatus(input),
      render: detailsRenderer<WorkingTimeRecordItem>([
        ["ID", (item) => formatValue(item.id)],
        ["State", (item) => formatValue(item.state)],
        ["Note", (item) => formatValue(item.note)],
      ]),
    }),
    defineAction({
      action: "delete",
      description: "Delete a working time record item (HR administration).",
      input: z.object({
        id: idField("Numeric ID of the working time record item to delete."),
        legalType: z.enum(legalTypes).describe("Legal type of the record: HPP, DPP or ZL."),
      }),
      positionals: ["id", "legalType"],
      async run(input) {
        await deleteWorkingTimeRecord(input);

        return { deleted: input.id };
      },
      render: deletedRenderer("Working time record"),
    }),
    defineAction({
      action: "regenerate",
      description:
        "Regenerate the working time records for a month. Rebuilds them from source data (HR administration).",
      input: z.object({ month: monthField() }),
      positionals: ["month"],
      async run(input) {
        await regenerateWorkingTimeRecords(input);

        return { regenerated: input.month };
      },
      render({ regenerated }) {
        printSuccess(`Working time records for ${regenerated} regenerated.`);
      },
    }),
  ],
});
