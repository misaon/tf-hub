import { type ArgsDef, type CommandDef, runCommand } from "citty";
import { consola } from "consola";

import { exitCodes, reportError, resolve, type Resolvable } from "./command.ts";
import { stripControlCharacters, writeOutput } from "./output.ts";
import { binaryName, showUsage } from "./usage.ts";

interface CommandPath {
  commands: CommandDef<ArgsDef>[];
  names: string[];
  unknownName: string | undefined;
}

async function subCommandsOf(command: CommandDef<ArgsDef>): Promise<Record<string, Resolvable<CommandDef<ArgsDef>>>> {
  return command.subCommands === undefined ? {} : await resolve(command.subCommands);
}

async function resolveCommandPath(
  command: CommandDef<ArgsDef>,
  tokens: readonly string[],
  path: Omit<CommandPath, "unknownName">,
): Promise<CommandPath> {
  const [token, ...remainingTokens] = tokens;

  if (token === undefined) {
    return { ...path, unknownName: undefined };
  }

  if (token.startsWith("-")) {
    return resolveCommandPath(command, remainingTokens, path);
  }

  const subCommands = await subCommandsOf(command);

  if (Object.keys(subCommands).length === 0) {
    return { ...path, unknownName: undefined };
  }

  const next = subCommands[token];

  if (next === undefined) {
    return { ...path, unknownName: token };
  }

  const resolved = await resolve(next);

  return resolveCommandPath(resolved, remainingTokens, {
    commands: [...path.commands, resolved],
    names: [...path.names, token],
  });
}

function editDistance(left: string, right: string): number {
  let previousRow = Array.from({ length: right.length + 1 }, (_value, index) => index);

  for (const [leftIndex, leftCharacter] of [...left].entries()) {
    const currentRow = [leftIndex + 1];

    for (const [rightIndex, rightCharacter] of [...right].entries()) {
      const substitution = (previousRow[rightIndex] ?? 0) + (leftCharacter === rightCharacter ? 0 : 1);

      currentRow.push(
        Math.min((previousRow[rightIndex + 1] ?? 0) + 1, (currentRow[rightIndex] ?? 0) + 1, substitution),
      );
    }

    previousRow = currentRow;
  }

  return previousRow[right.length] ?? 0;
}

function closestName(name: string, candidates: readonly string[]): string | undefined {
  const ranked = candidates
    .map((candidate) => ({ candidate, distance: editDistance(name, candidate) }))
    .toSorted((first, second) => first.distance - second.distance);
  const [best] = ranked;

  return best !== undefined && best.distance <= Math.max(2, Math.floor(name.length / 3)) ? best.candidate : undefined;
}

function reportUsageError(message: string, commandNames: readonly string[]): void {
  const helpCommand = [binaryName, ...commandNames, "--help"].join(" ");

  const sentence = /[.?!]$/u.test(message) ? message : `${message}.`;

  consola.error(stripControlCharacters(`${sentence} Run \`${helpCommand}\` for usage.`));
  process.exitCode = exitCodes.usage;
}

const helpFlags = new Set(["--help", "-h"]);
const versionFlags = new Set(["--version", "-v", "-V"]);

export async function runCli(
  root: CommandDef<ArgsDef>,
  version: string,
  rawArgs = process.argv.slice(2),
): Promise<void> {
  const path = await resolveCommandPath(root, rawArgs, { commands: [root], names: [] });
  const command = path.commands.at(-1) ?? root;
  const parent = path.commands.at(-2);

  if (path.unknownName !== undefined) {
    const candidates = Object.keys(await subCommandsOf(command));
    const suggestion = closestName(path.unknownName, candidates);
    const hint = suggestion === undefined ? "" : ` Did you mean \`${suggestion}\`?`;

    reportUsageError(`Unknown command \`${path.unknownName}\`.${hint}`, path.names);

    return;
  }

  if (rawArgs.some((argument) => helpFlags.has(argument))) {
    await showUsage(command, parent);

    return;
  }

  if (rawArgs.length === 1 && versionFlags.has(rawArgs[0] ?? "")) {
    writeOutput(version);

    return;
  }

  if (command.run === undefined) {
    await showUsage(command, parent);

    return;
  }

  try {
    await runCommand(command, { rawArgs: rawArgs.slice(path.names.length) });
  } catch (error) {
    if (error instanceof Error && error.name === "CLIError") {
      reportUsageError(error.message, path.names);

      return;
    }

    reportError(error);
  }
}
