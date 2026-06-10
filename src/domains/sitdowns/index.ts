import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  ellipsize,
  formatDate,
  formatName,
  formatValue,
  missingValue,
  printSuccess,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { dateField, explicitBooleanField, idField, limitField, monthField, offsetField, uuidField } from "../fields.ts";
import { sortDirections } from "../shared.ts";
import {
  createSitdown,
  createSitdownNote,
  createSitdownRating,
  createSitdownTime,
  deleteSitdown,
  deleteSitdownNote,
  deleteSitdownTime,
  listSitdownNotes,
  listSitdownRatings,
  listSitdownTimes,
  listSitdowns,
  sitdownRatingValues,
  updateSitdown,
  updateSitdownNote,
  updateSitdownTime,
  type Sitdown,
  type SitdownNote,
  type SitdownRating,
  type SitdownTime,
} from "./api.ts";

const weekDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const monthFilterInput = z.object({
  month: monthField(),
  monthsBack: z.coerce.number().int().min(0).describe("Also include this many previous months.").optional(),
  limit: limitField,
  offset: offsetField,
});

const sitdownColumns: ColumnSpec<Sitdown>[] = [
  ["ID", (sitdown) => formatValue(sitdown.id)],
  ["Date", (sitdown) => formatDate(sitdown.date)],
];

const noteDetails = detailsRenderer<SitdownNote>([
  ["ID", (note) => formatValue(note.id)],
  ["Project", (note) => formatName(note.project)],
  ["Deadline", (note) => formatDate(note.deadline)],
  ["Text", (note) => ellipsize(note.text, 100)],
]);

const timeColumns: ColumnSpec<SitdownTime>[] = [
  ["ID", (time) => formatValue(time.id)],
  ["Name", (time) => formatValue(time.name)],
  [
    "Day",
    (time) => (typeof time.weekDay === "number" ? (weekDayNames[time.weekDay] ?? String(time.weekDay)) : missingValue),
  ],
  ["Time", (time) => formatValue(time.time)],
];

const ratingColumns: ColumnSpec<SitdownRating>[] = [
  ["ID", (rating) => formatValue(rating.id)],
  ["Project", (rating) => formatName(rating.project)],
  ["Sitdown", (rating) => formatDate(rating.sitdown?.date)],
  ["Goals", (rating) => formatValue(rating.ratingGoalsValue)],
  ["Feeling", (rating) => formatValue(rating.ratingFeelingValue)],
  ["Coverage", (rating) => (typeof rating.coverage === "number" ? `${rating.coverage}%` : missingValue)],
];

const weekDayField = z.coerce
  .number()
  .int()
  .min(0)
  .max(6)
  .describe("Day of the week (0 = Sunday, 1 = Monday, … 6 = Saturday).");

const checkDescription = (subject: string): string => `Whether ${subject} (true/false).`;

export const sitdownsDomain: RegistryEntry = defineDomain({
  name: "sitdowns",
  description: "Team meetings rating project health and setting goals.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List the sitdowns of a month. Sitdowns are the regular project team meetings where teams rate project " +
        "health and set goals; include previous months with monthsBack.",
      input: monthFilterInput,
      positionals: ["month"],
      run: (input) => listSitdowns(input),
      render: tableRenderer(sitdownColumns),
    }),
    defineAction({
      action: "create",
      description: "Schedule a new sitdown (project team meeting) on a date.",
      input: z.object({ date: dateField("Date of the sitdown (YYYY-MM-DD).") }),
      positionals: ["date"],
      run: (input) => createSitdown(input),
      render: detailsRenderer(sitdownColumns),
    }),
    defineAction({
      action: "update",
      description: "Change the date of an existing sitdown.",
      input: z.object({
        id: idField("Numeric ID of the sitdown."),
        date: dateField("New date of the sitdown (YYYY-MM-DD)."),
      }),
      positionals: ["id", "date"],
      run: (input) => updateSitdown(input),
      render: detailsRenderer(sitdownColumns),
    }),
    defineAction({
      action: "delete",
      description: "Delete a sitdown.",
      input: z.object({ id: idField("Numeric ID of the sitdown to delete.") }),
      positionals: ["id"],
      async run(input) {
        await deleteSitdown(input);

        return { deleted: input.id };
      },
      render: deletedRenderer("Sitdown"),
    }),
  ],
});

export const sitdownNotesDomain: RegistryEntry = defineDomain({
  name: "sitdown-notes",
  description: "Project goals and action items agreed at sitdowns.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List sitdown notes. They are the project goals and action items with deadlines agreed at sitdowns. " +
        "Resolved notes are soft-deleted; include them with withDeleted.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        projectUuid: uuidField("Only notes of the project with this UUID.").optional(),
        withDeleted: z.boolean().default(false).describe("Include resolved (deleted) notes."),
        orderBy: z.string().describe("Property to order by, e.g. deadline or createdAt.").optional(),
        orderDir: z.enum(sortDirections).describe("Order direction: ASC or DESC.").optional(),
      }),
      run: (input) => listSitdownNotes(input),
      render: tableRenderer<SitdownNote>([
        ["ID", (note) => formatValue(note.id)],
        ["Project", (note) => formatName(note.project)],
        ["Deadline", (note) => formatDate(note.deadline)],
        ["Resolved", (note) => formatValue(Boolean(note.deletedAt))],
        ["Text", (note) => ellipsize(note.text, 50)],
      ]),
    }),
    defineAction({
      action: "create",
      description: "Create a sitdown note: a goal or action item for a project with a deadline.",
      input: z.object({
        text: z.string().min(1).describe("Goal or action item text."),
        projectId: idField("Numeric ID of the project (see `projects-list`)."),
        deadline: dateField("Deadline (YYYY-MM-DD)."),
      }),
      run: (input) => createSitdownNote(input),
      render: noteDetails,
    }),
    defineAction({
      action: "update",
      description: "Update a sitdown note's text, project or deadline.",
      input: z.object({
        id: idField("Numeric ID of the sitdown note."),
        text: z.string().min(1).describe("Updated text."),
        projectId: idField("Numeric ID of the project."),
        deadline: dateField("Updated deadline (YYYY-MM-DD)."),
      }),
      positionals: ["id"],
      run: (input) => updateSitdownNote(input),
      render: noteDetails,
    }),
    defineAction({
      action: "delete",
      description: "Resolve (soft-delete) a sitdown note. This is the usual way to mark a project goal as done.",
      input: z.object({ id: idField("Numeric ID of the sitdown note.") }),
      positionals: ["id"],
      async run(input) {
        await deleteSitdownNote(input);

        return { deleted: input.id };
      },
      render({ deleted }) {
        printSuccess(`Sitdown note ${deleted} resolved.`);
      },
    }),
  ],
});

export const sitdownTimesDomain: RegistryEntry = defineDomain({
  name: "sitdown-times",
  description: "Recurring sitdown time slots for projects.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List recurring sitdown time slots (name, weekday, time). Projects are assigned to a slot and discussed " +
        "in that meeting.",
      input: z.object({ limit: limitField, offset: offsetField }),
      run: (input) => listSitdownTimes(input),
      render: tableRenderer(timeColumns),
    }),
    defineAction({
      action: "create",
      description: "Create a recurring sitdown time slot. Projects can then be assigned to it.",
      input: z.object({
        name: z.string().min(1).describe("Name of the slot, e.g. 'Monday 10:00'."),
        time: z.string().min(1).describe("Time of day (HH:mm), e.g. 10:00."),
        weekDay: weekDayField,
      }),
      run: (input) => createSitdownTime(input),
      render: detailsRenderer(timeColumns),
    }),
    defineAction({
      action: "update",
      description: "Update a recurring sitdown time slot.",
      input: z.object({
        id: idField("Numeric ID of the sitdown time slot."),
        name: z.string().min(1).describe("Updated name."),
        time: z.string().min(1).describe("Updated time of day (HH:mm)."),
        weekDay: weekDayField,
      }),
      positionals: ["id"],
      run: (input) => updateSitdownTime(input),
      render: detailsRenderer(timeColumns),
    }),
    defineAction({
      action: "delete",
      description: "Delete a recurring sitdown time slot. It must not be used by any project.",
      input: z.object({ id: idField("Numeric ID of the sitdown time slot.") }),
      positionals: ["id"],
      async run(input) {
        await deleteSitdownTime(input);

        return { deleted: input.id };
      },
      render: deletedRenderer("Sitdown time"),
    }),
  ],
});

export const sitdownRatingsDomain: RegistryEntry = defineDomain({
  name: "sitdown-ratings",
  description: "Project health ratings recorded at sitdowns.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List project health ratings recorded at sitdowns: goals achievement, team feeling, test coverage and " +
        "technical-health checks (refactoring, tests, documentation, audits).",
      input: monthFilterInput,
      positionals: ["month"],
      run: (input) => listSitdownRatings(input),
      render: tableRenderer(ratingColumns),
    }),
    defineAction({
      action: "create",
      description:
        "Record a project's health rating at a sitdown: rate goals achievement and team feeling (FAIL/OK/GOOD), " +
        "test coverage percentage and the technical-health checklist.",
      input: z.object({
        sitdownId: idField("Numeric ID of the sitdown (see `sitdowns-list`)."),
        projectId: idField("Numeric ID of the project (see `projects-list`)."),
        ratingGoalsValue: z.enum(sitdownRatingValues).describe("How well the project goals were met.").optional(),
        ratingFeelingValue: z.enum(sitdownRatingValues).describe("Team feeling about the project state.").optional(),
        coverage: z.coerce.number().min(0).max(100).describe("Test coverage in percent (0-100).").optional(),
        ratingRefactor: explicitBooleanField(checkDescription("refactoring was done")).optional(),
        ratingTests: explicitBooleanField(checkDescription("tests were written")).optional(),
        ratingDocumentation: explicitBooleanField(checkDescription("documentation was updated")).optional(),
        ratingSecurityAudit: explicitBooleanField(checkDescription("a security audit was done")).optional(),
        ratingLicenseAudit: explicitBooleanField(checkDescription("a license audit was done")).optional(),
        ratingProjectChecklist: explicitBooleanField(checkDescription("the project checklist is satisfied")).optional(),
      }),
      run: (input) => createSitdownRating(input),
      render: detailsRenderer(ratingColumns),
    }),
  ],
});
