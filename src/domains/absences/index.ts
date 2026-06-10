import { consola } from "consola";
import { colors } from "consola/utils";
import { z } from "zod";

import {
  detailsRenderer,
  ellipsize,
  formatDate,
  formatName,
  formatValue,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { getCurrentCollaborator, getCurrentCollaboratorUuid } from "../collaborators/api.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { commaSeparatedStringsField, dateField, idField, limitField, offsetField, uuidField } from "../fields.ts";
import {
  createOfficeAbsence,
  getBackupAbsenceApprover,
  getOfficeAbsenceStatistics,
  listOfficeAbsences,
  officeAbsenceStates,
  officeAbsenceTypes,
  updateOfficeAbsence,
  type BackupAbsenceApprover,
  type OfficeAbsence,
  type OfficeAbsenceStatistics,
} from "./api.ts";

const absenceTypeDescription =
  "Absence type: HOLIDAY (vacation), HOME_OFFICE (work from home), WORK_TRAVEL (business trip), " +
  "ILLNESS (sick leave), INACCESSIBILITY (unavailable).";

const absenceColumns: ColumnSpec<OfficeAbsence>[] = [
  ["ID", (absence) => formatValue(absence.id)],
  ["Collaborator", (absence) => formatName(absence.collaborator)],
  ["Type", (absence) => formatValue(absence.type)],
  ["From", (absence) => formatDate(absence.dateFrom)],
  ["To", (absence) => formatDate(absence.dateTo)],
  ["Hours", (absence) => formatValue(absence.hours)],
  ["State", (absence) => formatValue(absence.state)],
  ["Approver", (absence) => formatName(absence.approver)],
];

const absenceDetails = detailsRenderer<OfficeAbsence>([
  ...absenceColumns,
  ["Description", (absence) => ellipsize(absence.generalDescription)],
]);

const percent = (value: number | null | undefined): string =>
  typeof value === "number" ? ` (${Math.round(value * 10) / 10}% of the annual allowance)` : "";

export const absencesDomain: RegistryEntry = defineDomain({
  name: "absences",
  description: "Office absences: vacations, home office, business trips, sick leave and their approval flow.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List office absences (vacations, home office, business trips, sick leave) with their approval state. " +
        "Approvers also see requests of others — pass mine=true for only your own records.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        mine: z.boolean().default(false).describe("Only absences of the signed-in user."),
        type: z.enum(officeAbsenceTypes).describe(absenceTypeDescription).optional(),
        states: commaSeparatedStringsField(
          "Comma-separated absence states to include: WAITING_FOR_APPROVAL, APPROVED, REJECTED, " +
            "AWAITING_CANCELLATION_APPROVAL, CANCELED, DONE.",
        )
          .pipe(z.array(z.enum(officeAbsenceStates)))
          .optional(),
        collaboratorUuid: uuidField("Only absences of the collaborator with this UUID.").optional(),
        approverUuid: uuidField("Only absences approved by the collaborator with this UUID.").optional(),
        dateFrom: dateField("Only absences starting on or after this date (YYYY-MM-DD).").optional(),
        dateTo: dateField("Only absences ending on or before this date (YYYY-MM-DD).").optional(),
      }),
      async run({ mine, collaboratorUuid, ...rest }) {
        let resolvedCollaboratorUuid = collaboratorUuid;

        if (resolvedCollaboratorUuid === undefined && mine) {
          resolvedCollaboratorUuid = await getCurrentCollaboratorUuid();
        }

        return listOfficeAbsences({ ...rest, collaboratorUuid: resolvedCollaboratorUuid });
      },
      render(absences) {
        tableRenderer(absenceColumns)(absences);

        const totalHours = absences.reduce((sum, absence) => sum + (absence.hours ?? 0), 0);
        consola.log(colors.dim(`Total hours of the listed absences: ${totalHours}`));
      },
    }),
    defineAction({
      action: "create",
      description:
        "Request a new office absence (vacation, home office, business trip, sick leave). The request goes to " +
        "the approver for approval; the general description is shared in the team calendar and Slack.",
      input: z.object({
        type: z.enum(officeAbsenceTypes).describe(absenceTypeDescription),
        dateFrom: dateField("First day of the absence (YYYY-MM-DD)."),
        dateTo: dateField("Last day of the absence (YYYY-MM-DD)."),
        hours: z.coerce.number().min(0).describe("Total absence hours (e.g. 8 per full working day)."),
        generalDescription: z
          .string()
          .min(1)
          .describe("Public description shown in the calendar and Slack, e.g. 'Vacation in the mountains'."),
        approverDescription: z.string().default("").describe("Private note visible only to the approver."),
        collaboratorUuid: uuidField("UUID of the absent collaborator. Defaults to the signed-in user.").optional(),
        approverUuid: uuidField(
          "UUID of the approver. Defaults to the signed-in user's primary absence approver.",
        ).optional(),
      }),
      async run({ collaboratorUuid, approverUuid, ...rest }) {
        let resolvedCollaboratorUuid = collaboratorUuid;
        let resolvedApproverUuid = approverUuid;

        if (resolvedCollaboratorUuid === undefined || resolvedApproverUuid === undefined) {
          const me = await getCurrentCollaborator();
          resolvedCollaboratorUuid ??= me.uuid ?? undefined;
          resolvedApproverUuid ??= me.primaryOfficeAbsenceApprover?.uuid ?? undefined;
        }

        if (resolvedCollaboratorUuid === undefined) {
          throw new Error("Could not resolve the collaborator UUID. Pass collaboratorUuid explicitly.");
        }

        if (resolvedApproverUuid === undefined) {
          throw new Error("No approver found. Pass approverUuid explicitly.");
        }

        return createOfficeAbsence({
          ...rest,
          collaboratorUuid: resolvedCollaboratorUuid,
          approverUuid: resolvedApproverUuid,
        });
      },
      render: absenceDetails,
    }),
    defineAction({
      action: "update",
      description:
        "Change the state of an absence request: approve (APPROVED), reject (REJECTED), request cancellation " +
        "(AWAITING_CANCELLATION_APPROVAL) or cancel (CANCELED). Approving and rejecting requires being the approver.",
      input: z.object({
        id: idField("Numeric ID of the absence (see `absences-list`)."),
        state: z.enum(officeAbsenceStates).describe("New state of the absence."),
        generalDescription: z.string().describe("Updated public description.").optional(),
        approverDescription: z.string().describe("Updated private note for the approver.").optional(),
      }),
      positionals: ["id", "state"],
      run: (input) => updateOfficeAbsence(input),
      render: absenceDetails,
    }),
    defineAction({
      action: "statistics",
      description:
        "Show the signed-in user's absence totals for a calendar year, in days (8 hours = 1 day): vacation, " +
        "home office, illness and inaccessibility, each with the share of the annual allowance. Counts " +
        "APPROVED and DONE absences for the whole year, so future approved absences are included.",
      input: z.object({
        year: z.coerce.number().int().min(2000).max(2200).describe("Calendar year, e.g. 2026."),
      }),
      positionals: ["year"],
      run: ({ year }) => getOfficeAbsenceStatistics({ fullYear: year }),
      render: detailsRenderer<OfficeAbsenceStatistics>([
        ["Holiday", (stats) => `${formatValue(stats.totalHoliday)} days${percent(stats.annualHolidayInPercent)}`],
        ["Home office", (stats) => `${formatValue(stats.totalHO)} days${percent(stats.annualHOInPercent)}`],
        ["Illness", (stats) => `${formatValue(stats.totalIllness)} days${percent(stats.annualIllnessInPercent)}`],
        [
          "Inaccessibility",
          (stats) => `${formatValue(stats.totalInaccessibility)} days${percent(stats.annualInaccessibilityInPercent)}`,
        ],
      ]),
    }),
    defineAction({
      action: "backup-approver",
      description:
        "Show the company-wide backup absence approver who handles requests when the primary approver is away.",
      input: z.object({}),
      run: () => getBackupAbsenceApprover(),
      render: detailsRenderer<BackupAbsenceApprover>([
        ["Backup approver", ({ backupAbsenceApprover }) => formatName(backupAbsenceApprover)],
        ["UUID", ({ backupAbsenceApprover }) => formatValue(backupAbsenceApprover?.uuid)],
      ]),
    }),
  ],
});
