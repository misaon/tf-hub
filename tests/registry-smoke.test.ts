import { describe, expect, it, spyOn } from "bun:test";
import { runCommand, type ArgDef, type ArgsDef, type CommandDef } from "citty";
import { consola } from "consola";
import { z } from "zod";

import { operations, registryCommands } from "../src/domains/index.ts";
import type { Operation } from "../src/domains/operation.ts";
import { jsonResponse, makeJwt, mockFetch, seedValidSession } from "./support.ts";

const sampleByKey: [pattern: RegExp, value: string][] = [
  [/dateItems/u, '[{"date":"2026-06-10","workItems":[]}]'],
  [/uuid/iu, "0f4ad4e4-7a69-11ed-9965-42010a7f9011"],
  [/Ids$/u, "1,2"],
  [/^(?:id|.*Id)$/u, "1"],
  [/^fromMonth$/u, "6"],
  [/month/iu, "2026-05"],
  [/year/iu, "2026"],
  [/date|deadline|started|sentAt/iu, "2026-06-10"],
  [/^time$/u, "10:00"],
  [/timeSpent/u, "60"],
  [/weekDay/u, "1"],
  [/hours/iu, "8"],
  [/^(?:value|coverage|order)$/u, "10"],
];

function unwrap(field: z.core.$ZodType): { base: z.core.$ZodType; hasDefault: boolean; optional: boolean } {
  if (field instanceof z.ZodDefault) {
    return { ...unwrap(field.def.innerType), hasDefault: true };
  }

  if (field instanceof z.ZodOptional) {
    return { ...unwrap(field.def.innerType), optional: true };
  }

  return { base: field, hasDefault: false, optional: false };
}

function sampleValue(key: string, field: z.core.$ZodType): string {
  const matched = sampleByKey.find(([pattern]) => pattern.test(key));

  if (matched) {
    return matched[1];
  }

  const inner = field instanceof z.ZodPipe ? field.def.in : field;

  if (inner instanceof z.ZodEnum) {
    return String(inner.options[0]);
  }

  return "sample";
}

function argumentsFor(operation: Operation, argDefinitions: ArgsDef): string[] {
  const positionals: string[] = [];
  const flags: string[] = [];

  for (const [key, definition] of Object.entries(argDefinitions) as [string, ArgDef][]) {
    const field = key === "json" || definition.type === "boolean" ? undefined : operation.input.shape[key];
    const unwrapped = field ? unwrap(field) : undefined;

    if (unwrapped && !unwrapped.hasDefault && !unwrapped.optional) {
      const value = sampleValue(key, unwrapped.base);

      if (definition.type === "positional") {
        positionals.push(value);
      } else {
        flags.push(`--${key}=${value}`);
      }
    }
  }

  return [...positionals, ...flags];
}

interface SmokeCase {
  operation: Operation;
  command: CommandDef<ArgsDef>;
  rawArgs: string[];
}

function smokeCases(): SmokeCase[] {
  const cases: SmokeCase[] = [];

  for (const [domainName, command] of Object.entries(registryCommands)) {
    // The registry builds every subcommand as a plain definition; citty's Resolvable type erases that.
    const subCommands = (command.subCommands ?? {}) as Record<string, CommandDef<ArgsDef>>;
    const actions: [name: string, definition: CommandDef<ArgsDef>][] = command.subCommands
      ? Object.entries(subCommands)
      : [["", command]];

    for (const [actionName, definition] of actions) {
      const operationName = actionName ? `${domainName}-${actionName}` : domainName;
      const operation = operations.find((candidate) => candidate.name === operationName);

      if (operation) {
        const flags = argumentsFor(operation, (definition.args ?? {}) as ArgsDef);

        cases.push({ operation, command, rawArgs: actionName ? [actionName, ...flags] : flags });
      }
    }
  }

  return cases;
}

describe("every registered operation", () => {
  it("parses its CLI input, calls the API and renders a minimal response", async () => {
    await seedValidSession({ idToken: makeJwt({ name: "Tester", exp: 2_000_000_000 }) });

    spyOn(consola, "log").mockReturnValue(undefined);
    spyOn(consola, "info").mockReturnValue(undefined);
    spyOn(consola, "success").mockReturnValue(undefined);
    spyOn(consola, "box").mockReturnValue(undefined);

    const errorSpy = spyOn(consola, "error").mockReturnValue(undefined);

    const me = {
      uuid: "0f4ad4e4-7a69-11ed-9965-42010a7f9011",
      id: 7,
      primaryOfficeAbsenceApprover: { uuid: "1b4ad4e4-7a69-11ed-9965-42010a7f9011" },
    };
    let payload: unknown = {};

    mockFetch((input) =>
      Promise.resolve(
        String(input).includes("/collaborators/me")
          ? jsonResponse({ message: "OK", data: me })
          : jsonResponse({ message: "OK", data: payload, timeSpentSum: 0 }),
      ),
    );

    const failures: string[] = [];

    for (const { operation, command, rawArgs } of smokeCases()) {
      let succeeded = false;

      // Object and list endpoints tolerate different minimal payloads; accept whichever shape parses.
      for (const candidate of [{}, []]) {
        payload = candidate;
        process.exitCode = 0;
        errorSpy.mockClear();

        // oxlint-disable-next-line no-await-in-loop -- commands share process.exitCode and the consola spies
        await runCommand(command, { rawArgs: [...rawArgs] });

        if (process.exitCode === 0) {
          succeeded = true;
          break;
        }
      }

      if (!succeeded) {
        const lastError = String(errorSpy.mock.calls.at(-1)?.[0] ?? "unknown error");

        failures.push(`${operation.name}: ${lastError.slice(0, 120)}`);
      }
    }

    process.exitCode = 0;
    expect(failures).toEqual([]);
  });
});
