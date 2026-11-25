import { type ArgsDef, type CommandContext, type CommandDef, defineCommand as defineCittyCommand } from "citty";
import { consola } from "consola";

import { describeError } from "../errors.ts";
import { stripControlCharacters } from "./output.ts";
import { cliWording, kebabCase } from "./usage.ts";

export const exitCodes = { failure: 1, usage: 2 } as const;

export type Resolvable<Value> = Value | Promise<Value> | (() => Value) | (() => Promise<Value>);

function isThunk<Value extends object>(value: Resolvable<Value>): value is (() => Value) | (() => Promise<Value>) {
  return typeof value === "function";
}

export async function resolve<Value extends object>(value: Resolvable<Value>): Promise<Value> {
  return isThunk(value) ? await value() : await value;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export function reportError(error: unknown): void {
  consola.debug(error);
  consola.error(stripControlCharacters(cliWording(describeError(error))));
  process.exitCode = error instanceof UsageError ? exitCodes.usage : exitCodes.failure;
}

const builtInFlagNames = ["help", "h", "version", "v"];

function knownFlagNames(args: ArgsDef): Set<string> {
  const names = new Set(["_", ...builtInFlagNames]);

  for (const name of Object.keys(args)) {
    names.add(name);
    names.add(kebabCase(name));
    names.add(name.replaceAll(/-(?<letter>[a-z])/gu, (_match, letter: string) => letter.toUpperCase()));
  }

  return names;
}

// Citty ignores unknown flags, so a typo such as `--readonly` would silently run with the default instead.
function rejectUnexpectedArguments(parsed: Record<string, unknown>, args: ArgsDef): void {
  const known = knownFlagNames(args);
  const unknownFlags = Object.keys(parsed).filter((name) => !known.has(name));

  if (unknownFlags.length > 0) {
    const spelled = unknownFlags.map((name) => (name.length === 1 ? `-${name}` : `--${name}`));

    throw new UsageError(`Unknown option ${spelled.join(", ")}.`);
  }

  const positionalCount = Object.values(args).filter((definition) => definition.type === "positional").length;
  const positionals = Array.isArray(parsed["_"]) ? parsed["_"] : [];

  if (positionals.length > positionalCount) {
    throw new UsageError(`Unexpected argument ${positionals.slice(positionalCount).join(" ")}.`);
  }
}

export function defineCommand<Args extends ArgsDef = ArgsDef>(definition: CommandDef<Args>): CommandDef<Args> {
  const userRun = definition.run;

  if (!userRun) {
    return defineCittyCommand(definition);
  }

  return defineCittyCommand({
    ...definition,
    run: async (context: CommandContext<Args>) => {
      try {
        rejectUnexpectedArguments(context.args, definition.args === undefined ? {} : await resolve(definition.args));
        await userRun(context);
      } catch (error) {
        reportError(error);
      }
    },
  });
}
