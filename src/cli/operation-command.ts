import type { ArgDef, ArgsDef, CommandDef } from "citty";
import { consola } from "consola";
import { z } from "zod";

import { runOperation, type Operation } from "../domains/operation.ts";
import { defineCommand } from "./command.ts";
import { jsonArg, printJson } from "./output.ts";
import { registerCommandDetails } from "./usage.ts";

export interface OperationPresentation<TOutput> {
  commandName?: string | undefined;
  positionals?: readonly string[] | undefined;
  render: (data: TOutput) => void;
}

type ZodField = z.core.$ZodType;

interface UnwrappedField {
  base: ZodField;
  defaultValue: unknown;
  optional: boolean;
  description: string | undefined;
}

function unwrapField(field: ZodField): UnwrappedField {
  const description = z.globalRegistry.get(field)?.description;

  if (field instanceof z.ZodDefault) {
    const inner = unwrapField(field.def.innerType);

    return {
      base: inner.base,
      defaultValue: field.def.defaultValue,
      optional: inner.optional,
      description: description ?? inner.description,
    };
  }

  if (field instanceof z.ZodOptional) {
    const inner = unwrapField(field.def.innerType);

    return {
      base: inner.base,
      defaultValue: inner.defaultValue,
      optional: true,
      description: description ?? inner.description,
    };
  }

  return { base: field, defaultValue: undefined, optional: false, description };
}

function argFromField(field: ZodField, positional: boolean): ArgDef {
  const { base, defaultValue, optional, description } = unwrapField(field);

  if (positional) {
    return {
      type: "positional",
      required: defaultValue === undefined && !optional,
      ...(description === undefined ? {} : { description }),
      ...(defaultValue === undefined ? {} : { default: String(defaultValue) }),
    };
  }

  if (base instanceof z.ZodBoolean) {
    return {
      type: "boolean",
      default: Boolean(defaultValue ?? false),
      ...(description === undefined ? {} : { description }),
    };
  }

  return {
    type: "string",
    ...(description === undefined ? {} : { description }),
    ...(defaultValue === undefined ? {} : { default: String(defaultValue) }),
  };
}

const summaryBoundary = /:\s|\.\s+(?=[A-Z`])/u;

// Terminal help shows only the headline; MCP clients receive the full operation description.
export function summarize(description: string): string {
  const boundary = summaryBoundary.exec(description);

  if (!boundary) {
    return description;
  }

  const headline = description.slice(0, boundary.index);

  return headline.endsWith(".") ? headline : `${headline}.`;
}

export function commandFromOperation<Shape extends z.ZodRawShape, TOutput>(
  operation: Operation<Shape, TOutput>,
  presentation: OperationPresentation<TOutput>,
): CommandDef<ArgsDef> {
  const args: ArgsDef = { json: jsonArg };

  for (const [key, field] of Object.entries(operation.input.shape)) {
    args[key] = argFromField(field, presentation.positionals?.includes(key) ?? false);
  }

  const summary = summarize(operation.description);
  const command = defineCommand({
    meta: { name: presentation.commandName ?? operation.name, description: summary },
    args,
    async run({ args: rawArgs }) {
      const rawInput = Object.fromEntries(Object.keys(operation.input.shape).map((key) => [key, rawArgs[key]]));
      const { data, notices } = await runOperation(operation, operation.input.parse(rawInput));

      for (const notice of notices) {
        consola.warn(notice);
      }

      if (rawArgs["json"] === true) {
        printJson(data);

        return;
      }

      presentation.render(data);
    },
  });

  if (summary !== operation.description) {
    registerCommandDetails(command, operation.description);
  }

  return command;
}
