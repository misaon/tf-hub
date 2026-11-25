import { stripVTControlCharacters } from "node:util";
import { renderUsage, type ArgsDef, type CommandDef, type CommandMeta } from "citty";
import { colors } from "consola/utils";

import { writeOutput } from "./output.ts";

export const binaryName = "tf-hub";

const commandDetails = new WeakMap<object, string>();
const cliPathsByOperationName = new Map<string, string>();
const booleanFlagNames = new Set<string>();

export function registerCommandDetails(command: object, details: string): void {
  commandDetails.set(command, details);
}

export function registerCliPath(operationName: string, cliPath: string): void {
  cliPathsByOperationName.set(operationName, cliPath);
}

export function registerBooleanFlag(name: string): void {
  booleanFlagNames.add(name);
}

export function kebabCase(name: string): string {
  return name.replaceAll(/(?<lower>[a-z\d])(?<upper>[A-Z])/gu, "$<lower>-$<upper>").toLowerCase();
}

function cliFlag(name: string, value: string): string {
  if (value === "true" && booleanFlagNames.has(name)) {
    return `--${kebabCase(name)}`;
  }

  return `--${kebabCase(name)}=${value}`;
}

// Operation descriptions and notices are written for MCP tools; CLI readers get commands and flags instead.
export function cliWording(text: string): string {
  return text
    .replaceAll(/`(?<name>[a-z]+(?:-[a-z]+)*)`/gu, (match, name: string) => {
      const cliPath = cliPathsByOperationName.get(name);

      return cliPath === undefined ? match : `\`${binaryName} ${cliPath}\``;
    })
    .replaceAll(
      /(?<=^|\s)(?<name>[a-z][A-Za-z]*)=(?<value>[\w-]+)(?![\w=-])/gu,
      (_match, name: string, value: string) => cliFlag(name, value),
    );
}

function wrapText(text: string, width: number, indent: string): string {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    let line = "";

    for (const word of paragraph.split(" ")) {
      if (line !== "" && line.length + word.length + 1 > width) {
        lines.push(line);
        line = word;
      } else {
        line = line === "" ? word : `${line} ${word}`;
      }
    }

    lines.push(line);
  }

  return lines.map((line) => `${indent}${line}`).join("\n");
}

const highlightedCode = /`(?<code>[^`]+)`/gu;

function stylize(text: string): string {
  if (process.stdout.hasColors?.() !== true) {
    return stripVTControlCharacters(text);
  }

  return text.replaceAll(highlightedCode, (_match, code: string) => colors.cyan(code));
}

async function metaOf(command: CommandDef<ArgsDef> | undefined): Promise<CommandMeta | undefined> {
  const meta = command?.meta;

  return typeof meta === "function" ? await meta() : await meta;
}

// Citty prefixes only the direct parent, so `worklogs list` would lose the binary name.
async function qualifiedParent(parent: CommandDef<ArgsDef> | undefined): Promise<CommandDef<ArgsDef> | undefined> {
  const parentMeta = await metaOf(parent);
  const parentName = parentMeta?.name;

  if (parentName === undefined || parentName === binaryName) {
    return parent;
  }

  return { meta: { name: `${binaryName} ${parentName}` } };
}

// The root lists every command in its USAGE line; the COMMANDS table below already shows them.
function collapseCommandList(usage: string): string {
  return usage.replace(/(?:[\w-]+\|){14,}[\w-]+/u, "<command>");
}

function trimLines(text: string): string {
  return text.replaceAll(/[ \t]+$/gmu, "").trimEnd();
}

// Command lists keep one-line summaries, so a command's own help appends the rest of the description.
// It is the only place CLI users and shell-driven agents learn units, scopes and side effects.
export async function showUsage(command: CommandDef<ArgsDef>, parent?: CommandDef<ArgsDef>): Promise<void> {
  const usage = trimLines(cliWording(collapseCommandList(await renderUsage(command, await qualifiedParent(parent)))));
  const details = commandDetails.get(command);
  const width = Math.min(process.stdout.columns || 100, 100);

  if (details === undefined) {
    writeOutput(stylize(`${usage}\n`));

    return;
  }

  const heading = colors.underline(colors.bold("DETAILS"));

  writeOutput(stylize(`${usage}\n\n${heading}\n\n${wrapText(cliWording(details), width - 2, "  ")}\n`));
}
