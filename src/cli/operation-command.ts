import type { ArgDef, ArgsDef, CommandDef } from "citty";
import { consola } from "consola";
import { z } from "zod";

import { runOperation, type Operation } from "../domains/operation.ts";
import { defineCommand, UsageError } from "./command.ts";
import { jsonFlag, printJson } from "./output.ts";
import {
  binaryName,
  cliWording,
  kebabCase,
  registerBooleanFlag,
  registerCliPath,
  registerCommandDetails,
} from "./usage.ts";

export interface OperationPresentation<TOutput> {
  cliPath: string;
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

  if (!(field instanceof z.ZodDefault || field instanceof z.ZodOptional)) {
    return { base: field, defaultValue: undefined, optional: false, description };
  }

  const inner = unwrapField(field.def.innerType);

  return {
    base: inner.base,
    defaultValue: field instanceof z.ZodDefault ? field.def.defaultValue : inner.defaultValue,
    optional: field instanceof z.ZodOptional || inner.optional,
    description: description ?? inner.description,
  };
}

function enumOptions(base: ZodField): string[] | undefined {
  if (!(base instanceof z.ZodEnum)) {
    return undefined;
  }

  return base.options.map(String);
}

function shownDefault(defaultValue: unknown): string | undefined {
  if (defaultValue === undefined || Array.isArray(defaultValue)) {
    return undefined;
  }

  return String(defaultValue);
}

function argFromField(name: string, field: ZodField, positional: boolean): ArgDef {
  const { base, defaultValue, optional, description = "" } = unwrapField(field);
  const options = enumOptions(base);
  const required = defaultValue === undefined && !optional;
  const defaultText = shownDefault(defaultValue);
  const withDefault = defaultText === undefined ? {} : { default: defaultText };

  if (positional) {
    const choices = options === undefined ? "" : ` One of: ${options.join(", ")}.`;

    return { type: "positional", required, description: `${description}${choices}`, ...withDefault };
  }

  if (base instanceof z.ZodBoolean) {
    registerBooleanFlag(name);

    return { type: "boolean", description };
  }

  if (options !== undefined) {
    return { type: "enum", options, required, description, ...withDefault };
  }

  return { type: "string", required, description, ...withDefault };
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

function detailsBeyondSummary(description: string): string | undefined {
  const boundary = summaryBoundary.exec(description);

  if (!boundary) {
    return undefined;
  }

  return boundary[0].startsWith(":") ? description : description.slice(boundary.index + boundary[0].length);
}

function describeInputIssues(error: z.ZodError, positionals: readonly string[]): string {
  return error.issues
    .map((issue) => {
      const [field] = issue.path;

      if (typeof field !== "string") {
        return issue.message;
      }

      const label = positionals.includes(field) ? field.toUpperCase() : `--${kebabCase(field)}`;

      return `${label}: ${issue.message}`;
    })
    .join("\n");
}

export function commandFromOperation<Shape extends z.ZodRawShape, TOutput>(
  operation: Operation<Shape, TOutput>,
  presentation: OperationPresentation<TOutput>,
): CommandDef<ArgsDef> {
  const positionals = presentation.positionals ?? [];
  const args: ArgsDef = {};

  for (const [key, field] of Object.entries(operation.input.shape)) {
    const positional = positionals.includes(key);

    args[positional ? key : kebabCase(key)] = argFromField(key, field, positional);
  }

  args["json"] = jsonFlag;
  registerCliPath(operation.name, presentation.cliPath);

  const helpHint = `Run \`${binaryName} ${presentation.cliPath} --help\` for usage.`;
  const summary = summarize(operation.description);
  const command = defineCommand({
    meta: { name: presentation.cliPath.slice(presentation.cliPath.lastIndexOf(" ") + 1), description: summary },
    args,
    async run({ args: parsedArgs }) {
      const rawInput = Object.fromEntries(Object.keys(operation.input.shape).map((key) => [key, parsedArgs[key]]));
      const input = operation.input.safeParse(rawInput);

      if (!input.success) {
        throw new UsageError(`${describeInputIssues(input.error, positionals)}\n${helpHint}`);
      }

      const { data, notices } = await runOperation(operation, input.data);

      if (parsedArgs["json"] === true) {
        printJson(data);
      } else {
        presentation.render(data);
      }

      for (const notice of notices) {
        consola.warn(cliWording(notice));
      }
    },
  });

  const details = detailsBeyondSummary(operation.description);

  if (details !== undefined) {
    registerCommandDetails(command, details);
  }

  return command;
}
