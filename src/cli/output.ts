import type { ArgDef } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";

import { renderTable } from "./table.ts";

export const jsonArg = {
  type: "boolean",
  description: "Output raw JSON instead of formatted text.",
  default: false,
} as const satisfies ArgDef;

export function printJson(data: unknown): void {
  consola.log(JSON.stringify(data, null, 2));
}

export function printTable(rows: Record<string, string>[], headers: string[]): void {
  consola.log(renderTable(rows, headers));
  consola.log(colors.dim(`\nTotal: ${rows.length}`));
}

export function printDetails(fields: Record<string, string>): void {
  const labelWidth = Math.max(...Object.keys(fields).map((label) => label.length));
  const lines = Object.entries(fields).map(([label, value]) => `${`${label}:`.padEnd(labelWidth + 1)} ${value}`);

  consola.box(lines.join("\n"));
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
