import type { ArgDef } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";

import { displayWidth, renderTable } from "./table.ts";

export const jsonFlag = {
  type: "boolean",
  description: "Output machine-readable JSON.",
} as const satisfies ArgDef;

// Command output is data, never log lines: consola would restyle backticks and underscores or add prefixes.
export function writeOutput(text: string): void {
  process.stdout.write(`${text}\n`);
}

const controlCharacter = /(?![\t\n])\p{Cc}/u;
const controlCharacters = new RegExp(controlCharacter.source, "gu");

// Text written by other people must not drive the terminal (cursor moves, OSC links, clipboard writes).
export function stripControlCharacters(text: string): string {
  return text.replaceAll(controlCharacters, "");
}

// JSON.stringify escapes only C0 controls; DEL and C1 (e.g. CSI, OSC) would still reach the terminal raw.
function escapeRemainingControls(json: string): string {
  return json.replaceAll(
    controlCharacters,
    (character) => `\\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
  );
}

// Indented for people at a terminal; compact when piped, where agents pay for every token.
export function printJson(data: unknown): void {
  writeOutput(escapeRemainingControls(process.stdout.isTTY ? JSON.stringify(data, null, 2) : JSON.stringify(data)));
}

export function printTable(rows: Record<string, string>[], headers: string[]): void {
  if (rows.length === 0) {
    writeOutput(colors.dim("No records found."));

    return;
  }

  const safeRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([header, cell]) => [header, stripControlCharacters(cell)])),
  );
  const availableWidth = process.stdout.isTTY ? process.stdout.columns : Number.POSITIVE_INFINITY;

  writeOutput(renderTable(safeRows, headers, availableWidth));
  writeOutput(colors.dim(`\nTotal: ${rows.length}`));
}

export function printDetails(fields: Record<string, string>): void {
  const labelWidth = Math.max(...Object.keys(fields).map((label) => displayWidth(label)));
  const lines = Object.entries(fields).map(([label, value]) => {
    const paddedLabel = `${label}:`.padEnd(labelWidth + 1);
    const indentedValue = stripControlCharacters(value).replaceAll("\n", `\n${" ".repeat(labelWidth + 3)}`);

    return `${colors.dim(paddedLabel)}  ${indentedValue}`;
  });

  writeOutput(lines.join("\n"));
}

export function printSuccess(message: string): void {
  consola.success(message);
}

export type ColumnSpec<TItem> = readonly [header: string, cell: (item: TItem) => string];

export function tableRenderer<TItem>(columns: readonly ColumnSpec<TItem>[]): (items: TItem[]) => void {
  const headers = columns.map(([header]) => header);

  return (items) => {
    printTable(
      items.map((item) => Object.fromEntries(columns.map(([header, cell]) => [header, cell(item)]))),
      headers,
    );
  };
}

export function detailsRenderer<TItem>(fields: readonly ColumnSpec<TItem>[]): (item: TItem) => void {
  return (item) => {
    printDetails(Object.fromEntries(fields.map(([label, cell]) => [label, cell(item)])));
  };
}

export function deletedRenderer(noun: string): (result: { deleted: string | number }) => void {
  return ({ deleted }) => {
    printSuccess(`${noun} ${deleted} deleted.`);
  };
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (typeof minutes !== "number") {
    return missingValue;
  }

  const wholeHours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${wholeHours}h` : `${wholeHours}h ${rest}m`;
}

export const missingValue = "—";

export function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return missingValue;
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  return String(value);
}

const htmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

const maximumCodePoint = 1_114_111;

function decodeCodePoint(codePoint: number): string | undefined {
  if (codePoint > maximumCodePoint) {
    return undefined;
  }

  const character = String.fromCodePoint(codePoint);

  return controlCharacter.test(character) ? undefined : character;
}

export function plainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }

  return html
    .replaceAll(/<img[^>]*>/giu, " [image] ")
    .replaceAll(/<br\s*\/?>|<\/(?:p|h[1-6]|li|div)>/giu, "\n")
    .replaceAll(/<[^>]+>/gu, "")
    .replaceAll(/&#(?<code>\d+);/gu, (match, code: string) => decodeCodePoint(Number(code)) ?? match)
    .replaceAll(/&(?<name>[a-z]+);/gu, (match, name: string) => htmlEntities[name] ?? match)
    .replaceAll(/[^\S\n]+/gu, " ")
    .replaceAll(/\s*\n\s*/gu, "\n")
    .trim();
}

export function ellipsize(value: string | null | undefined, maxLength = 60): string {
  if (!value) {
    return missingValue;
  }

  const collapsed = value.replaceAll(/\s+/gu, " ").trim();

  return collapsed.length <= maxLength ? collapsed : `${collapsed.slice(0, maxLength - 1)}…`;
}

export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : missingValue;
}

type NamedPerson =
  | { name?: string | null | undefined }
  | { firstName?: string | null | undefined; lastName?: string | null | undefined };

export function formatName(person: NamedPerson | null | undefined): string {
  if (!person) {
    return missingValue;
  }

  if ("name" in person && person.name) {
    return person.name;
  }

  const firstName = "firstName" in person ? (person.firstName ?? "") : "";
  const lastName = "lastName" in person ? (person.lastName ?? "") : "";

  return `${firstName} ${lastName}`.trim() || missingValue;
}
