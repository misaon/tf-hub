import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  formatValue,
  missingValue,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { idField, limitField, numberField, offsetField, timeOfDayField } from "../fields.ts";
import { createSitdownTime, deleteSitdownTime, listSitdownTimes, updateSitdownTime, type SitdownTime } from "./api.ts";

const weekDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeColumns: ColumnSpec<SitdownTime>[] = [
  ["ID", (time) => formatValue(time.id)],
  ["Name", (time) => formatValue(time.name)],
  [
    "Day",
    (time) => (typeof time.weekDay === "number" ? (weekDayNames[time.weekDay] ?? String(time.weekDay)) : missingValue),
  ],
  ["Time", (time) => formatValue(time.time)],
];

const weekDayField = numberField(z.number().int().min(0).max(6)).describe(
  "Day of the week (0 = Sunday, 1 = Monday, … 6 = Saturday).",
);

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
        time: timeOfDayField("Time of day (HH:mm), e.g. 10:00."),
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
        time: timeOfDayField("Updated time of day (HH:mm)."),
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
