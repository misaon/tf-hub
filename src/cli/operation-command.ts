import type { ArgDef, ArgsDef, CommandDef } from "citty";
import { z } from "zod";

import type { Operation } from "../domains/operation.ts";
import { defineCommand } from "./command.ts";
import { jsonArg, printJson } from "./output.ts";

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

export function commandFromOperation<Shape extends z.ZodRawShape, TOutput>(
  operation: Operation<Shape, TOutput>,
  presentation: OperationPresentation<TOutput>,
): CommandDef<ArgsDef> {
  const args: ArgsDef = { json: jsonArg };

  for (const [key, field] of Object.entries(operation.input.shape)) {
    args[key] = argFromField(field, presentation.positionals?.includes(key) ?? false);
  }

  return defineCommand({
    meta: { name: presentation.commandName ?? operation.name, description: operation.description },
    args,
    async run({ args: rawArgs }) {
      const rawInput = Object.fromEntries(Object.keys(operation.input.shape).map((key) => [key, rawArgs[key]]));
      const data = await operation.run(operation.input.parse(rawInput));

      if (rawArgs["json"] === true) {
        printJson(data);

        return;
      }

      presentation.render(data);
    },
  });
}
