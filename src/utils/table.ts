import { colors } from "consola/utils";

export function renderTable(rows: Record<string, string>[], headers: string[]): string {
  if (rows.length === 0) {
    return colors.dim("(no data)");
  }

  const columnWidths = headers.map((header) =>
    Math.max(header.length, ...rows.map((row) => (row[header] ?? "").length)),
  );
  const formatRow = (cells: string[]): string =>
    cells.map((cell, index) => cell.padEnd(columnWidths[index] ?? 0)).join("  ");

  return [
    colors.bold(formatRow(headers)),
    colors.dim(columnWidths.map((width) => "─".repeat(width)).join("  ")),
    ...rows.map((row) => formatRow(headers.map((header) => row[header] ?? ""))),
  ].join("\n");
}
