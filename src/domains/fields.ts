import { z } from "zod";

import { maxRecordsPerPage } from "../config.ts";

// The server defaults date ranges to 2021–2022; an explicit wide range means "everything".
export const allTimeFromDate = "2000-01-01";
export const allTimeToDate = "2100-01-01";

export const limitField = z.coerce
  .number()
  .int()
  .min(1)
  .default(maxRecordsPerPage)
  .describe("Maximum number of records to return.");

export const offsetField = z.coerce
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Number of records to skip (for pagination).");

export function idField(description: string) {
  return z.coerce.number().int().positive().describe(description);
}

const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;

// A refinement instead of z.uuid() keeps Zod's 150-character regex out of the MCP tool list.
// Clients still get `format: uuid`, without the pattern repeated for every UUID parameter.
export function uuidField(description: string) {
  return z
    .string()
    .refine((value) => uuidPattern.test(value), "Invalid UUID.")
    .meta({ format: "uuid", description });
}

const monthPattern = /^\d{4}-(?:0?[1-9]|1[0-2])$/u;

const toUnpaddedMonth = (value: string): string => value.replace(/-0(?=\d$)/u, "-");

export function monthField(description = "Month as YYYY-MM, e.g. 2026-05.") {
  return z
    .string()
    .regex(monthPattern, "Invalid month. Use the format YYYY-MM, e.g. 2026-05.")
    .transform(toUnpaddedMonth)
    .describe(description);
}

export function dateField(description: string) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Invalid date. Use the format YYYY-MM-DD, e.g. 2026-06-10.")
    .describe(description);
}

export function dateTimeField(description: string) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(?:[T ].+)?$/u, "Invalid date. Use ISO 8601, e.g. 2026-06-10 or 2026-06-10T09:00:00.")
    .describe(description);
}

// Every field below accepts the native JSON type MCP clients send and the string form CLI flags carry.
export function explicitBooleanField(description: string) {
  return z
    .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")], {
      error: "Expected true or false.",
    })
    .describe(description);
}

export function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function commaSeparatedNumbersField(description: string) {
  const numericIds = z.array(z.number().int());

  return z
    .union(
      [
        numericIds,
        z
          .string()
          .transform((value) => splitCommaList(value).map(Number))
          .pipe(numericIds),
      ],
      {
        error: "Expected a list of numeric IDs, e.g. [1, 2] or 1,2.",
      },
    )
    .describe(description);
}

export function commaSeparatedStringsField(description: string) {
  return z.union([z.array(z.string()), z.string().transform(splitCommaList)]).describe(description);
}

export function jsonField<Schema extends z.ZodType>(schema: Schema, description: string) {
  const serialized = z
    .string()
    .transform((value, context) => {
      try {
        const parsed: unknown = JSON.parse(value);

        return parsed;
      } catch {
        context.addIssue({ code: "custom", message: "Invalid JSON." });

        return z.NEVER;
      }
    })
    .pipe(schema);

  return z.union([schema, serialized]).describe(description);
}
